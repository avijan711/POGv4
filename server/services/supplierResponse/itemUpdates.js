const debug = require('../../utils/debug');

class ItemUpdates {
    constructor(db) {
        this.db = db;
    }

    async verifyItemExists(itemId, inquiryId) {
        return new Promise((resolve, reject) => {
            // First check if the item exists in inquiry_item table for this inquiry
            this.db.get(
                'SELECT 1 FROM inquiry_item WHERE item_id = ? AND inquiry_id = ?',
                [itemId, inquiryId],
                (err, inquiryRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!inquiryRow) {
                        resolve({
                            existsInInquiry: false,
                            existsInItemTable: false
                        });
                        return;
                    }

                    // If item exists in inquiry_item, check if it exists in main item table
                    this.db.get(
                        'SELECT 1 FROM item WHERE item_id = ?',
                        [itemId],
                        (err, itemRow) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve({
                                existsInInquiry: true,
                                existsInItemTable: !!itemRow
                            });
                        }
                    );
                }
            );
        });
    }

    async createUnknownItem(itemId, inquiryId) {
        // First verify this item exists in inquiry_item table
        const inquiryItem = await new Promise((resolve, reject) => {
            this.db.get(
                `SELECT hebrew_description, english_description, import_markup, hs_code, origin 
                 FROM inquiry_item WHERE item_id = ? AND inquiry_id = ?`,
                [itemId, inquiryId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row);
                }
            );
        });

        if (!inquiryItem) {
            throw new Error(`Item ${itemId} not found in inquiry ${inquiryId}`);
        }

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO item (
                    item_id, hebrew_description, english_description, import_markup, hs_code, origin
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    itemId,
                    inquiryItem.hebrew_description || 'Unknown New Item',
                    inquiryItem.english_description || 'Unknown New Item',
                    inquiryItem.import_markup || 1.30,
                    inquiryItem.hs_code || '',
                    inquiryItem.origin || ''
                ],
                async (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Insert initial history record
                    try {
                        await this.db.run(
                            `INSERT INTO price_history (
                                item_id, ils_retail_price, qty_in_stock, 
                                qty_sold_this_year, qty_sold_last_year, date
                            ) VALUES (?, NULL, 0, 0, 0, datetime('now'))`,
                            [itemId]
                        );
                        resolve();
                    } catch (historyErr) {
                        reject(historyErr);
                    }
                }
            );
        });
    }

    async updateItemDetails(itemId, updates) {
        debug.log('Updating item details:', { itemId, updates });

        const fields = ['hs_code', 'english_description', 'origin'];
        const validUpdates = {};
        const params = [];
        
        // Build update fields and params
        fields.forEach(field => {
            if (field in updates) {
                validUpdates[field] = `${field} = ?`;
                params.push(updates[field] || '');
            }
        });

        if (Object.keys(validUpdates).length === 0) {
            debug.log('No valid updates provided');
            return;
        }

        params.push(itemId); // Add itemId as the last parameter

        const updateFields = Object.values(validUpdates).join(', ');
        
        // Update item table
        await new Promise((resolve, reject) => {
            const itemSql = `UPDATE item SET ${updateFields} WHERE item_id = ?`;
            
            this.db.run(itemSql, params, (err) => {
                if (err) {
                    debug.error('Error updating item details:', err);
                    reject(err);
                } else {
                    debug.log('Item details updated successfully');
                    resolve();
                }
            });
        });

        // Update inquiry_item table with the same updates
        await new Promise((resolve, reject) => {
            const inquirySql = `UPDATE inquiry_item SET ${updateFields} WHERE item_id = ?`;
            
            this.db.run(inquirySql, params, (err) => {
                if (err) {
                    debug.error('Error updating inquiry_item details:', err);
                    reject(err);
                } else {
                    debug.log('Inquiry item details updated successfully');
                    resolve();
                }
            });
        });
    }

    async updateInquiryItemReference(itemId, newReferenceId, notes, inquiryId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE inquiry_item SET 
                new_reference_id = ?,
                reference_notes = ?
            WHERE item_id = ? AND inquiry_id = ?`;
            const params = [
                newReferenceId,
                notes || 'Replacement from supplier response',
                itemId,
                inquiryId
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    debug.error('Error updating inquiry_item:', err);
                    reject(err);
                } else {
                    debug.log('inquiry_item updated');
                    resolve();
                }
            });
        });
    }
}

module.exports = ItemUpdates;
