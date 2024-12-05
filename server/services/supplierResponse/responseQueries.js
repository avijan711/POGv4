const debug = require('../../utils/debug');
const { getSupplierResponsesQuery } = require('../../models/queries/supplier-responses/main-query');

class ResponseQueries {
    constructor(db) {
        this.db = db;
    }

    // Transaction management methods
    async beginTransaction() {
        try {
            await this.db.runAsync('BEGIN TRANSACTION');
            debug.log('Transaction started');
        } catch (err) {
            debug.error('Error starting transaction:', err);
            throw err;
        }
    }

    async commitTransaction() {
        try {
            await this.db.runAsync('COMMIT');
            debug.log('Transaction committed');
        } catch (err) {
            debug.error('Error committing transaction:', err);
            throw err;
        }
    }

    async rollbackTransaction() {
        try {
            await this.db.runAsync('ROLLBACK');
            debug.log('Transaction rolled back');
        } catch (err) {
            debug.error('Error rolling back transaction:', err);
            throw err;
        }
    }

    async getSupplierResponses(inquiryId, page = 1, pageSize = 50) {
        debug.log('Getting supplier responses for inquiry:', inquiryId);
        
        if (!inquiryId) {
            debug.error('Invalid inquiry ID provided');
            throw new Error('Invalid inquiry ID');
        }

        const { query, params } = getSupplierResponsesQuery();
        const queryParams = params(inquiryId, page, pageSize);
        
        debug.log('Executing query with params:', {
            inquiryId,
            page,
            pageSize
        });
        
        try {
            const rows = await this.db.allAsync(query, queryParams);
            const transformedData = {};
            
            // Initialize default stats
            let globalStats = {
                totalResponses: 0,
                totalItems: 0,
                totalSuppliers: 0,
                respondedItems: 0,
                missingResponses: 0
            };

            rows.forEach(row => {
                const supplierId = row.supplier_id;
                const supplierName = row.supplier_name;
                let responses = [];
                let missingItems = [];

                try {
                    responses = JSON.parse(row.responses || '[]');
                } catch (e) {
                    debug.error('Error parsing responses JSON:', e);
                    responses = [];
                }

                // Parse missing items for this supplier
                try {
                    debug.log(`Raw missing_items for supplier ${supplierName}:`, row.missing_items);
                    missingItems = JSON.parse(row.missing_items || '[]');
                    debug.log(`Parsed missing items for supplier ${supplierName}:`, missingItems);
                } catch (e) {
                    debug.error(`Error parsing missing items JSON for supplier ${supplierName}:`, e);
                    missingItems = [];
                }

                // Update global stats from first row
                if (row) {
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
                    latestResponse: row.latest_response || row.response_date,
                    missingItems: missingItems
                };
            });

            debug.log('Successfully processed supplier responses:', {
                inquiryId,
                supplierCount: Object.keys(transformedData).length,
                stats: globalStats
            });

            return {
                data: transformedData,
                pagination: {
                    page,
                    pageSize,
                    hasMore: rows.length === pageSize
                },
                stats: globalStats
            };
        } catch (err) {
            debug.error('Error fetching supplier responses:', err);
            throw err;
        }
    }

    // Rest of the methods remain unchanged...
    async insertSupplierResponse(inquiryId, supplierId, itemId, price) {
        const sql = `INSERT INTO supplier_response (
            inquiry_id, supplier_id, item_id, price_quoted, response_date, status
        ) VALUES (?, ?, ?, ?, datetime('now'), 'active')`;
        const params = [inquiryId, supplierId, itemId, price];

        try {
            const result = await this.db.runAsync(sql, params);
            debug.log('supplier_response inserted:', {
                responseId: result.lastID,
                itemId: itemId
            });
            return result.lastID;
        } catch (err) {
            debug.error('Error inserting supplier_response:', err);
            throw err;
        }
    }

    async insertSupplierResponseItem(responseId, item) {
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

        try {
            const result = await this.db.runAsync(sql, params);
            debug.log('supplier_response_item inserted:', {
                itemId: item.item_id,
                price: item.price
            });
            return result;
        } catch (err) {
            debug.error('Error inserting supplier_response_item:', err);
            throw err;
        }
    }

    async insertReferenceChange(itemId, newReferenceId, supplierId, notes) {
        const sql = `INSERT INTO item_reference_change (
            original_item_id, new_reference_id, supplier_id,
            change_date, changed_by_user, notes
        ) VALUES (?, ?, ?, datetime('now'), 0, ?)`;
        const params = [itemId, newReferenceId, supplierId, notes || 'Replacement from supplier response'];

        try {
            const result = await this.db.runAsync(sql, params);
            debug.log('item_reference_change inserted');
            return result;
        } catch (err) {
            debug.error('Error inserting item_reference_change:', err);
            throw err;
        }
    }

    async updateResponseStatus(inquiryId, supplierId) {
        const sql = `UPDATE supplier_response 
                   SET status = 'active' 
                   WHERE inquiry_id = ? AND supplier_id = ? AND status = 'pending'`;
        
        try {
            const result = await this.db.runAsync(sql, [inquiryId, supplierId]);
            debug.log('Response status updated:', {
                changedRows: result.changes
            });
            return result;
        } catch (err) {
            debug.error('Error updating response status:', err);
            throw err;
        }
    }

    async cleanupSelfReferences(inquiryId) {
        const sql = `UPDATE inquiry_item SET 
            new_reference_id = NULL,
            reference_notes = NULL
        WHERE item_id = new_reference_id AND inquiry_id = ?`;

        try {
            const result = await this.db.runAsync(sql, [inquiryId]);
            debug.log('Self-references cleaned up');
            return result;
        } catch (err) {
            debug.error('Error cleaning up self-references:', err);
            throw err;
        }
    }

    async cleanupReferenceChanges() {
        const sql = 'DELETE FROM item_reference_change WHERE original_item_id = new_reference_id';

        try {
            const result = await this.db.runAsync(sql, []);
            debug.log('Reference changes cleaned up');
            return result;
        } catch (err) {
            debug.error('Error cleaning up reference changes:', err);
            throw err;
        }
    }

    async deleteResponse(responseId) {
        try {
            const result = await this.db.runAsync(
                'DELETE FROM supplier_response WHERE supplier_response_id = ?',
                [responseId]
            );
            const deleted = { deleted: result.changes > 0 };
            debug.log('Delete response result:', deleted);
            return deleted;
        } catch (err) {
            debug.error('Error deleting supplier response:', err);
            throw err;
        }
    }

    async deleteReferenceChange(changeId) {
        try {
            const result = await this.db.runAsync(
                'DELETE FROM item_reference_change WHERE change_id = ?',
                [changeId]
            );
            const deleted = { deleted: result.changes > 0 };
            debug.log('Delete reference change result:', deleted);
            return deleted;
        } catch (err) {
            debug.error('Error deleting reference change:', err);
            throw err;
        }
    }

    async deleteBulkResponses(date, supplierId) {
        try {
            const result = await this.db.runAsync(
                'DELETE FROM supplier_response WHERE date(response_date) = date(?) AND supplier_id = ?',
                [date, supplierId]
            );
            const deleted = { deleted: result.changes > 0 };
            debug.log('Delete bulk responses result:', deleted);
            return deleted;
        } catch (err) {
            debug.error('Error deleting bulk responses:', err);
            throw err;
        }
    }
}

module.exports = ResponseQueries;
