const { getSupplierResponsesQuery } = require('../models/queries/supplier-responses');
const debug = require('../utils/debug');
const ExcelProcessor = require('../utils/excelProcessor');

class SupplierResponseService {
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

                        return {
                            date: row.date,
                            supplierId: row.supplierId,
                            supplierName: row.supplierName,
                            itemCount: row.itemCount,
                            extraItemsCount: row.extraItemsCount || 0,
                            replacementsCount: row.replacementsCount || 0,
                            items,
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

    async deleteResponse(responseId) {
        debug.log('Deleting supplier response:', responseId);
        
        return new Promise((resolve, reject) => {
            if (!responseId) {
                debug.error('Invalid response ID provided');
                reject(new Error('Invalid response ID'));
                return;
            }

            this.db.run(
                'DELETE FROM SupplierResponse WHERE SupplierResponseID = ?',
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
        debug.log('Deleting reference change:', changeId);
        
        return new Promise((resolve, reject) => {
            if (!changeId) {
                debug.error('Invalid change ID provided');
                reject(new Error('Invalid change ID'));
                return;
            }

            this.db.run(
                'DELETE FROM ItemReferenceChange WHERE ChangeID = ?',
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
        debug.log('Deleting bulk responses:', { date, supplierId });
        
        return new Promise((resolve, reject) => {
            if (!date || !supplierId) {
                debug.error('Invalid date or supplier ID provided');
                reject(new Error('Invalid date or supplier ID'));
                return;
            }

            this.db.run(
                'DELETE FROM SupplierResponse WHERE date(ResponseDate) = date(?) AND SupplierID = ?',
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

    async verifyItemExists(itemId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT 1 FROM Item WHERE ItemID = ?',
                [itemId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(!!row);
                }
            );
        });
    }

    async createUnknownItem(itemId, description = 'Unknown New Item') {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO Item (
                    ItemID, HebrewDescription, EnglishDescription, ImportMarkup
                ) VALUES (?, ?, ?, 1.30)`,
                [itemId, description, description],
                async (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Insert initial history record
                    try {
                        await this.db.run(
                            `INSERT INTO ItemHistory (
                                ItemID, ILSRetailPrice, QtyInStock, 
                                QtySoldThisYear, QtySoldLastYear, Date
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

    async processUpload(file, columnMapping, supplierId, inquiryId) {
        debug.log('Processing supplier response upload:', {
            filename: file.filename,
            supplierId,
            inquiryId,
            mappingKeys: Object.keys(columnMapping)
        });

        if (!file || !columnMapping || !supplierId || !inquiryId) {
            debug.error('Missing required parameters for upload');
            throw new Error('Missing required parameters');
        }

        try {
            // Process the uploaded file using ExcelProcessor
            const data = await ExcelProcessor.processResponse(file.path, columnMapping, {
                requiredFields: ['itemID']
            });

            // Filter out self-references
            const validData = data.map(item => ({
                ...item,
                newReferenceID: item.newReferenceID === item.itemID ? null : item.newReferenceID
            }));

            // Begin transaction
            await new Promise((resolve, reject) => {
                this.db.run('BEGIN TRANSACTION', err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            try {
                // Insert supplier response record
                const responseId = await new Promise((resolve, reject) => {
                    this.db.run(
                        `INSERT INTO SupplierResponse (
                            InquiryID, SupplierID, ResponseDate, Status
                        ) VALUES (?, ?, datetime('now'), 'pending')`,
                        [inquiryId, supplierId],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        }
                    );
                });

                // Process items and create unknown items first
                for (const item of validData) {
                    // Check and create original item if needed
                    const originalExists = await this.verifyItemExists(item.itemID);
                    if (!originalExists) {
                        await this.createUnknownItem(item.itemID);
                    }

                    // Check and create reference item if needed
                    if (item.newReferenceID) {
                        const newExists = await this.verifyItemExists(item.newReferenceID);
                        if (!newExists) {
                            await this.createUnknownItem(item.newReferenceID);
                        }
                    }
                }

                // Now process the responses and reference changes
                for (const item of validData) {
                    // Insert supplier response item
                    await new Promise((resolve, reject) => {
                        this.db.run(
                            `INSERT INTO SupplierResponseItem (
                                SupplierResponseID, ItemID, Price, Notes,
                                HSCode, EnglishDescription, NewReferenceID
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                responseId,
                                item.itemID,
                                item.price || null,
                                item.notes || null,
                                item.hsCode || null,
                                item.englishDescription || null,
                                item.newReferenceID || null
                            ],
                            err => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });

                    // If there's a new reference ID, create an ItemReferenceChange record
                    if (item.newReferenceID) {
                        await new Promise((resolve, reject) => {
                            this.db.run(
                                `INSERT INTO ItemReferenceChange (
                                    OriginalItemID, NewReferenceID, SupplierID,
                                    ChangeDate, ChangedByUser, Notes
                                ) VALUES (?, ?, ?, datetime('now'), 0, ?)`,
                                [
                                    item.itemID,
                                    item.newReferenceID,
                                    supplierId,
                                    item.notes || 'Replacement from supplier response'
                                ],
                                err => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });

                        // Update InquiryItem with reference information
                        await new Promise((resolve, reject) => {
                            this.db.run(
                                `UPDATE InquiryItem SET 
                                    NewReferenceID = ?,
                                    ReferenceNotes = ?
                                WHERE ItemID = ? AND InquiryID = ?`,
                                [
                                    item.newReferenceID,
                                    item.notes || 'Replacement from supplier response',
                                    item.itemID,
                                    inquiryId
                                ],
                                err => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                    }
                }

                // Clean up any self-references that might have been created
                await new Promise((resolve, reject) => {
                    this.db.run(
                        `UPDATE InquiryItem SET 
                            NewReferenceID = NULL,
                            ReferenceNotes = NULL
                        WHERE ItemID = NewReferenceID AND InquiryID = ?`,
                        [inquiryId],
                        err => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });

                await new Promise((resolve, reject) => {
                    this.db.run(
                        'DELETE FROM ItemReferenceChange WHERE OriginalItemID = NewReferenceID',
                        [],
                        err => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });

                // Commit transaction
                await new Promise((resolve, reject) => {
                    this.db.run('COMMIT', err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                debug.log('Successfully processed supplier response:', {
                    responseId,
                    itemCount: validData.length
                });

                return {
                    success: true,
                    responseId,
                    itemCount: validData.length
                };

            } catch (error) {
                // Rollback transaction on error
                await new Promise((resolve) => {
                    this.db.run('ROLLBACK', () => resolve());
                });
                throw error;
            }

        } catch (error) {
            debug.error('Error processing supplier response:', error);
            throw new Error(`Failed to process supplier response: ${error.message}`);
        }
    }
}

module.exports = SupplierResponseService;
