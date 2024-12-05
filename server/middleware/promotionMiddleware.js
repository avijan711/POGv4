const debug = require('../utils/debug');
const { validateFileType } = require('../utils/excelProcessor/validator');
const { cleanupFile } = require('./upload');
const path = require('path');
const fs = require('fs');

function validateUpload(req, res, next) {
    try {
        // Check if file exists
        if (!req.file) {
            const error = new Error('No file uploaded');
            error.name = 'ValidationError';
            throw error;
        }

        // Set the full path in req.file
        req.file.fullPath = path.join(__dirname, '..', 'uploads', req.file.filename);

        // Verify file exists
        if (!fs.existsSync(req.file.fullPath)) {
            throw new Error('File not found after upload');
        }

        // Update req.file with the correct path
        req.file.path = req.file.fullPath;

        // Only validate additional fields for /upload endpoint
        if (req.path === '/upload') {
            // Check required fields
            if (!req.body.name) {
                const error = new Error('Promotion name is required');
                error.name = 'ValidationError';
                throw error;
            }

            if (!req.body.supplier_id) {
                const error = new Error('Supplier ID is required');
                error.name = 'ValidationError';
                throw error;
            }

            if (!req.body.start_date) {
                const error = new Error('Start date is required');
                error.name = 'ValidationError';
                throw error;
            }

            if (!req.body.end_date) {
                const error = new Error('End date is required');
                error.name = 'ValidationError';
                throw error;
            }

            // Validate dates
            const startDate = new Date(req.body.start_date);
            const endDate = new Date(req.body.end_date);

            if (isNaN(startDate.getTime())) {
                const error = new Error('Invalid start date format');
                error.name = 'ValidationError';
                throw error;
            }

            if (isNaN(endDate.getTime())) {
                const error = new Error('Invalid end date format');
                error.name = 'ValidationError';
                throw error;
            }

            if (endDate <= startDate) {
                const error = new Error('End date must be after start date');
                error.name = 'ValidationError';
                throw error;
            }

            // Check column mapping
            if (!req.body.column_mapping) {
                const error = new Error('Column mapping is required');
                error.name = 'ValidationError';
                throw error;
            }

            try {
                JSON.parse(req.body.column_mapping);
            } catch (error) {
                const parseError = new Error('Invalid column mapping format');
                parseError.name = 'ValidationError';
                throw parseError;
            }
        }

        next();
    } catch (error) {
        debug.error('Upload validation error:', error);
        if (req.file?.path) {
            cleanupFile(req.file.path);
        }
        if (error.name === 'ValidationError') {
            res.status(400).json({
                error: 'Validation failed',
                message: error.message,
                suggestion: 'Please check your input data'
            });
        } else {
            next(error);
        }
    }
}

function handleErrors(err, req, res, next) {
    debug.error('Error in promotion middleware:', err);
    
    // If error has already been handled, pass it along
    if (res.headersSent) {
        return next(err);
    }
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            message: err.message,
            suggestion: 'Please check your input data'
        });
    }

    if (err.name === 'FileTypeError') {
        return res.status(400).json({
            error: 'Invalid file type',
            message: err.message,
            suggestion: 'Please upload an Excel file (.xlsx or .xls)'
        });
    }

    if (err.name === 'ColumnMappingError') {
        return res.status(400).json({
            error: 'Invalid column mapping',
            message: err.message,
            suggestion: 'Please check your column mapping configuration'
        });
    }

    // If we haven't handled the error and headers haven't been sent, pass it to the next handler
    if (!res.headersSent) {
        next(err);
    }
}

module.exports = {
    validateUpload,
    handleErrors
};
