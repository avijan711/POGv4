const BaseModel = require('../BaseModel');
const debug = require('../../utils/debug');

class InquiryItemModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async createUnknownItem(item_id, description = 'Unknown New Item', notes = '', origin = '') {
        const query = `
            INSERT INTO item (
                item_id,
                hebrew_description,
                english_description,
                import_markup,
                hs_code,
                image,
                notes,
                origin,
                last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(item_id) DO NOTHING
        `;
        const params = [
            item_id,
            description,
            description,
            1.30,
            '',
            '',
            notes,
            origin
        ];

        try {
            await this.executeRun(query, params);

            // Insert initial history record
            const historyQuery = `
                INSERT INTO price_history (
                    item_id,
                    ils_retail_price,
                    qty_in_stock,
                    sold_this_year,
                    sold_last_year,
                    date
                ) VALUES (?, NULL, 0, 0, 0, datetime('now'))
            `;
            await this.executeRun(historyQuery, [item_id]);

            debug.log('Created unknown item:', item_id);
        } catch (error) {
            debug.error('Error creating unknown item:', error);
            throw error;
        }
    }

    async createInquiryItem(inquiry_id, itemData) {
        try {
            debug.log('Creating inquiry item with data:', itemData);

            // Check if main item exists, create if not
            const itemExists = await this.executeQuerySingle(
                'SELECT 1 FROM item WHERE item_id = ?',
                [itemData.item_id]
            );
            
            if (!itemExists) {
                await this.createUnknownItem(
                    itemData.item_id,
                    itemData.hebrew_description || `Unknown Item ${itemData.item_id}`,
                    itemData.notes || '',
                    itemData.origin || ''
                );
            } else {
                // Update existing item with new notes and origin if provided
                if (itemData.notes || itemData.origin) {
                    const updateQuery = `
                        UPDATE item 
                        SET notes = COALESCE(?, notes),
                            origin = COALESCE(?, origin),
                            last_updated = datetime('now')
                        WHERE item_id = ?
                    `;
                    await this.executeRun(updateQuery, [
                        itemData.notes,
                        itemData.origin,
                        itemData.item_id
                    ]);
                }
            }

            // Only proceed with reference handling if new_reference_id is different from item_id
            if (itemData.new_reference_id && itemData.new_reference_id !== itemData.item_id) {
                const exists = await this.executeQuerySingle(
                    'SELECT 1 FROM item WHERE item_id = ?',
                    [itemData.new_reference_id]
                );
                
                if (!exists) {
                    await this.createUnknownItem(
                        itemData.new_reference_id,
                        `Unknown Replacement for ${itemData.item_id}`,
                        itemData.notes || '',
                        itemData.origin || ''
                    );
                }
            } else {
                // Clear new_reference_id if it's the same as item_id
                itemData.new_reference_id = null;
            }

            const query = `
                INSERT INTO inquiry_item (
                    inquiry_id,
                    item_id,
                    original_item_id,
                    hebrew_description,
                    english_description,
                    import_markup,
                    hs_code,
                    retail_price,
                    qty_in_stock,
                    sold_this_year,
                    sold_last_year,
                    requested_qty,
                    new_reference_id,
                    reference_notes,
                    origin
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                inquiry_id,
                itemData.item_id,
                itemData.item_id,
                itemData.hebrew_description,
                itemData.english_description || '',
                itemData.import_markup || 1.3,
                itemData.hs_code || '',
                itemData.retail_price,
                itemData.qty_in_stock || 0,
                itemData.sold_this_year || 0,
                itemData.sold_last_year || 0,
                itemData.requested_qty || 0,
                itemData.new_reference_id || null,
                itemData.reference_notes || null,
                itemData.origin || ''
            ];

            debug.log('Executing inquiry item insert:', {
                query,
                params
            });

            await this.executeRun(query, params);

            // Only create reference change if new_reference_id is different from item_id
            if (itemData.new_reference_id && itemData.new_reference_id !== itemData.item_id) {
                const referenceQuery = `
                    INSERT INTO item_reference_change (
                        original_item_id,
                        new_reference_id,
                        changed_by_user,
                        notes,
                        change_date
                    ) VALUES (?, ?, 1, ?, datetime('now'))
                `;

                const referenceParams = [
                    itemData.item_id,
                    itemData.new_reference_id,
                    itemData.reference_notes || 'Reference from inquiry upload'
                ];

                debug.log('Executing reference change insert:', {
                    query: referenceQuery,
                    params: referenceParams
                });

                await this.executeRun(referenceQuery, referenceParams);
            }

            debug.log('Created inquiry item:', {
                inquiry_id,
                item_id: itemData.item_id,
                reference_id: itemData.new_reference_id
            });
        } catch (error) {
            debug.error('Error creating inquiry item:', error);
            throw error;
        }
    }

    async updateInquiryItem(inquiry_item_id, updateData) {
        try {
            debug.log('Updating inquiry item:', {
                inquiry_item_id,
                updateData
            });

            // Only proceed with reference update if new_reference_id is different from item_id
            if (updateData.new_reference_id && updateData.new_reference_id === updateData.item_id) {
                updateData.new_reference_id = null;
            }

            const query = `
                UPDATE inquiry_item SET
                    requested_qty = COALESCE(?, requested_qty),
                    new_reference_id = COALESCE(?, new_reference_id),
                    reference_notes = COALESCE(?, reference_notes),
                    origin = COALESCE(?, origin)
                WHERE inquiry_item_id = ?
            `;

            const params = [
                updateData.requested_qty,
                updateData.new_reference_id,
                updateData.reference_notes,
                updateData.origin,
                inquiry_item_id
            ];

            debug.log('Executing inquiry item update:', {
                query,
                params
            });

            const result = await this.executeRun(query, params);

            if (result.changes === 0) {
                throw new Error('Inquiry item not found');
            }

            // Update item notes and origin if provided
            if (updateData.notes || updateData.origin) {
                const itemUpdateQuery = `
                    UPDATE item 
                    SET notes = COALESCE(?, notes),
                        origin = COALESCE(?, origin),
                        last_updated = datetime('now')
                    WHERE item_id = ?
                `;
                await this.executeRun(itemUpdateQuery, [
                    updateData.notes,
                    updateData.origin,
                    updateData.item_id
                ]);
            }

            // Only create reference change if new_reference_id is different from item_id
            if (updateData.new_reference_id && updateData.new_reference_id !== updateData.item_id) {
                const exists = await this.executeQuerySingle(
                    'SELECT 1 FROM item WHERE item_id = ?',
                    [updateData.new_reference_id]
                );

                if (!exists) {
                    await this.createUnknownItem(
                        updateData.new_reference_id,
                        `Unknown Replacement for ${updateData.item_id}`,
                        updateData.notes || '',
                        updateData.origin || ''
                    );
                }

                const referenceQuery = `
                    INSERT INTO item_reference_change (
                        original_item_id,
                        new_reference_id,
                        changed_by_user,
                        notes,
                        change_date
                    ) VALUES (?, ?, 1, ?, datetime('now'))
                `;

                await this.executeRun(referenceQuery, [
                    updateData.item_id,
                    updateData.new_reference_id,
                    updateData.reference_notes || 'Reference from inquiry update'
                ]);
            }

            debug.log('Updated inquiry item:', {
                inquiry_item_id,
                changes: result.changes
            });
        } catch (error) {
            debug.error('Error updating inquiry item:', error);
            throw error;
        }
    }

    async deleteByInquiryId(inquiry_id) {
        return this.executeTransaction(async () => {
            try {
                // First delete supplier response items
                await this.executeRun(`
                    DELETE FROM supplier_response_item 
                    WHERE supplier_response_id IN (
                        SELECT supplier_response_id 
                        FROM supplier_response 
                        WHERE inquiry_id = ?
                    )`, [inquiry_id]
                );

                // Then delete supplier responses
                await this.executeRun(
                    'DELETE FROM supplier_response WHERE inquiry_id = ?',
                    [inquiry_id]
                );

                const result = await this.executeRun(
                    'DELETE FROM inquiry_item WHERE inquiry_id = ?',
                    [inquiry_id]
                );

                debug.log('Deleted inquiry items:', {
                    inquiry_id,
                    deletedCount: result.changes
                });

                return result.changes > 0;
            } catch (error) {
                debug.error('Error deleting inquiry items:', error);
                throw error;
            }
        });
    }

    async updateQuantity(inquiry_item_id, requested_qty) {
        try {
            // First check if the inquiry item exists
            const item = await this.executeQuerySingle(
                'SELECT inquiry_item_id FROM inquiry_item WHERE inquiry_item_id = ?',
                [inquiry_item_id]
            );

            if (!item) {
                debug.error('Inquiry item not found:', inquiry_item_id);
                throw new Error(`Inquiry item with ID ${inquiry_item_id} not found`);
            }

            const query = `
                UPDATE inquiry_item 
                SET requested_qty = ? 
                WHERE inquiry_item_id = ?
            `;

            const result = await this.executeRun(query, [requested_qty, inquiry_item_id]);

            if (result.changes === 0) {
                debug.error('No rows updated for inquiry item:', inquiry_item_id);
                throw new Error(`Failed to update quantity for inquiry item ${inquiry_item_id}`);
            }

            debug.log('Updated item quantity:', {
                inquiry_item_id,
                requested_qty,
                changes: result.changes
            });

            return true;
        } catch (error) {
            debug.error('Error updating item quantity:', error);
            throw error;
        }
    }

    async deleteItem(inquiry_item_id) {
        return this.executeTransaction(async () => {
            try {
                // First check if the inquiry item exists
                const item = await this.executeQuerySingle(
                    'SELECT inquiry_item_id, inquiry_id, item_id FROM inquiry_item WHERE inquiry_item_id = ?',
                    [inquiry_item_id]
                );

                if (!item) {
                    debug.error('Inquiry item not found:', inquiry_item_id);
                    throw new Error(`Inquiry item with ID ${inquiry_item_id} not found`);
                }

                // Delete supplier response items first
                await this.executeRun(`
                    DELETE FROM supplier_response_item 
                    WHERE supplier_response_id IN (
                        SELECT supplier_response_id 
                        FROM supplier_response 
                        WHERE inquiry_id = ? AND item_id = ?
                    )`, [item.inquiry_id, item.item_id]
                );

                // Then delete supplier responses
                await this.executeRun(
                    'DELETE FROM supplier_response WHERE inquiry_id = ? AND item_id = ?',
                    [item.inquiry_id, item.item_id]
                );

                // Finally delete the inquiry item
                const result = await this.executeRun(
                    'DELETE FROM inquiry_item WHERE inquiry_item_id = ?',
                    [inquiry_item_id]
                );

                if (result.changes === 0) {
                    debug.error('No rows deleted for inquiry item:', inquiry_item_id);
                    throw new Error(`Failed to delete inquiry item ${inquiry_item_id}`);
                }

                debug.log('Deleted inquiry item:', {
                    inquiry_item_id,
                    changes: result.changes
                });

                return true;
            } catch (error) {
                debug.error('Error deleting inquiry item:', error);
                throw error;
            }
        });
    }
}

module.exports = InquiryItemModel;
