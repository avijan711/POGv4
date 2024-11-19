const BaseModel = require('./BaseModel');
const getAllItemsQuery = require('./queries/items/getAllItems');
const getItemByIdQuery = require('./queries/items/getItemById');
const debug = require('../utils/debug');
const itemUtils = require('../utils/itemUtils');

class ItemModel extends BaseModel {
    constructor(db) {
        super(db);
        this.jsonFields = ['referenceChange', 'referencingItems', 'priceHistory', 'supplierPrices', 'promotions'];
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

    async getItemById(itemId) {
        try {
            debug.time('getItemById');
            debug.log('Getting item by ID:', itemId);

            // The query needs itemId three times - for PriceHistory and twice for BaseItems
            const params = [itemId, itemId, itemId];
            const row = await this.executeQuerySingle(getItemByIdQuery, params);

            if (!row) {
                debug.log('No item found for ID:', itemId);
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
                    await this._insertItemHistory(db, formattedData);
                }
            });

            return formattedData;
        } catch (err) {
            debug.error('Error creating item:', err);
            throw err;
        }
    }

    async updateItem(itemId, data) {
        try {
            const validation = itemUtils.validateItemData({ ...data, itemID: itemId });
            if (!validation.isValid) {
                throw new Error(`Invalid item data: ${validation.errors.join(', ')}`);
            }

            const formattedData = itemUtils.formatItemData({ ...data, itemID: itemId });
            await this.executeTransaction(async (db) => {
                await this._updateItemBase(db, itemId, formattedData);
                if (itemUtils.hasRetailPrice(formattedData)) {
                    await this._insertItemHistory(db, formattedData);
                }
            });
        } catch (err) {
            debug.error('Error updating item:', err);
            throw err;
        }
    }

    async deleteItem(itemId) {
        try {
            await this.executeTransaction(async (db) => {
                await this._deleteItemReference(db, itemId);
                await this._deleteRelatedRecords(db, itemId);
            });
        } catch (err) {
            debug.error('Error deleting item:', err);
            throw err;
        }
    }

    async addReferenceChange(itemId, newReferenceId, supplierId, notes) {
        if (itemId === newReferenceId) return;

        try {
            await this.executeTransaction(async (db) => {
                const existingItem = await this._checkItemExists(db, newReferenceId);
                if (!existingItem) {
                    await this._createReferenceItem(db, newReferenceId);
                }

                await this._deleteSelfReferences(db);
                await this._insertReferenceChange(db, itemId, newReferenceId, supplierId, notes);
            });
        } catch (err) {
            debug.error('Error adding reference change:', err);
            throw err;
        }
    }

    async _insertItemBase(db, data) {
        const query = `
            INSERT INTO Item (
                ItemID,
                HebrewDescription,
                EnglishDescription,
                ImportMarkup,
                HSCode,
                Image
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.itemID,
            data.hebrewDescription,
            data.englishDescription || '',
            data.importMarkup || 1.30,
            data.hsCode || '',
            data.image || ''
        ];

        debug.logQuery('Insert item base', query, params);
        await this.executeRun(query, params);
    }

    async _insertItemHistory(db, data) {
        const query = `
            INSERT INTO ItemHistory (
                ItemID,
                ILSRetailPrice,
                QtyInStock,
                QtySoldThisYear,
                QtySoldLastYear,
                Date
            ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        const params = [
            data.itemID,
            data.retailPrice,
            data.qtyInStock || 0,
            data.soldThisYear || 0,
            data.soldLastYear || 0
        ];

        debug.logQuery('Insert item history', query, params);
        await this.executeRun(query, params);
    }

    async _updateItemBase(db, itemId, data) {
        // First get current item data
        const currentItem = await this.getItemById(itemId);
        if (!currentItem) {
            throw new Error('Item not found');
        }

        const query = `
            UPDATE Item SET 
                HebrewDescription = COALESCE(?, HebrewDescription),
                EnglishDescription = COALESCE(?, EnglishDescription),
                ImportMarkup = COALESCE(?, ImportMarkup),
                HSCode = COALESCE(?, HSCode)
                ${data.image ? ', Image = ?' : ''}
            WHERE ItemID = ?
        `;

        const params = [
            data.hebrewDescription || currentItem.hebrewDescription,
            data.englishDescription !== undefined ? data.englishDescription : currentItem.englishDescription,
            data.importMarkup || currentItem.importMarkup,
            data.hsCode !== undefined ? data.hsCode : currentItem.hsCode,
            ...(data.image ? [data.image] : []),
            itemId
        ];

        debug.logQuery('Update item base', query, params);
        const result = await this.executeRun(query, params);
        if (result.changes === 0) {
            throw new Error('Item not found');
        }

        // Update history if retail price or quantities changed
        if (data.retailPrice !== undefined || 
            data.qtyInStock !== undefined || 
            data.soldThisYear !== undefined || 
            data.soldLastYear !== undefined) {
            
            const historyData = {
                itemID: itemId,
                retailPrice: data.retailPrice !== undefined ? data.retailPrice : currentItem.retailPrice,
                qtyInStock: data.qtyInStock !== undefined ? data.qtyInStock : currentItem.qtyInStock,
                soldThisYear: data.soldThisYear !== undefined ? data.soldThisYear : currentItem.soldThisYear,
                soldLastYear: data.soldLastYear !== undefined ? data.soldLastYear : currentItem.soldLastYear
            };

            await this._insertItemHistory(db, historyData);
        }
    }

    async _deleteRelatedRecords(db, itemId) {
        const tables = [
            'InquiryItem',
            'SupplierResponse',
            'promotion_items',
            'ItemHistory',
            'Item'
        ];

        for (const table of tables) {
            const columnName = table === 'promotion_items' ? 'item_id' : 'ItemID';
            const query = `DELETE FROM ${table} WHERE ${columnName} = ?`;
            debug.logQuery(`Delete from ${table}`, query, [itemId]);
            await this.executeRun(query, [itemId]);
        }
    }

    async _deleteItemReference(db, itemId) {
        const query = 'DELETE FROM ItemReferenceChange WHERE OriginalItemID = ? OR NewReferenceID = ?';
        debug.logQuery('Delete item reference', query, [itemId, itemId]);
        await this.executeRun(query, [itemId, itemId]);
    }

    async _checkItemExists(db, itemId) {
        const query = 'SELECT ItemID FROM Item WHERE ItemID = ?';
        debug.logQuery('Check item exists', query, [itemId]);
        return await this.executeQuerySingle(query, [itemId]);
    }

    async _createReferenceItem(db, itemId) {
        await this._insertItemBase(db, {
            itemID: itemId,
            hebrewDescription: 'REF - New Reference Item',
            englishDescription: 'REF - New Reference Item',
            importMarkup: 1.30
        });

        await this._insertItemHistory(db, {
            itemID: itemId,
            retailPrice: null,
            qtyInStock: 0,
            soldThisYear: 0,
            soldLastYear: 0
        });
    }

    async _deleteSelfReferences(db) {
        // Delete self-references from ItemReferenceChange table
        const deleteRefQuery = 'DELETE FROM ItemReferenceChange WHERE OriginalItemID = NewReferenceID';
        debug.logQuery('Delete self references from ItemReferenceChange', deleteRefQuery);
        await this.executeRun(deleteRefQuery);

        // Delete self-references from InquiryItem table
        const deleteInquiryQuery = 'UPDATE InquiryItem SET NewReferenceID = NULL, ReferenceNotes = NULL WHERE ItemID = NewReferenceID';
        debug.logQuery('Delete self references from InquiryItem', deleteInquiryQuery);
        await this.executeRun(deleteInquiryQuery);
    }

    async _insertReferenceChange(db, itemId, newReferenceId, supplierId, notes) {
        const query = `
            INSERT INTO ItemReferenceChange (
                OriginalItemID,
                NewReferenceID,
                ChangedByUser,
                SupplierID,
                Notes,
                ChangeDate
            ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        const params = [itemId, newReferenceId, !supplierId, supplierId, notes];
        debug.logQuery('Insert reference change', query, params);
        await this.executeRun(query, params);
    }
}

module.exports = ItemModel;
