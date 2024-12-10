const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');
const { cleanItemId } = require('../utils/itemIdCleaner');

class ItemModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async getAllItems() {
        const sql = `
            SELECT 
                i.*,
                p.ils_retail_price as retail_price,
                p.qty_in_stock,
                p.sold_this_year,
                p.sold_last_year,
                p.date as last_price_update
            FROM item i
            LEFT JOIN (
                SELECT *
                FROM price_history ph1
                WHERE ph1.date = (
                    SELECT MAX(date)
                    FROM price_history ph2
                    WHERE ph2.item_id = ph1.item_id
                )
            ) p ON i.item_id = p.item_id
            ORDER BY i.item_id
        `;
        return await this.executeQuery(sql);
    }

    async getItemById(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            SELECT 
                i.*,
                p.ils_retail_price as retail_price,
                p.qty_in_stock,
                p.sold_this_year,
                p.sold_last_year,
                p.date as last_price_update
            FROM item i
            LEFT JOIN (
                SELECT *
                FROM price_history ph1
                WHERE ph1.date = (
                    SELECT MAX(date)
                    FROM price_history ph2
                    WHERE ph2.item_id = ph1.item_id
                )
            ) p ON i.item_id = p.item_id
            WHERE i.item_id = ?
        `;
        return await this.executeQuerySingle(sql, [cleanedId]);
    }

    async getPriceHistory(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            SELECT 
                date,
                ils_retail_price,
                qty_in_stock,
                sold_this_year,
                sold_last_year
            FROM price_history
            WHERE item_id = ?
            ORDER BY date DESC
        `;
        return await this.executeQuery(sql, [cleanedId]);
    }

    async getSupplierPrices(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            SELECT 
                s.name as supplier_name,
                sr.price_quoted,
                sr.response_date,
                sr.status,
                sr.is_promotion,
                sr.promotion_name
            FROM supplier_response sr
            JOIN supplier s ON sr.supplier_id = s.supplier_id
            WHERE sr.item_id = ?
            ORDER BY sr.response_date DESC
        `;
        return await this.executeQuery(sql, [cleanedId]);
    }

    async getReferenceChanges(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            SELECT 
                rc.original_item_id,
                rc.new_reference_id,
                s.name as supplier_name,
                rc.changed_by_user,
                rc.change_date,
                rc.notes,
                i1.hebrew_description as original_description,
                i2.hebrew_description as new_description
            FROM item_reference_change rc
            LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
            LEFT JOIN item i1 ON rc.original_item_id = i1.item_id
            LEFT JOIN item i2 ON rc.new_reference_id = i2.item_id
            WHERE rc.original_item_id = ? OR rc.new_reference_id = ?
            ORDER BY rc.change_date DESC
        `;
        return await this.executeQuery(sql, [cleanedId, cleanedId]);
    }

    async getItemFiles(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            SELECT id, file_path, file_type, upload_date, description
            FROM item_files
            WHERE item_id = ?
            ORDER BY upload_date DESC
        `;
        return await this.executeQuery(sql, [cleanedId]);
    }

    async addItemFiles(itemId, files) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            INSERT INTO item_files (item_id, file_path, file_type, description)
            VALUES (?, ?, ?, ?)
        `;
        
        return await this.executeTransaction(async () => {
            const results = [];
            for (const file of files) {
                const result = await this.executeRun(sql, [
                    cleanedId,
                    file.filename,
                    file.mimetype,
                    file.originalname
                ]);
                results.push(result);
            }
            return results;
        });
    }

    async deleteItemFile(itemId, fileId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            DELETE FROM item_files
            WHERE id = ? AND item_id = ?
        `;
        return await this.executeRun(sql, [fileId, cleanedId]);
    }

    async createItem(itemData) {
        try {
            // Clean item ID
            const cleanedItemId = cleanItemId(itemData.itemID);
            
            // Check if item already exists
            const existingItem = await this.executeQuerySingle(
                'SELECT item_id FROM item WHERE item_id = ?',
                [cleanedItemId]
            );

            if (existingItem) {
                const error = new Error('Item already exists');
                error.code = 'DUPLICATE_ITEM';
                throw error;
            }

            return await this.executeTransaction(async () => {
                const {
                    hebrewDescription,
                    englishDescription,
                    importMarkup,
                    hsCode,
                    image,
                    qtyInStock,
                    soldThisYear,
                    soldLastYear,
                    retailPrice,
                    notes
                } = itemData;

                // Insert into item table
                const itemSql = `
                    INSERT INTO item (
                        item_id, hebrew_description, english_description, 
                        import_markup, hs_code, image, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                await this.executeRun(itemSql, [
                    cleanedItemId, hebrewDescription, englishDescription,
                    importMarkup, hsCode, image, notes
                ]);

                // Insert initial price history
                if (retailPrice !== null || qtyInStock !== null || 
                    soldThisYear !== null || soldLastYear !== null) {
                    const priceSql = `
                        INSERT INTO price_history (
                            item_id, ils_retail_price, qty_in_stock,
                            sold_this_year, sold_last_year
                        ) VALUES (?, ?, ?, ?, ?)
                    `;
                    await this.executeRun(priceSql, [
                        cleanedItemId, retailPrice, qtyInStock,
                        soldThisYear, soldLastYear
                    ]);
                }

                // Return the created item
                return await this.getItemById(cleanedItemId);
            });
        } catch (error) {
            if (error.code === 'DUPLICATE_ITEM') {
                throw error;
            }
            if (error.message.includes('UNIQUE constraint failed')) {
                const duplicateError = new Error('Item already exists');
                duplicateError.code = 'DUPLICATE_ITEM';
                throw duplicateError;
            }
            throw error;
        }
    }

    async updateItem(itemId, updateData) {
        const cleanedId = cleanItemId(itemId);
        return await this.executeTransaction(async () => {
            const {
                hebrewDescription,
                englishDescription,
                importMarkup,
                hsCode,
                image,
                qtyInStock,
                soldThisYear,
                soldLastYear,
                retailPrice,
                notes
            } = updateData;

            // Update item table
            const itemSql = `
                UPDATE item 
                SET hebrew_description = ?,
                    english_description = ?,
                    import_markup = ?,
                    hs_code = ?,
                    notes = ?
                    ${image ? ', image = ?' : ''}
                WHERE item_id = ?
            `;
            const itemParams = [
                hebrewDescription,
                englishDescription,
                importMarkup,
                hsCode,
                notes
            ];
            if (image) itemParams.push(image);
            itemParams.push(cleanedId);
            
            await this.executeRun(itemSql, itemParams);

            // Insert new price history if any price-related fields changed
            if (retailPrice !== null || qtyInStock !== null || 
                soldThisYear !== null || soldLastYear !== null) {
                const priceSql = `
                    INSERT INTO price_history (
                        item_id, ils_retail_price, qty_in_stock,
                        sold_this_year, sold_last_year
                    ) VALUES (?, ?, ?, ?, ?)
                `;
                await this.executeRun(priceSql, [
                    cleanedId, retailPrice, qtyInStock,
                    soldThisYear, soldLastYear
                ]);
            }
        });
    }

    async updateNotes(itemId, notes) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            UPDATE item 
            SET notes = ?
            WHERE item_id = ?
        `;
        await this.executeRun(sql, [notes, cleanedId]);
        return await this.getItemById(cleanedId);
    }

    async deleteItem(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = 'DELETE FROM item WHERE item_id = ?';
        await this.executeRun(sql, [cleanedId]);
    }

    async addReferenceChange(originalItemId, newReferenceId, supplierId, notes) {
        const cleanedOriginalId = cleanItemId(originalItemId);
        const cleanedRefId = cleanItemId(newReferenceId);
        const sql = `
            INSERT INTO item_reference_change (
                original_item_id, new_reference_id, supplier_id,
                changed_by_user, notes, change_date
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        await this.executeRun(sql, [
            cleanedOriginalId,
            cleanedRefId,
            supplierId || null,
            supplierId ? 0 : 1,
            notes
        ]);
    }
}

module.exports = ItemModel;
