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
                    const transformedData = {};
                    let globalStats = null;

                    rows.forEach(row => {
                        const supplierId = row.supplier_id;
                        const supplierName = row.supplier_name;
                        let responses = [];

                        try {
                            responses = JSON.parse(row.responses || '[]');
                        } catch (e) {
                            debug.error('Error parsing responses JSON:', e);
                            responses = [];
                        }

                        // Store global stats from first row
                        if (!globalStats) {
                            globalStats = {
                                totalResponses: row.total_responses || 0,
                                totalItems: row.total_items || 0,
                                totalSuppliers: row.total_suppliers || 0,
                                respondedItems: row.responded_items || 0,
                                missingResponses: row.missing_responses || 0
                            };
                        }

                        transformedData[supplierId] = {
                            supplier_name: supplierName,
                            responses: responses.map(response => ({
                                supplier_response_id: response.supplier_response_id,
                                supplier_id: supplierId,
                                supplier_name: supplierName,
                                item_id: response.item_id,
                                price_quoted: parseFloat(response.price_quoted),
                                response_date: response.response_date,
                                is_promotion: Boolean(response.is_promotion),
                                promotion_name: response.promotion_name || '',
                                notes: response.notes || '',
                                hebrew_description: response.hebrew_description || '',
                                english_description: response.english_description || '',
                                status: response.status || 'active'
                            })),
                            totalItems: row.item_count || 0,
                            promotionItems: row.promotion_count || 0,
                            averagePrice: row.average_price || 0,
                            latestResponse: row.latest_response || row.response_date
                        };
                    });

                    debug.log('Successfully processed supplier responses:', {
                        inquiryId,
                        supplierCount: Object.keys(transformedData).length,
                        stats: globalStats
                    });

                    resolve({
                        data: transformedData,
                        pagination: {
                            page,
                            pageSize,
                            hasMore: rows.length === pageSize
                        },
                        stats: globalStats
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
            ) VALUES (?, ?, ?, ?, datetime('now'), 'active')`;
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
