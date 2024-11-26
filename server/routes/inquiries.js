const express = require('express');
const multer = require('multer');
const ExcelProcessor = require('../utils/excelProcessor/index');
const { getExcelColumns } = require('../utils/excelProcessor/columnReader');
const InquiryModel = require('../models/inquiry');
const InquiryItemModel = require('../models/inquiry/item');
const Promotion = require('../models/promotion');
const debug = require('../utils/debug');
const { handleUpload, cleanupFile } = require('../middleware/upload');
const XLSX = require('xlsx');
const path = require('path');

function createRouter(db) {
    const router = express.Router();
    const inquiryModel = new InquiryModel(db);
    const inquiryItemModel = new InquiryItemModel(db);

    // Get Excel columns for mapping
    router.post('/columns', handleUpload, async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded',
                    details: 'Please select a file to upload',
                    suggestion: 'Make sure you have selected an Excel file'
                });
            }

            debug.log('Reading columns from file:', req.file.path);
            const columns = await getExcelColumns(req.file.path);
            
            // Clean up the file after reading columns
            cleanupFile(req.file.path);
            
            res.json({ columns });
        } catch (err) {
            debug.error('Error reading columns:', err);
            cleanupFile(req.file?.path);
            next(err);
        }
    });

    // Upload Excel file
    router.post('/upload', handleUpload, async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded',
                    details: 'Please select a file to upload',
                    suggestion: 'Make sure you have selected an Excel file'
                });
            }

            debug.log('Upload request:', {
                file: req.file,
                body: req.body
            });

            const { inquiryNumber, columnMapping } = req.body;
            if (!inquiryNumber) {
                return res.status(400).json({
                    error: 'Missing inquiry number',
                    details: 'An inquiry number is required',
                    suggestion: 'Please provide a valid inquiry number'
                });
            }

            if (!columnMapping) {
                return res.status(400).json({
                    error: 'Missing column mapping',
                    details: 'Column mapping is required',
                    suggestion: 'Please map the Excel columns to the required fields'
                });
            }

            let parsedMapping;
            try {
                parsedMapping = JSON.parse(columnMapping);
            } catch (err) {
                debug.error('Error parsing column mapping:', err);
                return res.status(400).json({
                    error: 'Invalid column mapping format',
                    details: 'The column mapping could not be parsed',
                    suggestion: 'Please ensure the column mapping is valid JSON'
                });
            }
            
            // Validate the mapping using snake_case field names
            ExcelProcessor.validateMapping(parsedMapping, ['item_id', 'hebrew_description', 'requested_qty']);
            
            // Process the Excel file using the processInquiry method, passing the db connection
            const items = await ExcelProcessor.processInquiry(req.file.path, parsedMapping, db);
            
            debug.log('Processed items:', {
                count: items.length,
                sample: items[0]
            });

            // Create the inquiry
            const inquiry = await inquiryModel.createInquiry({
                inquiryNumber,
                items
            });

            // Clean up the uploaded file after processing
            cleanupFile(req.file.path);

            res.json({
                message: 'File processed successfully',
                inquiryId: inquiry.id,
                itemCount: items.length
            });
        } catch (err) {
            debug.error('Error processing file:', err);
            cleanupFile(req.file?.path);
            
            // Send appropriate error response
            if (err.message.includes('Missing required column mappings')) {
                return res.status(400).json({
                    error: 'Invalid column mapping',
                    details: err.message,
                    suggestion: 'Please ensure all required columns are mapped'
                });
            }
            
            if (err.message.includes('validation failed')) {
                return res.status(400).json({
                    error: 'Data validation failed',
                    details: err.message,
                    suggestion: 'Please check your Excel file data'
                });
            }

            next(err);
        }
    });

    // Get all inquiries
    router.get('/', async (req, res, next) => {
        try {
            const inquiries = await inquiryModel.getAllInquiries();
            res.json(inquiries);
        } catch (err) {
            next(err);
        }
    });

    // Get specific inquiry
    router.get('/:id', async (req, res, next) => {
        try {
            const inquiry = await inquiryModel.getInquiryById(req.params.id);
            if (!inquiry) {
                return res.status(404).json({ error: 'Inquiry not found' });
            }
            res.json(inquiry);
        } catch (err) {
            next(err);
        }
    });

    // Export inquiry for suppliers
    router.get('/:id/export', async (req, res, next) => {
        try {
            debug.log('Exporting inquiry:', req.params.id);
            
            // Get inquiry data
            const inquiry = await inquiryModel.getInquiryById(req.params.id);
            if (!inquiry) {
                return res.status(404).json({ error: 'Inquiry not found' });
            }

            // Parse items if needed
            let items = inquiry.items;
            if (typeof items === 'string') {
                items = JSON.parse(items);
            }

            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Transform items into rows with snake_case column names
            const rows = items.map(item => ({
                item_id: item.item_id || '',
                requested_qty: item.requested_qty || ''
            }));

            // Create worksheet with no header row
            const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });

            // Add header row manually
            XLSX.utils.sheet_add_aoa(ws, [['item_id', 'requested_qty']], { origin: 'A1' });

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

            // Generate filename
            const filename = `inquiry_export_${Date.now()}.xlsx`;
            const filepath = path.join(__dirname, '..', 'uploads', filename);

            // Write file
            XLSX.writeFile(wb, filepath);

            // Set headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Send file and clean up
            res.download(filepath, filename, (err) => {
                // Clean up file after sending
                cleanupFile(filepath);
                if (err) {
                    debug.error('Error sending file:', err);
                    next(err);
                }
            });
        } catch (err) {
            debug.error('Error exporting inquiry:', err);
            next(err);
        }
    });

    // Create new inquiry
    router.post('/', async (req, res, next) => {
        try {
            const inquiry = await inquiryModel.createInquiry(req.body);
            res.status(201).json(inquiry);
        } catch (err) {
            next(err);
        }
    });

    // Update inquiry
    router.put('/:id', async (req, res, next) => {
        try {
            const inquiry = await inquiryModel.updateInquiry(req.params.id, req.body);
            if (!inquiry) {
                return res.status(404).json({ error: 'Inquiry not found' });
            }
            res.json(inquiry);
        } catch (err) {
            next(err);
        }
    });

    // Delete inquiry
    router.delete('/:id', async (req, res, next) => {
        try {
            const result = await inquiryModel.deleteInquiry(req.params.id);
            if (!result) {
                return res.status(404).json({ error: 'Inquiry not found' });
            }
            res.json({ message: 'Inquiry deleted successfully' });
        } catch (err) {
            next(err);
        }
    });

    // Update inquiry item quantity
    router.put('/inquiry-items/:id/quantity', async (req, res, next) => {
        try {
            debug.log('Updating quantity:', {
                itemId: req.params.id,
                requestedQty: req.body.requested_qty
            });

            const { requested_qty } = req.body;
            if (requested_qty === undefined || requested_qty === null) {
                return res.status(400).json({
                    error: 'Invalid quantity',
                    details: 'Quantity must be provided'
                });
            }

            const qty = parseInt(requested_qty);
            if (isNaN(qty) || qty < 0) {
                return res.status(400).json({
                    error: 'Invalid quantity',
                    details: 'Quantity must be a non-negative number'
                });
            }

            try {
                // Use updateQuantity instead of updateInquiryItem
                const result = await inquiryItemModel.updateQuantity(req.params.id, qty);

                if (result) {
                    res.json({ message: 'Quantity updated successfully' });
                }
            } catch (error) {
                if (error.message.includes('not found')) {
                    return res.status(404).json({ 
                        error: 'Item not found',
                        details: error.message
                    });
                }
                throw error;
            }
        } catch (err) {
            debug.error('Error updating quantity:', err);
            next(err);
        }
    });

    // Delete inquiry item
    router.delete('/inquiry-items/:id', async (req, res, next) => {
        try {
            debug.log('Deleting item:', req.params.id);
            
            try {
                const result = await inquiryItemModel.deleteItem(req.params.id);
                if (result) {
                    res.json({ message: 'Item deleted successfully' });
                }
            } catch (error) {
                if (error.message.includes('not found')) {
                    return res.status(404).json({ 
                        error: 'Item not found',
                        details: error.message
                    });
                }
                throw error;
            }
        } catch (err) {
            debug.error('Error deleting item:', err);
            next(err);
        }
    });

    return router;
}

module.exports = createRouter;
