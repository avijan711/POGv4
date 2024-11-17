const express = require('express');
const path = require('path');
const { handleUpload, handleBasicUpload, validateExcelFile, cleanupFile } = require('../middleware/upload');
const ExcelProcessor = require('../utils/excelProcessor');

module.exports = function(inquiryModel) {
    const router = express.Router();

    // POST /api/inquiries/columns - Get Excel columns
    router.post('/columns', handleBasicUpload, async (req, res) => {
        try {
            console.log('Reading columns from file:', req.file.path);
            const columns = ExcelProcessor.getExcelColumns(req.file.path);
            console.log('Found columns:', columns);

            // Clean up the uploaded file
            cleanupFile(req.file.path);

            res.json({ columns });
        } catch (error) {
            console.error('Error reading Excel columns:', error);
            
            // Clean up file if it exists
            if (req.file) {
                cleanupFile(req.file.path);
            }

            res.status(500).json({
                error: 'Failed to read Excel columns',
                details: error.message,
                suggestion: 'Please ensure your file is a valid Excel file with headers in the first row'
            });
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
                inquiryNumber: body.inquiryNumber,
                fileSize: file.size
            });

            // Parse column mapping
            let columnMapping;
            try {
                columnMapping = JSON.parse(body.columnMapping);
                console.log('\nColumn Mapping:', columnMapping);
            } catch (error) {
                console.error('Error parsing column mapping:', error);
                throw new Error(`Invalid column mapping format: ${error.message}`);
            }

            // Process Excel data
            let excelData;
            let headers;
            try {
                console.log('\nReading Excel file...');
                const result = ExcelProcessor.readExcelFile(file.path);
                excelData = result.data;
                headers = result.headers;
                
                console.log('Headers found:', headers);
                console.log('Number of rows:', excelData.length);
                console.log('First row sample:', JSON.stringify(excelData[0], null, 2));

                // Validate the column mapping
                ExcelProcessor.validateColumnMapping(headers, columnMapping);
            } catch (error) {
                console.error('Error reading Excel file:', error);
                throw new Error(`Failed to read Excel file: ${error.message}`);
            }

            // Process items
            console.log('\nProcessing items...');
            const processedItems = excelData.map((row, index) => {
                try {
                    // Log raw values before processing
                    console.log(`\nProcessing row ${index + 1}:`, {
                        itemId: row[columnMapping.itemID],
                        retailPrice: row[columnMapping.retailPrice],
                        requestedQty: row[columnMapping.requestedQty],
                        importMarkup: row[columnMapping.importMarkup]
                    });

                    // Validate required fields
                    if (!row[columnMapping.itemID]) {
                        throw new Error('Item ID is required');
                    }
                    if (!row[columnMapping.hebrewDescription]) {
                        throw new Error('Hebrew Description is required');
                    }
                    if (!row[columnMapping.requestedQty] && row[columnMapping.requestedQty] !== 0) {
                        throw new Error('Requested Quantity is required');
                    }

                    // Process retail price with proper type conversion
                    let retailPrice = null;
                    if (columnMapping.retailPrice && row[columnMapping.retailPrice] !== undefined && row[columnMapping.retailPrice] !== '') {
                        const rawPrice = row[columnMapping.retailPrice];
                        if (typeof rawPrice === 'number') {
                            retailPrice = rawPrice;
                        } else {
                            // Remove any non-numeric characters except decimal point and minus
                            const cleanPrice = rawPrice.toString().replace(/[^\d.-]/g, '');
                            const parsedPrice = parseFloat(cleanPrice);
                            if (!isNaN(parsedPrice)) {
                                retailPrice = parsedPrice;
                            }
                        }
                    }

                    // Map Excel columns to item fields with type conversion logging
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

                    // Log processed item for verification
                    console.log('Processed item:', {
                        itemId: item.itemId,
                        retailPrice: item.retailPrice,
                        requestedQty: item.requestedQty,
                        importMarkup: item.importMarkup
                    });

                    // Validate numeric fields
                    const numericValidation = {
                        importMarkup: { value: item.importMarkup, min: 1, max: 2, default: 1.3 },
                        qtyInStock: { value: item.qtyInStock, min: 0, default: 0 },
                        soldThisYear: { value: item.soldThisYear, min: 0, default: 0 },
                        soldLastYear: { value: item.soldLastYear, min: 0, default: 0 },
                        requestedQty: { value: item.requestedQty, min: 0, default: 0 }
                    };

                    for (const [field, validation] of Object.entries(numericValidation)) {
                        if (isNaN(validation.value) || validation.value < validation.min || 
                            (validation.max && validation.value > validation.max)) {
                            console.log(`Invalid ${field}:`, validation.value, 'using default:', validation.default);
                            item[field] = validation.default;
                        }
                    }

                    // Additional validation for retail price
                    if (item.retailPrice !== null && (isNaN(item.retailPrice) || item.retailPrice < 0)) {
                        console.log('Invalid retail price:', item.retailPrice, 'setting to null');
                        item.retailPrice = null;
                    }

                    return item;
                } catch (error) {
                    console.error(`Error processing row ${index + 1}:`, error);
                    throw new Error(`Error in row ${index + 2}: ${error.message}`);
                }
            });

            // Create inquiry in database
            console.log('\nSaving to database:', {
                inquiryNumber: body.inquiryNumber,
                itemCount: processedItems.length,
                items: processedItems.map(item => ({
                    itemId: item.itemId,
                    retailPrice: item.retailPrice,
                    requestedQty: item.requestedQty
                }))
            });

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

            res.status(404).json({ error: 'Inquiry not found' });
        } catch (error) {
            console.error('Error fetching inquiry details:', error);
            res.status(500).json({ error: 'Failed to fetch inquiry details' });
        }
    });

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
