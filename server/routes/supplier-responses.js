const express = require('express');
const multer = require('multer');
const debug = require('../utils/debug');
const SupplierResponseService = require('../services/supplierResponseService');
const {
    validateInquiryId,
    validateResponseId,
    validateChangeId,
    validateBulkDelete,
    validateUpload,
    handleErrors
} = require('../middleware/supplierResponseMiddleware');
const { uploadConfig, handleUploadError, cleanupFile } = require('../middleware/upload');
const ExcelProcessor = require('../utils/excelProcessor/index');
const fs = require('fs');
const path = require('path');

function createRouter(db) {
    const router = express.Router();
    const supplierResponseService = new SupplierResponseService(db);
    const upload = multer(uploadConfig);

    // Get columns from Excel file
    router.post('/columns', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                throw new Error('No file uploaded');
            }

            // Use the full path from req.file
            const filePath = req.file.fullPath || path.join(__dirname, '..', 'uploads', req.file.filename);

            // Verify file exists
            if (!fs.existsSync(filePath)) {
                throw new Error('File not found after upload');
            }

            debug.log('Reading columns from file:', filePath);
            
            try {
                const rawColumns = await ExcelProcessor.getColumns(filePath);
                
                // Process columns to ensure they are valid strings
                const processedColumns = rawColumns
                    .filter(col => col != null)
                    .map(col => String(col).trim())
                    .filter(col => col.length > 0);

                debug.log('Processed columns:', processedColumns);

                if (processedColumns.length === 0) {
                    throw new Error('No valid columns found in the Excel file');
                }

                res.json({
                    columns: processedColumns,
                    tempFile: req.file.filename
                });
            } catch (excelError) {
                debug.error('Error processing Excel file:', excelError);
                throw new Error(`Failed to read Excel file: ${excelError.message}`);
            }
        } catch (error) {
            debug.error('Error reading Excel columns:', error);
            if (req.file?.fullPath) {
                cleanupFile(req.file.fullPath);
            }
            res.status(400).json({
                error: 'Failed to read Excel columns',
                message: error.message,
                suggestion: 'Please ensure your file is a valid Excel file with headers in the first row'
            });
        }
    });

    // Get supplier responses for an inquiry with pagination
    router.get('/inquiry/:inquiryId', validateInquiryId, async (req, res, next) => {
        try {
            // Validate and sanitize pagination parameters
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize) || 50));
            
            debug.log('Fetching supplier responses:', {
                inquiryId: req.params.inquiryId,
                page,
                pageSize
            });

            const responses = await supplierResponseService.getSupplierResponses(
                req.params.inquiryId,
                page,
                pageSize
            );

            // Add pagination metadata to response headers
            res.set({
                'X-Page': responses.pagination.page,
                'X-Page-Size': responses.pagination.pageSize,
                'X-Has-More': responses.pagination.hasMore
            });

            res.json(responses.data);
        } catch (err) {
            debug.error('Error in supplier responses route:', err);
            next(err);
        }
    });

    // Delete a specific supplier response
    router.delete('/:responseId', validateResponseId, async (req, res, next) => {
        try {
            const result = await supplierResponseService.deleteResponse(req.params.responseId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Delete a reference change
    router.delete('/reference-change/:changeId', validateChangeId, async (req, res, next) => {
        try {
            const result = await supplierResponseService.deleteReferenceChange(req.params.changeId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Delete all responses for a supplier on a specific date
    router.delete('/bulk/:date/:supplierId', validateBulkDelete, async (req, res, next) => {
        try {
            const result = await supplierResponseService.deleteBulkResponses(
                req.params.date,
                req.params.supplierId
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Handle supplier response upload
    router.post('/upload', upload.single('file'), validateUpload, async (req, res, next) => {
        try {
            if (!req.file) {
                throw new Error('No file uploaded');
            }

            // Use the full path from req.file
            const filePath = req.file.fullPath || path.join(__dirname, '..', 'uploads', req.file.filename);

            // Verify file exists
            if (!fs.existsSync(filePath)) {
                throw new Error('File not found after upload');
            }

            // Update req.file with the correct path
            req.file.path = filePath;

            const result = await supplierResponseService.processUpload(
                req.file,
                req.body.columnMapping,
                req.body.supplierId,
                req.body.inquiryId
            );
            res.json(result);
        } catch (error) {
            debug.error('Upload processing error:', error);
            if (req.file?.fullPath) {
                cleanupFile(req.file.fullPath);
            }
            next(error);
        }
    });

    // Error handling middleware
    router.use(handleErrors);

    return router;
}

module.exports = createRouter;
