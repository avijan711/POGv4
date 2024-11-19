const BaseModel = require('../BaseModel');
const debug = require('../../utils/debug');

class InquiryItemModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async createUnknownItem(itemId, description = 'Unknown New Item') {
        const query = `
            INSERT INTO Item (
                ItemID,
                HebrewDescription,
                EnglishDescription,
                ImportMarkup,
                HSCode,
                Image
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(ItemID) DO NOTHING
        `;
        const params = [
            itemId,
            description,
            description,
            1.30,
            '',
            ''
        ];

        try {
            await this.executeRun(query, params);

            // Insert initial history record
            const historyQuery = `
                INSERT INTO ItemHistory (
                    ItemID,
                    ILSRetailPrice,
                    QtyInStock,
                    QtySoldThisYear,
                    QtySoldLastYear,
                    Date
                ) VALUES (?, NULL, 0, 0, 0, datetime('now'))
            `;
            await this.executeRun(historyQuery, [itemId]);

            debug.log('Created unknown item:', itemId);
        } catch (error) {
            debug.error('Error creating unknown item:', error);
            throw error;
        }
    }

    async createInquiryItem(inquiryId, itemData) {
        try {
            // Only proceed with reference handling if newReferenceID is different from itemId
            if (itemData.newReferenceID && itemData.newReferenceID !== itemData.itemId) {
                const exists = await this.executeQuerySingle(
                    'SELECT 1 FROM Item WHERE ItemID = ?',
                    [itemData.newReferenceID]
                );
                
                if (!exists) {
                    await this.createUnknownItem(
                        itemData.newReferenceID,
                        `Unknown Replacement for ${itemData.itemId}`
                    );
                }
            } else {
                // Clear newReferenceID if it's the same as itemId
                itemData.newReferenceID = null;
            }

            const query = `
                INSERT INTO InquiryItem (
                    InquiryID,
                    ItemID,
                    OriginalItemID,
                    HebrewDescription,
                    EnglishDescription,
                    ImportMarkup,
                    HSCode,
                    QtyInStock,
                    RetailPrice,
                    SoldThisYear,
                    SoldLastYear,
                    RequestedQty,
                    NewReferenceID,
                    ReferenceNotes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                inquiryId,
                itemData.itemId, // Always use the original itemId
                itemData.itemId, // Store original itemId
                itemData.hebrewDescription,
                itemData.englishDescription || '',
                itemData.importMarkup || 1.3,
                itemData.hsCode || '',
                itemData.currentStock || 0,
                itemData.retailPrice,
                itemData.soldThisYear || 0,
                itemData.soldLastYear || 0,
                itemData.requestedQuantity || 0,
                itemData.newReferenceID || null,
                itemData.referenceNotes || null
            ];

            await this.executeRun(query, params);

            // Only create reference change if newReferenceID is different from itemId
            if (itemData.newReferenceID && itemData.newReferenceID !== itemData.itemId) {
                const referenceQuery = `
                    INSERT INTO ItemReferenceChange (
                        OriginalItemID,
                        NewReferenceID,
                        ChangedByUser,
                        Notes,
                        ChangeDate
                    ) VALUES (?, ?, 1, ?, datetime('now'))
                `;

                await this.executeRun(referenceQuery, [
                    itemData.itemId,
                    itemData.newReferenceID,
                    itemData.referenceNotes || 'Reference from inquiry upload'
                ]);
            }

            debug.log('Created inquiry item:', {
                inquiryId,
                itemId: itemData.itemId,
                referenceId: itemData.newReferenceID
            });
        } catch (error) {
            debug.error('Error creating inquiry item:', error);
            throw error;
        }
    }

    async updateInquiryItem(inquiryItemId, updateData) {
        try {
            // Only proceed with reference update if newReferenceID is different from itemId
            if (updateData.newReferenceID && updateData.newReferenceID === updateData.itemId) {
                updateData.newReferenceID = null;
            }

            const query = `
                UPDATE InquiryItem SET
                    RequestedQty = COALESCE(?, RequestedQty),
                    NewReferenceID = COALESCE(?, NewReferenceID),
                    ReferenceNotes = COALESCE(?, ReferenceNotes)
                WHERE InquiryItemID = ?
            `;

            const params = [
                updateData.requestedQty,
                updateData.newReferenceID,
                updateData.referenceNotes,
                inquiryItemId
            ];

            const result = await this.executeRun(query, params);

            if (result.changes === 0) {
                throw new Error('Inquiry item not found');
            }

            // Only create reference change if newReferenceID is different from itemId
            if (updateData.newReferenceID && updateData.newReferenceID !== updateData.itemId) {
                const exists = await this.executeQuerySingle(
                    'SELECT 1 FROM Item WHERE ItemID = ?',
                    [updateData.newReferenceID]
                );

                if (!exists) {
                    await this.createUnknownItem(
                        updateData.newReferenceID,
                        `Unknown Replacement for ${updateData.itemId}`
                    );
                }

                const referenceQuery = `
                    INSERT INTO ItemReferenceChange (
                        OriginalItemID,
                        NewReferenceID,
                        ChangedByUser,
                        Notes,
                        ChangeDate
                    ) VALUES (?, ?, 1, ?, datetime('now'))
                `;

                await this.executeRun(referenceQuery, [
                    updateData.itemId,
                    updateData.newReferenceID,
                    updateData.referenceNotes || 'Reference from inquiry update'
                ]);
            }

            debug.log('Updated inquiry item:', {
                inquiryItemId,
                changes: result.changes
            });
        } catch (error) {
            debug.error('Error updating inquiry item:', error);
            throw error;
        }
    }

    async deleteByInquiryId(inquiryId) {
        return this.executeTransaction(async () => {
            try {
                // First delete supplier response items
                await this.executeRun(`
                    DELETE FROM SupplierResponseItem 
                    WHERE SupplierResponseID IN (
                        SELECT SupplierResponseID 
                        FROM SupplierResponse 
                        WHERE InquiryID = ?
                    )`, [inquiryId]
                );

                // Then delete supplier responses
                await this.executeRun(
                    'DELETE FROM SupplierResponse WHERE InquiryID = ?',
                    [inquiryId]
                );

                const result = await this.executeRun(
                    'DELETE FROM InquiryItem WHERE InquiryID = ?',
                    [inquiryId]
                );

                debug.log('Deleted inquiry items:', {
                    inquiryId,
                    deletedCount: result.changes
                });

                return result.changes > 0;
            } catch (error) {
                debug.error('Error deleting inquiry items:', error);
                throw error;
            }
        });
    }

    async updateQuantity(inquiryItemId, requestedQty) {
        try {
            // First check if the inquiry item exists
            const item = await this.executeQuerySingle(
                'SELECT InquiryItemID FROM InquiryItem WHERE InquiryItemID = ?',
                [inquiryItemId]
            );

            if (!item) {
                debug.error('Inquiry item not found:', inquiryItemId);
                throw new Error(`Inquiry item with ID ${inquiryItemId} not found`);
            }

            const query = `
                UPDATE InquiryItem 
                SET RequestedQty = ? 
                WHERE InquiryItemID = ?
            `;

            const result = await this.executeRun(query, [requestedQty, inquiryItemId]);

            if (result.changes === 0) {
                debug.error('No rows updated for inquiry item:', inquiryItemId);
                throw new Error(`Failed to update quantity for inquiry item ${inquiryItemId}`);
            }

            debug.log('Updated item quantity:', {
                inquiryItemId,
                requestedQty,
                changes: result.changes
            });

            return true;
        } catch (error) {
            debug.error('Error updating item quantity:', error);
            throw error;
        }
    }

    async deleteItem(inquiryItemId) {
        return this.executeTransaction(async () => {
            try {
                // First check if the inquiry item exists
                const item = await this.executeQuerySingle(
                    'SELECT InquiryItemID, InquiryID, ItemID FROM InquiryItem WHERE InquiryItemID = ?',
                    [inquiryItemId]
                );

                if (!item) {
                    debug.error('Inquiry item not found:', inquiryItemId);
                    throw new Error(`Inquiry item with ID ${inquiryItemId} not found`);
                }

                // Delete supplier response items first
                await this.executeRun(`
                    DELETE FROM SupplierResponseItem 
                    WHERE SupplierResponseID IN (
                        SELECT SupplierResponseID 
                        FROM SupplierResponse 
                        WHERE InquiryID = ? AND ItemID = ?
                    )`, [item.InquiryID, item.ItemID]
                );

                // Then delete supplier responses
                await this.executeRun(
                    'DELETE FROM SupplierResponse WHERE InquiryID = ? AND ItemID = ?',
                    [item.InquiryID, item.ItemID]
                );

                // Finally delete the inquiry item
                const result = await this.executeRun(
                    'DELETE FROM InquiryItem WHERE InquiryItemID = ?',
                    [inquiryItemId]
                );

                if (result.changes === 0) {
                    debug.error('No rows deleted for inquiry item:', inquiryItemId);
                    throw new Error(`Failed to delete inquiry item ${inquiryItemId}`);
                }

                debug.log('Deleted inquiry item:', {
                    inquiryItemId,
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
