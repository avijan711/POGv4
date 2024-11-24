const debug = require('../utils/debug');
const { validateFileType } = require('../utils/excelProcessor/validator');

function validateInquiryId(req, res, next) {
    const inquiryId = req.params.inquiryId;
    if (!inquiryId) {
        return res.status(400).json({ error: 'Inquiry ID is required' });
    }
    next();
}

function validateResponseId(req, res, next) {
    const responseId = req.params.responseId;
    if (!responseId) {
        return res.status(400).json({ error: 'Response ID is required' });
    }
    next();
}

function validateChangeId(req, res, next) {
    const changeId = req.params.changeId;
    if (!changeId) {
        return res.status(400).json({ error: 'Change ID is required' });
    }
    next();
}

function validateBulkDelete(req, res, next) {
    const { date, supplierId } = req.params;
    if (!date || !supplierId) {
        return res.status(400).json({ error: 'Date and supplier ID are required' });
    }
    next();
}

function validateUpload(req, res, next) {
    try {
        // Check if file exists
        if (!req.file) {
            const error = new Error('No file uploaded');
            error.name = 'ValidationError';
            throw error;
        }

        // Validate file type using the actual file path
        validateFileType(req.file.path);

        // Check column mapping
        if (!req.body.columnMapping) {
            const error = new Error('Column mapping is required');
            error.name = 'ValidationError';
            throw error;
        }

        let columnMapping;
        try {
            columnMapping = JSON.parse(req.body.columnMapping);
        } catch (error) {
            const parseError = new Error('Invalid column mapping format');
            parseError.name = 'ValidationError';
            throw parseError;
        }

        // Ensure all mapping values are strings
        Object.entries(columnMapping).forEach(([field, value]) => {
            if (value && typeof value !== 'string') {
                debug.error('Invalid column mapping value:', { field, value });
                const error = new Error(`Invalid column mapping value for field: ${field}`);
                error.name = 'ValidationError';
                throw error;
            }
        });

        // Check required fields using database field names
        if (!columnMapping.ItemID) {
            const error = new Error('Item ID column mapping is required');
            error.name = 'ValidationError';
            throw error;
        }

        // Check supplier ID
        if (!req.body.supplierId) {
            const error = new Error('Supplier ID is required');
            error.name = 'ValidationError';
            throw error;
        }

        // Check inquiry ID
        if (!req.body.inquiryId) {
            const error = new Error('Inquiry ID is required');
            error.name = 'ValidationError';
            throw error;
        }

        next();
    } catch (error) {
        debug.error('Upload validation error:', error);
        // Instead of handling the error here, pass it to the next error handler
        next(error);
    }
}

function handleErrors(err, req, res, next) {
    debug.error('Error in supplier response middleware:', err);
    
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
    validateInquiryId,
    validateResponseId,
    validateChangeId,
    validateBulkDelete,
    validateUpload,
    handleErrors
};
