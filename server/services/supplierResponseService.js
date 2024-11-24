const { getSupplierResponsesQuery } = require('../models/queries/supplier-responses');
const debug = require('../utils/debug');
const ExcelProcessor = require('../utils/excelProcessor');

class SupplierResponseService {
    constructor(db) {
        this.db = db;
    }

    cleanItemCode(itemCode) {
        if (!itemCode) return itemCode;
        const cleaned = itemCode.replace(/^['']/, '').trim();
        if (cleaned !== itemCode) {
            debug.log(`Cleaned item code: '${itemCode}' -> '${cleaned}'`);
        }
        return cleaned;
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

    async verifyItemExists(itemId, inquiryId) {
        const cleanedItemId = this.cleanItemCode(itemId);
        return new Promise((resolve, reject) => {
            // First check if the item exists in InquiryItem table for this inquiry
            this.db.get(
                'SELECT 1 FROM InquiryItem WHERE ItemID = ? AND InquiryID = ?',
                [cleanedItemId, inquiryId],
                (err, inquiryRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!inquiryRow) {
                        // If item is not in InquiryItem table, we shouldn't create it
                        resolve({
                            existsInInquiry: false,
                            existsInItemTable: false
                        });
                        return;
                    }

                    // If item exists in InquiryItem, check if it exists in main Item table
                    this.db.get(
                        'SELECT 1 FROM Item WHERE ItemID = ?',
                        [cleanedItemId],
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

    async createUnknownItem(itemId, description = 'Unknown New Item', inquiryId) {
        const cleanedItemId = this.cleanItemCode(itemId);
        // First verify this item exists in InquiryItem table
        const inquiryItem = await new Promise((resolve, reject) => {
            this.db.get(
                `SELECT HebrewDescription, EnglishDescription, ImportMarkup, HSCode 
                 FROM InquiryItem WHERE ItemID = ? AND InquiryID = ?`,
                [cleanedItemId, inquiryId],
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
            throw new Error(`Item ${cleanedItemId} not found in inquiry ${inquiryId}`);
        }

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO Item (
                    ItemID, HebrewDescription, EnglishDescription, ImportMarkup, HSCode
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    cleanedItemId,
                    inquiryItem.HebrewDescription || description,
                    inquiryItem.EnglishDescription || description,
                    inquiryItem.ImportMarkup || 1.30,
                    inquiryItem.HSCode || ''
                ],
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
                            [cleanedItemId]
                        );
                        resolve();
                    } catch (historyErr) {
                        reject(historyErr);
                    }
                }
            );
        });
    }

    async updateItemDetails(itemId, hsCode, englishDescription) {
        debug.log('Updating item details:', {
            itemId,
            hsCode,
            englishDescription
        });

        return new Promise((resolve, reject) => {
            const sql = `UPDATE Item 
                        SET HSCode = COALESCE(NULLIF(?, ''), HSCode),
                            EnglishDescription = COALESCE(NULLIF(?, ''), EnglishDescription)
                        WHERE ItemID = ?`;
            
            this.db.run(sql, [hsCode, englishDescription, itemId], function(err) {
                if (err) {
                    debug.error('Error updating item details:', err);
                    reject(err);
                } else {
                    debug.log('Item details updated successfully');
                    resolve();
                }
            });
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
            // Debug: Check table structure before insert
            await new Promise((resolve, reject) => {
                this.db.all("PRAGMA table_info(SupplierResponse)", [], (err, rows) => {
                    if (err) {
                        debug.error('Error checking table structure:', err);
                        reject(err);
                        return;
                    }
                    debug.log('SupplierResponse table structure:', rows);
                    resolve();
                });
            });

            // Process the uploaded file using ExcelProcessor
            const data = await ExcelProcessor.processResponse(file.path, columnMapping, {
                requiredFields: ['ItemID']  // Use database field name
            });

            debug.log('Processed Excel data:', {
                sampleRow: data[0],
                totalRows: data.length,
                allRows: data // Log all rows for debugging
            });

            // Filter out self-references and use database field names
            const validData = data.map(item => {
                // Clean the item codes
                const cleanedItemId = this.cleanItemCode(item.ItemID);
                const cleanedNewRefId = item.NewReferenceID ? this.cleanItemCode(item.NewReferenceID) : null;

                // Check if NewReferenceID exists and is different from ItemID
                const newRef = cleanedNewRefId && cleanedNewRefId !== cleanedItemId ? 
                             cleanedNewRefId : null;

                return {
                    ItemID: cleanedItemId,
                    Price: item.Price,
                    Notes: item.Notes,
                    HSCode: item.HSCode,
                    EnglishDescription: item.EnglishDescription,
                    NewReferenceID: newRef
                };
            });

            debug.log('Validated data:', {
                sampleRow: validData[0],
                totalRows: validData.length,
                allRows: validData // Log all validated rows
            });

            // Begin transaction
            await new Promise((resolve, reject) => {
                this.db.run('BEGIN TRANSACTION', err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            try {
                // Process items and create unknown items first
                for (const item of validData) {
                    debug.log('Processing item:', item);

                    // Check and create original item if needed
                    const { existsInInquiry, existsInItemTable } = await this.verifyItemExists(item.ItemID, inquiryId);
                    debug.log('Original item exists:', {
                        itemId: item.ItemID,
                        existsInInquiry,
                        existsInItemTable
                    });

                    if (!existsInInquiry) {
                        // Log this item as not part of the original inquiry
                        debug.log(`Item ${item.ItemID} not found in inquiry ${inquiryId}. Skipping.`);
                        continue; // Skip this item and move to the next one
                    }

                    if (!existsInItemTable) {
                        await this.createUnknownItem(item.ItemID, undefined, inquiryId);
                        debug.log('Created unknown item:', item.ItemID);
                    }

                    // Update Item table with HSCode and EnglishDescription
                    if (item.HSCode || item.EnglishDescription) {
                        await this.updateItemDetails(item.ItemID, item.HSCode, item.EnglishDescription);
                        debug.log('Updated item details:', {
                            itemId: item.ItemID,
                            hsCode: item.HSCode,
                            englishDescription: item.EnglishDescription
                        });
                    }

                    // Check and create reference item if needed
                    if (item.NewReferenceID) {
                        const { existsInInquiry: refExistsInInquiry, existsInItemTable: refExistsInItemTable } = 
                            await this.verifyItemExists(item.NewReferenceID, inquiryId);
                        debug.log('Reference item exists:', {
                            referenceId: item.NewReferenceID,
                            existsInInquiry: refExistsInInquiry,
                            existsInItemTable: refExistsInItemTable
                        });

                        if (!refExistsInInquiry) {
                            debug.log(`Reference item ${item.NewReferenceID} not found in inquiry ${inquiryId}. Skipping reference.`);
                            item.NewReferenceID = null; // Clear the reference since it's invalid
                            continue;
                        }

                        if (!refExistsInItemTable) {
                            await this.createUnknownItem(item.NewReferenceID, undefined, inquiryId);
                            debug.log('Created unknown reference item:', item.NewReferenceID);
                        }
                    }
                }

                // Now process the responses and reference changes
                for (const item of validData) {
                    debug.log('Creating supplier response for item:', item);

                    // Insert supplier response record for this item
                    const responseId = await new Promise((resolve, reject) => {
                        const sql = `INSERT INTO SupplierResponse (
                            InquiryID, SupplierID, ItemID, PriceQuoted, ResponseDate, Status
                        ) VALUES (?, ?, ?, ?, datetime('now'), 'pending')`;
                        const params = [inquiryId, supplierId, item.ItemID, item.Price];

                        debug.log('Executing SupplierResponse insert:', {
                            sql,
                            params
                        });

                        this.db.run(sql, params, function(err) {
                            if (err) {
                                debug.error('Error inserting SupplierResponse:', err);
                                reject(err);
                            } else {
                                debug.log('SupplierResponse inserted:', {
                                    responseId: this.lastID,
                                    itemId: item.ItemID
                                });
                                resolve(this.lastID);
                            }
                        });
                    });

                    // Insert supplier response item
                    await new Promise((resolve, reject) => {
                        const sql = `INSERT INTO SupplierResponseItem (
                            SupplierResponseID, ItemID, Price, Notes,
                            HSCode, EnglishDescription, NewReferenceID
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                        const params = [
                            responseId,
                            item.ItemID,
                            item.Price || null,
                            item.Notes || null,
                            item.HSCode || null,
                            item.EnglishDescription || null,
                            item.NewReferenceID || null
                        ];

                        debug.log('Executing SupplierResponseItem insert:', {
                            sql,
                            params
                        });

                        this.db.run(sql, params, function(err) {
                            if (err) {
                                debug.error('Error inserting SupplierResponseItem:', err);
                                reject(err);
                            } else {
                                debug.log('SupplierResponseItem inserted:', {
                                    itemId: item.ItemID,
                                    price: item.Price
                                });
                                resolve();
                            }
                        });
                    });

                    // If there's a new reference ID, create an ItemReferenceChange record
                    if (item.NewReferenceID) {
                        debug.log('Creating reference change:', {
                            originalId: item.ItemID,
                            newId: item.NewReferenceID
                        });

                        await new Promise((resolve, reject) => {
                            const sql = `INSERT INTO ItemReferenceChange (
                                OriginalItemID, NewReferenceID, SupplierID,
                                ChangeDate, ChangedByUser, Notes
                            ) VALUES (?, ?, ?, datetime('now'), 0, ?)`;
                            const params = [
                                item.ItemID,
                                item.NewReferenceID,
                                supplierId,
                                item.Notes || 'Replacement from supplier response'
                            ];

                            debug.log('Executing ItemReferenceChange insert:', {
                                sql,
                                params
                            });

                            this.db.run(sql, params, function(err) {
                                if (err) {
                                    debug.error('Error inserting ItemReferenceChange:', err);
                                    reject(err);
                                } else {
                                    debug.log('ItemReferenceChange inserted');
                                    resolve();
                                }
                            });
                        });

                        // Update InquiryItem with reference information
                        await new Promise((resolve, reject) => {
                            const sql = `UPDATE InquiryItem SET 
                                NewReferenceID = ?,
                                ReferenceNotes = ?
                            WHERE ItemID = ? AND InquiryID = ?`;
                            const params = [
                                item.NewReferenceID,
                                item.Notes || 'Replacement from supplier response',
                                item.ItemID,
                                inquiryId
                            ];

                            debug.log('Executing InquiryItem update:', {
                                sql,
                                params
                            });

                            this.db.run(sql, params, function(err) {
                                if (err) {
                                    debug.error('Error updating InquiryItem:', err);
                                    reject(err);
                                } else {
                                    debug.log('InquiryItem updated');
                                    resolve();
                                }
                            });
                        });
                    }
                }

                // Clean up any self-references that might have been created
                await new Promise((resolve, reject) => {
                    const sql = `UPDATE InquiryItem SET 
                        NewReferenceID = NULL,
                        ReferenceNotes = NULL
                    WHERE ItemID = NewReferenceID AND InquiryID = ?`;

                    debug.log('Executing self-reference cleanup:', {
                        sql,
                        inquiryId
                    });

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

                await new Promise((resolve, reject) => {
                    const sql = 'DELETE FROM ItemReferenceChange WHERE OriginalItemID = NewReferenceID';

                    debug.log('Executing reference change cleanup');

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

                // Update response status to active
                await new Promise((resolve, reject) => {
                    const sql = `UPDATE SupplierResponse 
                               SET Status = 'active' 
                               WHERE InquiryID = ? AND SupplierID = ? AND Status = 'pending'`;
                    
                    debug.log('Updating response status to active:', {
                        inquiryId,
                        supplierId
                    });

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

                // Commit transaction
                await new Promise((resolve, reject) => {
                    debug.log('Committing transaction');
                    this.db.run('COMMIT', err => {
                        if (err) {
                            debug.error('Error committing transaction:', err);
                            reject(err);
                        } else {
                            debug.log('Transaction committed successfully');
                            resolve();
                        }
                    });
                });

                debug.log('Successfully processed supplier response:', {
                    itemCount: validData.length
                });

                return {
                    success: true,
                    itemCount: validData.length
                };

            } catch (error) {
                // Rollback transaction on error
                debug.error('Error during processing, rolling back:', error);
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
