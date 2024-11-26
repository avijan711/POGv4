const debug = require('../../utils/debug');
const { getSupplierResponsesQuery } = require('../../models/queries/supplier-responses/main-query');

class ResponseQueries {
    constructor(db) {
        this.db = db;
    }

    async getSupplierResponses(inquiryId, page = 1, pageSize = 50) {
        debug.log('Getting supplier responses for inquiry:', inquiryId);
        
        return new Promise((resolve, reject) => {
            if (!inquiryId) {
                debug.error('Invalid inquiry ID provided');
                reject(new Error('Invalid inquiry ID'));
                return;
            }

            const { query, params } = getSupplierResponsesQuery();
            const queryParams = params(inquiryId, page, pageSize);
            
            debug.log('Executing query with params:', {
                inquiryId,
                page,
                pageSize
            });
            
            this.db.all(query, queryParams, (err, rows) => {
                if (err) {
                    debug.error('Error fetching supplier responses:', err);
                    reject(err);
                    return;
                }

                try {
                    const parsedRows = rows.map(row => {
                        // Parse JSON arrays once
                        const items = JSON.parse(row.items || '[]');
                        const promotions = row.debugPromotions ? 
                            row.debugPromotions.split(',').filter(Boolean) : 
                            [];

                        // Process items to include supplier response details
                        const processedItems = items.map(item => ({
                            ...item,
                            supplier_name: row.supplier_name,
                            response_date: item.response_date,
                            is_promotion: item.item_type === 'promotion'
                        }));

                        return {
                            date: row.date,
                            supplierId: row.supplier_id,
                            supplierName: row.supplier_name,
                            itemCount: row.item_count,
                            extraItemsCount: row.extra_items_count || 0,
                            replacementsCount: row.replacements_count || 0,
                            items: processedItems,
                            debugPromotions: promotions
                        };
                    });

                    debug.log('Successfully processed supplier responses:', {
                        inquiryId,
                        responseCount: parsedRows.length,
                        page,
                        pageSize
                    });

                    resolve({
                        data: parsedRows,
                        pagination: {
                            page,
                            pageSize,
                            hasMore: parsedRows.length === pageSize
                        }
                    });
                } catch (parseError) {
                    debug.error('Error parsing supplier responses:', parseError);
                    reject(new Error('Failed to parse supplier response data'));
                }
            });
        });
    }

    async insertSupplierResponse(inquiryId, supplierId, itemId, price) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO supplier_response (
                inquiry_id, supplier_id, item_id, price_quoted, response_date, status
            ) VALUES (?, ?, ?, ?, datetime('now'), 'pending')`;
            const params = [inquiryId, supplierId, itemId, price];

            this.db.run(sql, params, function(err) {
                if (err) {
                    debug.error('Error inserting supplier_response:', err);
                    reject(err);
                } else {
                    debug.log('supplier_response inserted:', {
                        responseId: this.lastID,
                        itemId: itemId
                    });
                    resolve(this.lastID);
                }
            });
        });
    }

    async insertSupplierResponseItem(responseId, item) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO supplier_response_item (
                supplier_response_id, item_id, price, notes,
                hs_code, english_description, origin, new_reference_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [
                responseId,
                item.item_id,
                item.price || null,
                item.notes || null,
                item.hs_code || null,
                item.english_description || null,
                item.origin || null,
                item.new_reference_id || null
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    debug.error('Error inserting supplier_response_item:', err);
                    reject(err);
                } else {
                    debug.log('supplier_response_item inserted:', {
                        itemId: item.item_id,
                        price: item.price
                    });
                    resolve();
                }
            });
        });
    }

    async insertReferenceChange(itemId, newReferenceId, supplierId, notes) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO item_reference_change (
                original_item_id, new_reference_id, supplier_id,
                change_date, changed_by_user, notes
            ) VALUES (?, ?, ?, datetime('now'), 0, ?)`;
            const params = [itemId, newReferenceId, supplierId, notes || 'Replacement from supplier response'];

            this.db.run(sql, params, function(err) {
                if (err) {
                    debug.error('Error inserting item_reference_change:', err);
                    reject(err);
                } else {
                    debug.log('item_reference_change inserted');
                    resolve();
                }
            });
        });
    }

    async updateResponseStatus(inquiryId, supplierId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE supplier_response 
                       SET status = 'active' 
                       WHERE inquiry_id = ? AND supplier_id = ? AND status = 'pending'`;
            
            this.db.run(sql, [inquiryId, supplierId], function(err) {
                if (err) {
                    debug.error('Error updating response status:', err);
                    reject(err);
                } else {
                    debug.log('Response status updated:', {
                        changedRows: this.changes
                    });
                    resolve();
                }
            });
        });
    }

    async cleanupSelfReferences(inquiryId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE inquiry_item SET 
                new_reference_id = NULL,
                reference_notes = NULL
            WHERE item_id = new_reference_id AND inquiry_id = ?`;

            this.db.run(sql, [inquiryId], function(err) {
                if (err) {
                    debug.error('Error cleaning up self-references:', err);
                    reject(err);
                } else {
                    debug.log('Self-references cleaned up');
                    resolve();
                }
            });
        });
    }

    async cleanupReferenceChanges() {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM item_reference_change WHERE original_item_id = new_reference_id';

            this.db.run(sql, [], function(err) {
                if (err) {
                    debug.error('Error cleaning up reference changes:', err);
                    reject(err);
                } else {
                    debug.log('Reference changes cleaned up');
                    resolve();
                }
            });
        });
    }

    async deleteResponse(responseId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM supplier_response WHERE supplier_response_id = ?',
                [responseId],
                function(err) {
                    if (err) {
                        debug.error('Error deleting supplier response:', err);
                        reject(err);
                        return;
                    }
                    
                    const result = { deleted: this.changes > 0 };
                    debug.log('Delete response result:', result);
                    resolve(result);
                }
            );
        });
    }

    async deleteReferenceChange(changeId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM item_reference_change WHERE change_id = ?',
                [changeId],
                function(err) {
                    if (err) {
                        debug.error('Error deleting reference change:', err);
                        reject(err);
                        return;
                    }
                    
                    const result = { deleted: this.changes > 0 };
                    debug.log('Delete reference change result:', result);
                    resolve(result);
                }
            );
        });
    }

    async deleteBulkResponses(date, supplierId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM supplier_response WHERE date(response_date) = date(?) AND supplier_id = ?',
                [date, supplierId],
                function(err) {
                    if (err) {
                        debug.error('Error deleting bulk responses:', err);
                        reject(err);
                        return;
                    }
                    
                    const result = { deleted: this.changes > 0 };
                    debug.log('Delete bulk responses result:', result);
                    resolve(result);
                }
            );
        });
    }
}

module.exports = ResponseQueries;
