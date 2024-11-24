const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');
const { getInquiriesQuery, getInquiryByIdQuery } = require('./queries/inquiries');
const ItemModel = require('./item');
const InquiryItemModel = require('./inquiry/item');
const itemUtils = require('../utils/itemUtils');

class InquiryModel extends BaseModel {
    constructor(db) {
        super(db);
        this.itemModel = new ItemModel(db);
        this.inquiryItemModel = new InquiryItemModel(db);
    }

    async getAllInquiries(status) {
        const timerLabel = 'getAllInquiries';
        debug.time(timerLabel);
        debug.log('Getting all inquiries with status:', status);

        try {
            const queryTimerLabel = 'getAllInquiries.query';
            debug.time(queryTimerLabel);
            const params = status ? [status] : [];
            const results = await this.executeQuery(getInquiriesQuery(status), params);
            debug.timeEnd(queryTimerLabel);

            debug.log('getAllInquiries results:', {
                count: results.length,
                status
            });

            debug.timeEnd(timerLabel);
            return results;
        } catch (error) {
            debug.error('Error in getAllInquiries:', error);
            throw error;
        }
    }

    async getInquiryById(inquiryId) {
        const timerLabel = 'getInquiryById';
        debug.time(timerLabel);
        debug.log('Getting inquiry by ID:', inquiryId);

        try {
            const queryTimerLabel = 'getInquiryById.query';
            debug.time(queryTimerLabel);
            // Pass inquiryId four times for: InquiryData, ReferenceChanges, SupplierResponses, and ItemsData CTEs
            const results = await this.executeQuery(getInquiryByIdQuery(), [inquiryId, inquiryId, inquiryId, inquiryId]);
            debug.timeEnd(queryTimerLabel);

            if (!results || results.length === 0) {
                debug.log('Inquiry not found:', inquiryId);
                throw new Error('Inquiry not found');
            }

            const parseTimerLabel = 'getInquiryById.parse';
            debug.time(parseTimerLabel);
            const result = results[0];

            const response = {
                inquiry: JSON.parse(result.inquiry),
                items: JSON.parse(result.items)
            };

            debug.timeEnd(parseTimerLabel);
            debug.timeEnd(timerLabel);
            return response;
        } catch (error) {
            debug.error('Error in getInquiryById:', error);
            throw error;
        }
    }

    async createInquiry(data) {
        const { inquiryNumber, items } = data;
        const timerLabel = 'createInquiry';
        debug.time(timerLabel);
        debug.log('Creating inquiry:', { inquiryNumber, itemCount: items.length });

        return this.executeTransaction(async (db) => {
            // Create the inquiry with InquiryNumber
            debug.log('Creating inquiry record');
            const inquiryTimerLabel = 'createInquiry.inquiryInsert';
            debug.time(inquiryTimerLabel);
            const result = await this.executeRun(
                'INSERT INTO Inquiry (InquiryNumber, Status) VALUES (?, ?)',
                [inquiryNumber, 'new']
            );
            const inquiryId = result.lastID;
            debug.timeEnd(inquiryTimerLabel);

            // Create inquiry items using InquiryItemModel
            debug.log('Creating inquiry items');
            const inquiryItemsTimerLabel = 'createInquiry.itemsInsert';
            debug.time(inquiryItemsTimerLabel);

            for (const item of items) {
                try {
                    debug.log('Creating inquiry item:', {
                        itemId: item.ItemID,
                        newReferenceId: item.NewReferenceID
                    });

                    await this.inquiryItemModel.createInquiryItem(inquiryId, {
                        itemId: item.ItemID,  // Keep original case
                        hebrewDescription: item.HebrewDescription,
                        englishDescription: item.EnglishDescription,
                        requestedQuantity: item.RequestedQty || 0,
                        importMarkup: item.ImportMarkup,
                        hsCode: item.HSCode,
                        retailPrice: item.RetailPrice,
                        qtyInStock: item.QtyInStock,
                        soldThisYear: item.QtySoldThisYear,
                        soldLastYear: item.QtySoldLastYear,
                        newReferenceId: item.NewReferenceID,  // Match InquiryItemModel's expected case
                        referenceNotes: item.ReferenceNotes
                    });
                } catch (error) {
                    debug.error('Error creating inquiry item:', error);
                    throw error;
                }
            }
            debug.timeEnd(inquiryItemsTimerLabel);

            debug.log('Inquiry creation completed:', { inquiryId });
            debug.timeEnd(timerLabel);
            return { id: inquiryId };
        });
    }

    async updateInquiryStatus(inquiryId, status) {
        const timerLabel = 'updateInquiryStatus';
        debug.time(timerLabel);
        debug.log('Updating inquiry status:', { inquiryId, status });

        try {
            const result = await this.executeRun(
                'UPDATE Inquiry SET Status = ? WHERE InquiryID = ?',
                [status, inquiryId]
            );

            if (result.changes === 0) {
                throw new Error('Inquiry not found');
            }

            debug.timeEnd(timerLabel);
        } catch (error) {
            debug.error('Error updating inquiry status:', error);
            throw error;
        }
    }

    async updateInquiryItemQuantity(inquiryItemId, requestedQty) {
        try {
            await this.inquiryItemModel.updateInquiryItem(inquiryItemId, {
                requestedQuantity: requestedQty
            });
        } catch (error) {
            debug.error('Error updating inquiry item quantity:', error);
            throw error;
        }
    }

    async updateInquiryItemReference(inquiryItemId, itemId, newReferenceId, referenceNotes) {
        try {
            await this.inquiryItemModel.updateInquiryItem(inquiryItemId, {
                itemId,
                newReferenceId,  // Match InquiryItemModel's expected case
                referenceNotes
            });
        } catch (error) {
            debug.error('Error updating inquiry item reference:', error);
            throw error;
        }
    }

    async deleteInquiry(inquiryId) {
        const timerLabel = 'deleteInquiry';
        debug.time(timerLabel);
        debug.log('Deleting inquiry:', inquiryId);

        return this.executeTransaction(async () => {
            try {
                const deleteItemsTimerLabel = 'deleteInquiry.items';
                debug.time(deleteItemsTimerLabel);
                await this.executeRun(
                    'DELETE FROM InquiryItem WHERE InquiryID = ?',
                    [inquiryId]
                );
                debug.timeEnd(deleteItemsTimerLabel);

                const deleteInquiryTimerLabel = 'deleteInquiry.inquiry';
                debug.time(deleteInquiryTimerLabel);
                const result = await this.executeRun(
                    'DELETE FROM Inquiry WHERE InquiryID = ?',
                    [inquiryId]
                );
                debug.timeEnd(deleteInquiryTimerLabel);

                if (result.changes === 0) {
                    throw new Error('Inquiry not found');
                }

                debug.timeEnd(timerLabel);
            } catch (error) {
                debug.error('Error deleting inquiry:', error);
                throw error;
            }
        });
    }
}

module.exports = InquiryModel;
