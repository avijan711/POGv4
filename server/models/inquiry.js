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

    async getInquiryById(inquiry_id) {
        const timerLabel = 'getInquiryById';
        debug.time(timerLabel);
        debug.log('Getting inquiry by ID:', inquiry_id);

        try {
            const queryTimerLabel = 'getInquiryById.query';
            debug.time(queryTimerLabel);
            // Pass inquiry_id four times for: InquiryData, ReferenceChanges, SupplierResponses, and ItemsData CTEs
            const results = await this.executeQuery(getInquiryByIdQuery(), [inquiry_id, inquiry_id, inquiry_id, inquiry_id]);
            debug.timeEnd(queryTimerLabel);

            if (!results || results.length === 0) {
                debug.log('Inquiry not found:', inquiry_id);
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
            // Create the inquiry with inquiry_number
            debug.log('Creating inquiry record');
            const inquiryTimerLabel = 'createInquiry.inquiryInsert';
            debug.time(inquiryTimerLabel);
            const result = await this.executeRun(
                'INSERT INTO inquiry (inquiry_number, status) VALUES (?, ?)',
                [inquiryNumber, 'new']
            );
            const inquiry_id = result.lastID;
            debug.timeEnd(inquiryTimerLabel);

            // Create inquiry items using InquiryItemModel
            debug.log('Creating inquiry items');
            const inquiryItemsTimerLabel = 'createInquiry.itemsInsert';
            debug.time(inquiryItemsTimerLabel);

            for (const item of items) {
                try {
                    debug.log('Creating inquiry item:', {
                        item_id: item.item_id,
                        new_reference_id: item.new_reference_id
                    });

                    await this.inquiryItemModel.createInquiryItem(inquiry_id, {
                        item_id: item.item_id,
                        hebrew_description: item.hebrew_description,
                        english_description: item.english_description,
                        requested_qty: item.requested_qty || 0,
                        import_markup: item.import_markup,
                        hs_code: item.hs_code,
                        retail_price: item.retail_price,
                        qty_in_stock: item.qty_in_stock,
                        sold_this_year: item.sold_this_year,
                        sold_last_year: item.sold_last_year,
                        new_reference_id: item.new_reference_id,
                        reference_notes: item.reference_notes
                    });
                } catch (error) {
                    debug.error('Error creating inquiry item:', error);
                    throw error;
                }
            }
            debug.timeEnd(inquiryItemsTimerLabel);

            debug.log('Inquiry creation completed:', { inquiry_id });
            debug.timeEnd(timerLabel);
            return { id: inquiry_id };
        });
    }

    async updateInquiryStatus(inquiry_id, status) {
        const timerLabel = 'updateInquiryStatus';
        debug.time(timerLabel);
        debug.log('Updating inquiry status:', { inquiry_id, status });

        try {
            const result = await this.executeRun(
                'UPDATE inquiry SET status = ? WHERE inquiry_id = ?',
                [status, inquiry_id]
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

    async updateInquiryItemQuantity(inquiry_item_id, requested_qty) {
        try {
            await this.inquiryItemModel.updateInquiryItem(inquiry_item_id, {
                requested_qty
            });
        } catch (error) {
            debug.error('Error updating inquiry item quantity:', error);
            throw error;
        }
    }

    async updateInquiryItemReference(inquiry_item_id, item_id, new_reference_id, reference_notes) {
        try {
            await this.inquiryItemModel.updateInquiryItem(inquiry_item_id, {
                item_id,
                new_reference_id,
                reference_notes
            });
        } catch (error) {
            debug.error('Error updating inquiry item reference:', error);
            throw error;
        }
    }

    async deleteInquiry(inquiry_id) {
        const timerLabel = 'deleteInquiry';
        debug.time(timerLabel);
        debug.log('Deleting inquiry:', inquiry_id);

        return this.executeTransaction(async () => {
            try {
                const deleteItemsTimerLabel = 'deleteInquiry.items';
                debug.time(deleteItemsTimerLabel);
                await this.executeRun(
                    'DELETE FROM inquiry_item WHERE inquiry_id = ?',
                    [inquiry_id]
                );
                debug.timeEnd(deleteItemsTimerLabel);

                const deleteInquiryTimerLabel = 'deleteInquiry.inquiry';
                debug.time(deleteInquiryTimerLabel);
                const result = await this.executeRun(
                    'DELETE FROM inquiry WHERE inquiry_id = ?',
                    [inquiry_id]
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
