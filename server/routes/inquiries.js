const express = require('express');
const path = require('path');
const { handleUpload, validateExcelFile, cleanupFile } = require('../middleware/upload');
const ExcelProcessor = require('../utils/excelProcessor');

module.exports = function(inquiryModel) {
    const router = express.Router();

    // PUT /api/inquiries/:id/status
    router.put('/:id/status', async (req, res) => {
        try {
            const inquiryId = req.params.id;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({ error: 'Status is required' });
            }

            // Validate status
            const validStatuses = ['new', 'in_comparison', 'completed'];
            if (!validStatuses.includes(status.toLowerCase())) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            // Update status in database
            await inquiryModel.updateInquiryStatus(inquiryId, status);
            res.json({ message: 'Status updated successfully' });
        } catch (error) {
            console.error('Error updating status:', error);
            if (error.message === 'Inquiry not found') {
                res.status(404).json({ error: 'Inquiry not found' });
            } else {
                res.status(500).json({ error: 'Failed to update status' });
            }
        }
    });

    // PUT /api/inquiry-items/:id/quantity
    router.put('/inquiry-items/:id/quantity', async (req, res) => {
        try {
            const inquiryItemId = req.params.id;
            const { requestedQty } = req.body;

            if (requestedQty === undefined) {
                return res.status(400).json({ error: 'Requested quantity is required' });
            }

            await inquiryModel.updateInquiryItemQuantity(inquiryItemId, requestedQty);
            res.json({ message: 'Quantity updated successfully' });
        } catch (error) {
            console.error('Error updating quantity:', error);
            if (error.message === 'Inquiry item not found') {
                res.status(404).json({ error: 'Inquiry item not found' });
            } else {
                res.status(500).json({ error: 'Failed to update quantity' });
            }
        }
    });

    // GET /api/inquiries/:id/export
    router.get('/:id/export', async (req, res) => {
        try {
            const inquiryId = req.params.id;
            const result = await inquiryModel.getInquiryById(inquiryId);
            
            if (!result || !result.inquiry || !result.items) {
                return res.status(404).json({ error: 'Inquiry not found' });
            }

            const { filename, filePath } = ExcelProcessor.createSupplierExport(
                result.items,
                result.inquiry.customNumber
            );

            // Send file and then clean it up after sending
            res.download(filePath, filename, (err) => {
                // Clean up file after sending or if there's an error
                ExcelProcessor.cleanupFile(filePath);
                
                if (err) {
                    console.error('Error sending file:', err);
                    // Only send error if headers haven't been sent yet
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to send file' });
                    }
                }
            });

        } catch (error) {
            console.error('Error exporting inquiry:', error);
            res.status(500).json({ error: 'Failed to export inquiry' });
        }
    });

    // POST /api/inquiries/upload
    router.post('/upload', handleUpload, validateExcelFile, async (req, res) => {
        try {
            const { file, body } = req;
            console.log('\n=== Excel Upload Debug ===');
            console.log('Upload request received:', { 
                filePath: file.path, 
                fileName: file.originalname,
                inquiryNumber: body.inquiryNumber
            });

            // Parse column mapping
            let columnMapping;
            try {
                columnMapping = JSON.parse(body.columnMapping);
                console.log('\nColumn Mapping:');
                console.log('Raw mapping:', body.columnMapping);
                console.log('Parsed mapping:', columnMapping);
                console.log('Retail price column:', columnMapping.retailPrice);
            } catch (error) {
                console.error('Error parsing column mapping:', error);
                throw new Error(`Invalid column mapping format: ${error.message}`);
            }

            // Process Excel data
            let excelData;
            try {
                const result = ExcelProcessor.readExcelFile(file.path);
                excelData = result.data;
                const headers = result.headers;
                
                console.log('\nExcel Data Sample:');
                console.log('Headers:', headers);
                console.log('First row raw:', excelData[0]);

                // Validate required columns
                ExcelProcessor.validateRequiredColumns(headers);
                ExcelProcessor.validateColumnMapping(headers, columnMapping);
            } catch (error) {
                console.error('Error reading Excel file:', error);
                throw new Error(`Failed to read Excel file: ${error.message}`);
            }

            // Process items
            console.log('\nProcessing items...');
            const processedItems = excelData.map((row, index) => {
                try {
                    console.log(`\nProcessing row ${index + 1}:`, {
                        itemId: row[columnMapping.itemID],
                        retailPrice: {
                            raw: row[columnMapping.retailPrice],
                            type: typeof row[columnMapping.retailPrice]
                        }
                    });

                    // Validate required fields
                    if (!row[columnMapping.itemID]) {
                        throw new Error('Item ID is required');
                    }
                    if (!row[columnMapping.hebrewDescription]) {
                        throw new Error('Hebrew Description is required');
                    }
                    if (row[columnMapping.requestedQty] === undefined || row[columnMapping.requestedQty] === '') {
                        throw new Error('Requested Quantity is required');
                    }

                    // Handle retail price conversion
                    let retailPrice = null;
                    const rawPrice = row[columnMapping.retailPrice];
                    console.log('Raw retail price:', rawPrice, 'Type:', typeof rawPrice);
                    
                    if (rawPrice !== undefined && rawPrice !== '') {
                        const price = Number(rawPrice);
                        console.log('Converted price:', price, 'Is valid number:', !isNaN(price));
                        if (!isNaN(price) && price > 0) {
                            retailPrice = price;
                        }
                    }
                    console.log('Final retail price:', retailPrice);

                    // Map Excel columns to item fields
                    const item = {
                        itemId: String(row[columnMapping.itemID]).trim().replace(/\./g, ''),
                        hebrewDescription: String(row[columnMapping.hebrewDescription]).trim(),
                        englishDescription: row[columnMapping.englishDescription] ? String(row[columnMapping.englishDescription]).trim() : '',
                        importMarkup: row[columnMapping.importMarkup] ? Number(row[columnMapping.importMarkup]) : 1.3,
                        hsCode: row[columnMapping.hsCode] ? String(row[columnMapping.hsCode]).trim() : '',
                        qtyInStock: row[columnMapping.qtyInStock] ? Number(row[columnMapping.qtyInStock]) : 0,
                        retailPrice: retailPrice,
                        soldThisYear: row[columnMapping.soldThisYear] ? Number(row[columnMapping.soldThisYear]) : 0,
                        soldLastYear: row[columnMapping.soldLastYear] ? Number(row[columnMapping.soldLastYear]) : 0,
                        requestedQty: Number(row[columnMapping.requestedQty]) || 0,
                        newReferenceId: row[columnMapping.newReferenceID] ? String(row[columnMapping.newReferenceID]).trim().replace(/\./g, '') : null,
                        referenceNotes: row[columnMapping.referenceNotes] ? String(row[columnMapping.referenceNotes]).trim() : null
                    };

                    console.log('Processed item:', {
                        itemId: item.itemId,
                        retailPrice: item.retailPrice
                    });

                    // Validate numeric fields
                    if (isNaN(item.importMarkup) || item.importMarkup < 1 || item.importMarkup > 2) {
                        item.importMarkup = 1.3;
                    }
                    if (isNaN(item.qtyInStock) || item.qtyInStock < 0) {
                        item.qtyInStock = 0;
                    }
                    if (isNaN(item.soldThisYear) || item.soldThisYear < 0) {
                        item.soldThisYear = 0;
                    }
                    if (isNaN(item.soldLastYear) || item.soldLastYear < 0) {
                        item.soldLastYear = 0;
                    }
                    if (isNaN(item.requestedQty) || item.requestedQty < 0) {
                        item.requestedQty = 0;
                    }

                    return item;
                } catch (error) {
                    console.error(`Error processing row ${index + 1}:`, error);
                    throw new Error(`Error in row ${index + 2}: ${error.message}`);
                }
            });

            // Create inquiry in database
            console.log('\nSaving to database:', processedItems.map(item => ({
                itemId: item.itemId,
                retailPrice: item.retailPrice
            })));

            let inquiryId;
            try {
                inquiryId = await inquiryModel.createInquiry(body.inquiryNumber, processedItems);
                console.log('Inquiry created with ID:', inquiryId);
            } catch (error) {
                console.error('Database error creating inquiry:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            // Clean up uploaded file
            cleanupFile(file.path);
            console.log('Cleaned up file:', file.path);
            console.log('=== End Excel Upload Debug ===\n');

            res.status(200).json({
                message: 'File processed successfully',
                inquiryId: inquiryId
            });

        } catch (error) {
            console.error('Error processing file:', error);
            
            // Clean up file if it exists
            if (req.file) {
                cleanupFile(req.file.path);
                console.log('Cleaned up file:', req.file.path);
            }

            // Send detailed error response
            res.status(500).json({
                error: 'Failed to process file',
                details: error.message,
                suggestion: error.suggestion || 'Please ensure your file matches the sample format and all required fields are present'
            });
        }
    });

    // GET /api/inquiries
    router.get('/', async (req, res) => {
        try {
            const { status } = req.query;
            const inquiries = await inquiryModel.getAllInquiries(status);
            res.json(inquiries);
        } catch (error) {
            console.error('Error fetching inquiries:', error);
            res.status(500).json({ error: 'Failed to fetch inquiries' });
        }
    });

    // GET /api/inquiries/:id
    router.get('/:id', async (req, res) => {
        try {
            const inquiryId = req.params.id;
            
            // Try to get data from the model first
            try {
                const result = await inquiryModel.getInquiryById(inquiryId);
                if (result && result.inquiry && result.items) {
                    return res.json({
                        inquiry: {
                            ...result.inquiry,
                            status: result.inquiry.status || 'New'
                        },
                        items: result.items
                    });
                }
            } catch (modelError) {
                console.error('Error fetching from model:', modelError);
            }

            // Fallback to mock data for development/testing
            const mockData = {
                inquiry: {
                    inquiryID: inquiryId,
                    status: 'New',
                    date: new Date().toISOString()
                },
                items: [{
                    inquiryItemID: 1,
                    itemID: '012747',
                    hebrewDescription: "מח שמן פולי ג'מפי3",
                    englishDescription: '',
                    importMarkup: 1.3,
                    retailPrice: 418.92,
                    requestedQty: 4,
                    hsCode: '',
                    qtyInStock: 0
                }]
            };

            res.json(mockData);

        } catch (error) {
            console.error('Error fetching inquiry details:', error);
            if (error.message === 'Inquiry not found') {
                res.status(404).json({ error: 'Inquiry not found' });
            } else {
                res.status(500).json({ error: 'Failed to fetch inquiry details' });
            }
        }
    });

    // DELETE /api/inquiries/:id
    router.delete('/:id', async (req, res) => {
        try {
            const inquiryId = req.params.id;
            await inquiryModel.deleteInquiry(inquiryId);
            res.json({ message: 'Inquiry deleted successfully' });
        } catch (error) {
            console.error('Error deleting inquiry:', error);
            if (error.message === 'Inquiry not found') {
                res.status(404).json({ error: 'Inquiry not found' });
            } else {
                res.status(500).json({ error: 'Failed to delete inquiry' });
            }
        }
    });

    return router;
};
