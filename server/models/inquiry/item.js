const BaseModel = require('../BaseModel');
const debug = require('../../utils/debug');

class InquiryItemModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    /**
     * Get an existing item or create a new one with proper transaction isolation
     * @param {string} itemId - The item ID
     * @param {Object} itemData - Data for creating item if it doesn't exist
     * @returns {Promise<Object>} The existing or newly created item
     */
    async getOrCreateItem(itemId, itemData = {}) {
        return await this.executeTransaction(async () => {
            try {
                debug.log('Getting or creating item:', itemId);

                // First try to get existing item with transaction lock
                const existingItem = await this.executeQuerySingle(
                    'SELECT * FROM item WHERE item_id = ? FOR UPDATE',
                    [itemId]
                );

                if (existingItem) {
                    debug.log('Found existing item:', itemId);
                    return existingItem;
                }

                // If item doesn't exist, create it within the same transaction
                debug.log('Creating new item:', itemId);
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
                `;

                const params = [
                    itemId,
                    itemData.hebrew_description || `Unknown Item ${itemId}`,
                    itemData.english_description || '',
                    itemData.import_markup || 1.30,
                    itemData.hs_code || '',
                    itemData.image || '',
                    itemData.notes || '',
                    itemData.origin || ''
                ];

                try {
                    await this.executeRun(query, params);
                } catch (error) {
                    // If insert fails due to unique constraint, try to get the item again
                    // as it might have been created by another concurrent transaction
                    if (error.message.includes('UNIQUE constraint failed')) {
                        const concurrentItem = await this.executeQuerySingle(
                            'SELECT * FROM item WHERE item_id = ?',
                            [itemId]
                        );
                        if (concurrentItem) {
                            debug.log('Found concurrent item:', itemId);
                            return concurrentItem;
                        }
                    }
                    throw error;
                }

                // Insert initial history record with correct column names
                const historyQuery = `
                    INSERT INTO price_history (
                        item_id,
                        ils_retail_price,
                        qty_in_stock,
                        qty_sold_this_year,
                        qty_sold_last_year,
                        date
                    ) VALUES (?, NULL, 0, 0, 0, datetime('now'))
                `;
                await this.executeRun(historyQuery, [itemId]);

                // Return the newly created item
                return await this.executeQuerySingle(
                    'SELECT * FROM item WHERE item_id = ?',
                    [itemId]
                );
            } catch (error) {
                debug.error('Error in getOrCreateItem:', error);
                throw error;
            }
        });
    }

    async createInquiryItem(inquiry_id, itemData) {
        return await this.executeTransaction(async () => {
            try {
                debug.log('Creating inquiry item with data:', itemData);

                // Get or create the main item
                await this.getOrCreateItem(itemData.item_id, {
                    hebrew_description: itemData.hebrew_description,
                    english_description: itemData.english_description,
                    import_markup: itemData.import_markup,
                    hs_code: itemData.hs_code,
                    notes: itemData.notes,
                    origin: itemData.origin
                });

                // Handle reference item if needed
                if (itemData.new_reference_id && itemData.new_reference_id !== itemData.item_id) {
                    await this.getOrCreateItem(itemData.new_reference_id, {
                        hebrew_description: `Unknown Replacement for ${itemData.item_id}`,
                        notes: itemData.notes,
                        origin: itemData.origin
                    });
                } else {
                    // Clear new_reference_id if it's the same as item_id
                    itemData.new_reference_id = null;
                }

                // Insert the inquiry item
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

                // Create reference change if needed
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
        });
    }

    async updateInquiryItem(inquiry_item_id, updateData) {
        return await this.executeTransaction(async () => {
            try {
                debug.log('Updating inquiry item:', {
                    inquiry_item_id,
                    updateData
                });

                // Only proceed with reference update if new_reference_id is different from item_id
                if (updateData.new_reference_id && updateData.new_reference_id === updateData.item_id) {
                    updateData.new_reference_id = null;
                }

                // If there's a new reference, ensure it exists
                if (updateData.new_reference_id) {
                    await this.getOrCreateItem(updateData.new_reference_id, {
                        hebrew_description: `Unknown Replacement for ${updateData.item_id}`,
                        notes: updateData.notes,
                        origin: updateData.origin
                    });
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
        });
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

    async getInquiryItems(inquiryId) {
        try {
            const query = `
                SELECT 
                    ii.item_id,
                    i.hebrew_description,
                    i.english_description,
                    ii.requested_qty,
                    i.hs_code,
                    i.origin,
                    ii.reference_notes,
                    i.import_markup,
                    ph.ils_retail_price as retail_price
                FROM inquiry_item ii
                LEFT JOIN item i ON ii.item_id = i.item_id
                LEFT JOIN price_history ph ON i.item_id = ph.item_id
                    AND ph.date = (
                        SELECT MAX(date)
                        FROM price_history
                        WHERE item_id = i.item_id
                    )
                WHERE ii.inquiry_id = ?
                ORDER BY ii.inquiry_item_id
            `;

            const items = await this.executeQuery(query, [inquiryId]);
            debug.log('Retrieved inquiry items:', {
                inquiryId,
                count: items.length
            });

            return items;
        } catch (error) {
            debug.error('Error retrieving inquiry items:', error);
            throw error;
        }
    }
}

module.exports = InquiryItemModel;
