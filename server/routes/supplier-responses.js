const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelProcessor = require('../utils/excelProcessor');
const ItemModel = require('../models/item');
const { getUploadConfig } = require('../utils/uploadConfig');
const { cleanupSelfReferences } = require('../utils/referenceUtils');
const { validateReferenceChange } = require('../utils/validationUtils');
const { cleanItemId, checkItemExists, createItem, updateItem } = require('../utils/itemUtils');
const { 
    getSupplierResponsesQuery, 
    getReferenceChangesQuery 
} = require('../utils/queries');

// Helper function to run SQL in a promise
const runAsync = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

// Helper function to format date for SQLite
const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Create a router factory function that accepts db
function createRouter(db) {
    const router = express.Router();
    const { storage, fileFilter } = getUploadConfig();
    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB limit
        }
    }).single('file');

    // Route to manually trigger self-reference cleanup
    router.post('/cleanup-references', async (req, res) => {
        try {
            const cleanedCount = await cleanupSelfReferences(db);
            res.json({
                message: 'Self-references cleaned up successfully',
                cleanedCount
            });
        } catch (error) {
            console.error('Error during cleanup:', error);
            res.status(500).json({
                error: 'Failed to clean up self-references',
                message: error.message
            });
        }
    });

    // Get all suppliers
    router.get('/', (req, res) => {
        console.log('Fetching suppliers');
        db.all('SELECT SupplierID as id, Name as name FROM Supplier ORDER BY Name', [], (err, rows) => {
            if (err) {
                console.error('Error fetching suppliers:', err);
                res.status(500).json({ error: 'Failed to fetch suppliers' });
                return;
            }
            console.log('Found suppliers:', rows);
            res.json(rows || []);
        });
    });

    // Get supplier responses for an inquiry
    router.get('/inquiry/:inquiryId', (req, res) => {
        const { inquiryId } = req.params;
        const query = getSupplierResponsesQuery();
        
        console.log('DEBUG: Executing supplier responses query for inquiry:', inquiryId);
        console.log('DEBUG: Full query:', query);

        // First check for suppliers with promotions
        const promotionsCheckQuery = `
            SELECT DISTINCT pg.SupplierID, s.Name, p.ItemID
            FROM PromotionGroup pg
            JOIN Promotion p ON p.PromotionGroupID = pg.PromotionGroupID
            JOIN InquiryItem ii ON p.ItemID = ii.ItemID
            JOIN Supplier s ON pg.SupplierID = s.SupplierID
            WHERE ii.InquiryID = ?
            AND pg.IsActive = 1
            AND pg.StartDate <= datetime('now')
            AND pg.EndDate >= datetime('now')
            AND p.IsActive = 1`;

        console.log('DEBUG: Checking promotions with query:', promotionsCheckQuery);
        
        db.all(promotionsCheckQuery, [inquiryId], (promoErr, promoRows) => {
            if (promoErr) {
                console.error('DEBUG: Error checking promotions:', promoErr);
            } else {
                console.log('DEBUG: Suppliers with promotions:', promoRows);
            }

            // Now execute the main query
            db.all(query, [inquiryId], (err, rows) => {
                if (err) {
                    console.error('Error fetching supplier responses:', err);
                    return res.status(500).json({ error: 'Failed to fetch supplier responses' });
                }

                // Parse the JSON string arrays
                const responses = rows.map(row => ({
                    ...row,
                    items: JSON.parse(row.items)
                }));

                console.log('DEBUG: Found responses for suppliers:', responses.map(r => r.supplierName));

                // Get reference changes
                const refQuery = getReferenceChangesQuery();
                db.all(refQuery, [], (refErr, refRows) => {
                    if (refErr) {
                        console.error('Error fetching reference changes:', refErr);
                    } else {
                        console.log('DEBUG: Reference changes:', refRows);
                        
                        // Add reference changes to responses
                        responses.forEach(response => {
                            if (response.items) {
                                response.items = response.items.map(item => {
                                    if (item.itemType === 'reference') {
                                        const refChange = refRows.find(ref => 
                                            ref.OriginalItemID === item.itemId && 
                                            ref.NewReferenceID === item.referenceChange?.newReferenceID
                                        );
                                        if (refChange) {
                                            item.changeId = refChange.changeId;
                                        }
                                    }
                                    return item;
                                });
                            }
                        });
                    }
                    
                    console.log('DEBUG: Final responses:', responses);
                    res.json(responses);
                });
            });
        });
    });

    // Delete responses by date and supplier
    router.delete('/bulk/:date/:supplierId', async (req, res) => {
        const { date, supplierId } = req.params;
        const formattedDate = formatDate(decodeURIComponent(date));
        
        try {
            // Start transaction
            await runAsync(db, 'BEGIN TRANSACTION');

            // Delete supplier responses
            const deleteResponsesResult = await runAsync(
                db,
                `DELETE FROM SupplierResponse 
                 WHERE strftime('%Y-%m-%d %H:%M:%S', ResponseDate) = strftime('%Y-%m-%d %H:%M:%S', ?)
                 AND SupplierID = ?`,
                [formattedDate, supplierId]
            );

            // Delete reference changes
            const deleteReferencesResult = await runAsync(
                db,
                `DELETE FROM ItemReferenceChange 
                 WHERE strftime('%Y-%m-%d %H:%M:%S', ChangeDate) = strftime('%Y-%m-%d %H:%M:%S', ?)
                 AND SupplierID = ?`,
                [formattedDate, supplierId]
            );

            // Log deletion results
            console.log('Delete results:', {
                responses: deleteResponsesResult,
                references: deleteReferencesResult,
                formattedDate,
                supplierId
            });

            // Commit transaction
            await runAsync(db, 'COMMIT');

            res.json({ 
                message: 'Supplier responses and references deleted successfully',
                deletedResponses: deleteResponsesResult?.changes || 0,
                deletedReferences: deleteReferencesResult?.changes || 0
            });
        } catch (error) {
            console.error('Error in bulk delete:', error);
            await runAsync(db, 'ROLLBACK');
            res.status(500).json({ 
                error: 'Failed to delete supplier responses and references',
                message: error.message
            });
        }
    });

    // Delete a single supplier response
    router.delete('/:responseId', (req, res) => {
        const { responseId } = req.params;
        
        db.run('DELETE FROM SupplierResponse WHERE SupplierResponseID = ?', [responseId], function(err) {
            if (err) {
                console.error('Error deleting supplier response:', err);
                return res.status(500).json({ error: 'Failed to delete supplier response' });
            }
            res.json({ message: 'Supplier response deleted successfully' });
        });
    });

    // Delete a reference change
    router.delete('/reference/:changeId', (req, res) => {
        const { changeId } = req.params;
        
        db.run('DELETE FROM ItemReferenceChange WHERE ChangeID = ?', [changeId], function(err) {
            if (err) {
                console.error('Error deleting reference change:', err);
                return res.status(500).json({ error: 'Failed to delete reference change' });
            }
            res.json({ message: 'Reference change deleted successfully' });
        });
    });

    // Get Excel columns for mapping
    router.post('/columns', (req, res) => {
        upload(req, res, async function(err) {
            if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({
                    error: 'File upload failed',
                    message: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded',
                    message: 'Please select a file to upload'
                });
            }

            try {
                // Read Excel file to get columns
                const columns = ExcelProcessor.getExcelColumns(req.file.path);
                
                res.json({
                    columns,
                    tempFile: req.file.filename
                });
            } catch (error) {
                console.error('Error reading Excel columns:', error);
                
                // Clean up file on error
                try {
                    fs.unlinkSync(req.file.path);
                } catch (unlinkError) {
                    console.error('Error cleaning up file:', unlinkError);
                }

                res.status(500).json({
                    error: 'Failed to read Excel columns',
                    message: error.message
                });
            }
        });
    });

    // Handle supplier response upload
    router.post('/upload', async (req, res) => {
        const { tempFile, columnMapping, supplierId, inquiryId } = req.body;

        if (!tempFile || !columnMapping || !supplierId) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Please provide tempFile, columnMapping, and supplierId'
            });
        }

        const filePath = path.join(__dirname, '..', 'uploads', tempFile);
        if (!fs.existsSync(filePath)) {
            return res.status(400).json({
                error: 'File not found',
                message: 'The uploaded file was not found. Please try again.'
            });
        }

        const itemModel = new ItemModel(db);

        try {
            // Read and process the Excel file with column mapping
            const { data: excelData } = ExcelProcessor.readExcelFile(filePath);
            console.log('Excel data:', excelData);

            if (!excelData || !excelData.length) {
                throw new Error('No data found in Excel file');
            }

            const { data: processedData } = ExcelProcessor.processSupplierResponse(excelData, supplierId, columnMapping);
            console.log('Processed data:', processedData);

            if (!processedData || !processedData.length) {
                throw new Error('No valid data rows found in supplier response');
            }

            // Start transaction
            await runAsync(db, 'BEGIN TRANSACTION');

            try {
                // First, clean up any existing self-references
                await cleanupSelfReferences(db);

                // Process each row
                for (const row of processedData) {
                    const { itemID, newReferenceID, price, notes } = row;
                    const cleanedItemId = cleanItemId(itemID);
                    console.log('Processing row:', { ...row, itemID: cleanedItemId });

                    // Check if item exists
                    const itemExists = await checkItemExists(db, cleanedItemId);
                    if (!itemExists) {
                        // Create new item if it doesn't exist
                        console.log(`Creating new item: ${cleanedItemId}`);
                        await createItem(db, {
                            itemID: cleanedItemId,
                            englishDescription: row.englishDescription,
                            hsCode: row.hsCode
                        });
                    } else {
                        // Update existing item with new information
                        console.log(`Updating existing item: ${cleanedItemId}`);
                        await updateItem(db, {
                            itemID: cleanedItemId,
                            englishDescription: row.englishDescription,
                            hsCode: row.hsCode
                        });
                    }

                    // Record supplier response (price)
                    if (price !== null) {
                        await runAsync(
                            db,
                            `INSERT INTO SupplierResponse (ItemID, SupplierID, PriceQuoted, Status)
                             VALUES (?, ?, ?, 'Active')`,
                            [cleanedItemId, supplierId, price]
                        );
                    }

                    // Handle reference change if newReferenceID is provided
                    if (newReferenceID !== null) {
                        const cleanedRefId = cleanItemId(newReferenceID);
                        
                        // Skip if it's a self-reference
                        if (cleanedRefId !== cleanedItemId) {
                            // Check if reference item exists
                            const refExists = await checkItemExists(db, cleanedRefId);
                            if (!refExists) {
                                console.log(`Creating new reference item: ${cleanedRefId}`);
                                await createItem(db, {
                                    itemID: cleanedRefId,
                                    englishDescription: '',
                                    hsCode: ''
                                });
                            }

                            await runAsync(
                                db,
                                `INSERT INTO ItemReferenceChange (OriginalItemID, NewReferenceID, SupplierID, ChangeDate, Notes)
                                 VALUES (?, ?, ?, datetime('now'), ?)`,
                                [cleanedItemId, cleanedRefId, supplierId, notes]
                            );
                        }
                    }

                    // Update inquiry item if inquiryId is provided
                    if (inquiryId) {
                        await runAsync(
                            db,
                            `UPDATE InquiryItem 
                             SET HSCode = COALESCE(?, HSCode),
                                 EnglishDescription = COALESCE(?, EnglishDescription)
                             WHERE InquiryID = ? AND ItemID = ?`,
                            [row.hsCode, row.englishDescription, inquiryId, cleanedItemId]
                        );
                    }
                }

                // Commit transaction
                await runAsync(db, 'COMMIT');

                // Clean up uploaded file
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkError) {
                    console.error('Error cleaning up file:', unlinkError);
                }

                console.log('Supplier response processed successfully');
                res.json({
                    message: 'Supplier response processed successfully',
                    updatedItems: processedData.length
                });

            } catch (error) {
                // Rollback transaction on error
                await runAsync(db, 'ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error processing supplier response:', error);

            // Clean up uploaded file
            try {
                fs.unlinkSync(filePath);
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }

            res.status(500).json({
                error: 'Failed to process supplier response',
                message: error.message
            });
        }
    });

    return router;
}

module.exports = createRouter;
