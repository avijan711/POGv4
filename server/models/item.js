const BaseModel = require('./BaseModel');
const getAllItemsQuery = require('./queries/items/getAllItems');
const getItemByIdQuery = require('./queries/items/getItemById');
const debug = require('../utils/debug');
const itemUtils = require('../utils/itemUtils');

class ItemModel extends BaseModel {
    constructor(db) {
        super(db);
        this.jsonFields = ['reference_change', 'referencing_items', 'price_history', 'supplier_prices', 'promotions'];
    }

    async getAllItems() {
        try {
            debug.time('getAllItems');
            const rows = await this.executeQuery(getAllItemsQuery);
            const items = rows.map(row => itemUtils.parseJsonFields(row, this.jsonFields));
            debug.timeEnd('getAllItems');
            return items;
        } catch (err) {
            debug.error('Error getting items:', err);
            throw err;
        }
    }

    async getItemById(item_id) {
        try {
            debug.time('getItemById');
            debug.log('Getting item by ID:', item_id);

            // The query needs item_id eight times:
            // 1. LatestHistory CTE
            // 2. LatestInquiryItems CTE
            // 3. PriceHistory CTE
            // 4. SupplierPrices CTE
            // 5. ItemPromotions CTE
            // 6. BaseItems CTE
            // 7. LatestReferenceChanges CTE
            // 8. ReferencingItems CTE
            const params = Array(8).fill(item_id);
            const row = await this.executeQuerySingle(getItemByIdQuery, params);

            if (!row) {
                debug.log('No item found for ID:', item_id);
                return null;
            }

            const parsedRow = itemUtils.parseJsonFields(row, this.jsonFields);
            debug.timeEnd('getItemById');
            return parsedRow;
        } catch (err) {
            debug.error('Error getting item:', err);
            throw err;
        }
    }

    async createItem(data) {
        try {
            const validation = itemUtils.validateItemData(data);
            if (!validation.isValid) {
                throw new Error(`Invalid item data: ${validation.errors.join(', ')}`);
            }

            const formattedData = itemUtils.formatItemData(data);
            await this.executeTransaction(async (db) => {
                await this._insertItemBase(db, formattedData);
                if (itemUtils.hasRetailPrice(formattedData)) {
                    await this._insertPriceHistory(db, formattedData);
                }
            });

            return formattedData;
        } catch (err) {
            debug.error('Error creating item:', err);
            throw err;
        }
    }

    async updateItem(item_id, data) {
        try {
            const validation = itemUtils.validateItemData({ ...data, item_id });
            if (!validation.isValid) {
                throw new Error(`Invalid item data: ${validation.errors.join(', ')}`);
            }

            const formattedData = itemUtils.formatItemData({ ...data, item_id });
            await this.executeTransaction(async (db) => {
                await this._updateItemBase(db, item_id, formattedData);
                if (itemUtils.hasRetailPrice(formattedData)) {
                    await this._insertPriceHistory(db, formattedData);
                }
            });
        } catch (err) {
            debug.error('Error updating item:', err);
            throw err;
        }
    }

    async deleteItem(item_id) {
        try {
            await this.executeTransaction(async (db) => {
                await this._deleteItemReference(db, item_id);
                await this._deleteRelatedRecords(db, item_id);
            });
        } catch (err) {
            debug.error('Error deleting item:', err);
            throw err;
        }
    }

    async addReferenceChange(item_id, new_reference_id, supplier_id, notes) {
        if (item_id === new_reference_id) return;

        try {
            await this.executeTransaction(async (db) => {
                const existingItem = await this._checkItemExists(db, new_reference_id);
                if (!existingItem) {
                    await this._createReferenceItem(db, new_reference_id);
                }

                await this._deleteSelfReferences(db);
                await this._insertReferenceChange(db, item_id, new_reference_id, supplier_id, notes);
            });
        } catch (err) {
            debug.error('Error adding reference change:', err);
            throw err;
        }
    }

    async _insertItemBase(db, data) {
        const query = `
            INSERT INTO item (
                item_id,
                hebrew_description,
                english_description,
                import_markup,
                hs_code,
                origin,
                image
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.item_id,
            data.hebrew_description,
            data.english_description || '',
            data.import_markup || 1.30,
            data.hs_code || '',
            data.origin || '',
            data.image || ''
        ];

        debug.logQuery('Insert item base', query, params);
        await this.executeRun(query, params);
    }

    async _insertPriceHistory(db, data) {
        const query = `
            INSERT INTO price_history (
                item_id,
                ils_retail_price,
                qty_in_stock,
                sold_this_year,
                sold_last_year,
                date
            ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        const params = [
            data.item_id,
            data.retail_price,
            data.qty_in_stock || 0,
            data.sold_this_year || 0,
            data.sold_last_year || 0
        ];

        debug.logQuery('Insert price history', query, params);
        await this.executeRun(query, params);
    }

    async _updateItemBase(db, item_id, data) {
        // First get current item data
        const currentItem = await this.getItemById(item_id);
        if (!currentItem) {
            throw new Error('Item not found');
        }

        const query = `
            UPDATE item SET 
                hebrew_description = COALESCE(?, hebrew_description),
                english_description = COALESCE(?, english_description),
                import_markup = COALESCE(?, import_markup),
                hs_code = COALESCE(?, hs_code),
                origin = COALESCE(?, origin)
                ${data.image ? ', image = ?' : ''}
            WHERE item_id = ?
        `;

        const params = [
            data.hebrew_description || currentItem.hebrew_description,
            data.english_description !== undefined ? data.english_description : currentItem.english_description,
            data.import_markup || currentItem.import_markup,
            data.hs_code !== undefined ? data.hs_code : currentItem.hs_code,
            data.origin !== undefined ? data.origin : currentItem.origin,
            ...(data.image ? [data.image] : []),
            item_id
        ];

        debug.logQuery('Update item base', query, params);
        const result = await this.executeRun(query, params);
        if (result.changes === 0) {
            throw new Error('Item not found');
        }

        // Update history if retail price or quantities changed
        if (data.retail_price !== undefined || 
            data.qty_in_stock !== undefined || 
            data.sold_this_year !== undefined || 
            data.sold_last_year !== undefined) {
            
            const historyData = {
                item_id,
                retail_price: data.retail_price !== undefined ? data.retail_price : currentItem.retail_price,
                qty_in_stock: data.qty_in_stock !== undefined ? data.qty_in_stock : currentItem.qty_in_stock,
                sold_this_year: data.sold_this_year !== undefined ? data.sold_this_year : currentItem.sold_this_year,
                sold_last_year: data.sold_last_year !== undefined ? data.sold_last_year : currentItem.sold_last_year
            };

            await this._insertPriceHistory(db, historyData);
        }
    }

    async _deleteRelatedRecords(db, item_id) {
        const tables = [
            'inquiry_item',
            'supplier_response',
            'promotion_items',
            'price_history',
            'item'
        ];

        for (const table of tables) {
            const columnName = 'item_id';
            const query = `DELETE FROM ${table} WHERE ${columnName} = ?`;
            debug.logQuery(`Delete from ${table}`, query, [item_id]);
            await this.executeRun(query, [item_id]);
        }
    }

    async _deleteItemReference(db, item_id) {
        const query = 'DELETE FROM item_reference_change WHERE original_item_id = ? OR new_reference_id = ?';
        debug.logQuery('Delete item reference', query, [item_id, item_id]);
        await this.executeRun(query, [item_id, item_id]);
    }

    async _checkItemExists(db, item_id) {
        const query = 'SELECT item_id FROM item WHERE item_id = ?';
        debug.logQuery('Check item exists', query, [item_id]);
        return await this.executeQuerySingle(query, [item_id]);
    }

    async _createReferenceItem(db, item_id) {
        await this._insertItemBase(db, {
            item_id,
            hebrew_description: 'REF - New Reference Item',
            english_description: 'REF - New Reference Item',
            import_markup: 1.30,
            origin: ''
        });

        await this._insertPriceHistory(db, {
            item_id,
            retail_price: null,
            qty_in_stock: 0,
            sold_this_year: 0,
            sold_last_year: 0
        });
    }

    async _deleteSelfReferences(db) {
        // Delete self-references from item_reference_change table
        const deleteRefQuery = 'DELETE FROM item_reference_change WHERE original_item_id = new_reference_id';
        debug.logQuery('Delete self references from item_reference_change', deleteRefQuery);
        await this.executeRun(deleteRefQuery);

        // Delete self-references from inquiry_item table
        const deleteInquiryQuery = 'UPDATE inquiry_item SET new_reference_id = NULL, reference_notes = NULL WHERE item_id = new_reference_id';
        debug.logQuery('Delete self references from inquiry_item', deleteInquiryQuery);
        await this.executeRun(deleteInquiryQuery);
    }

    async _insertReferenceChange(db, item_id, new_reference_id, supplier_id, notes) {
        const query = `
            INSERT INTO item_reference_change (
                original_item_id,
                new_reference_id,
                changed_by_user,
                supplier_id,
                notes,
                change_date
            ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        const params = [item_id, new_reference_id, !supplier_id, supplier_id, notes];
        debug.logQuery('Insert reference change', query, params);
        await this.executeRun(query, params);
    }
}

module.exports = ItemModel;
