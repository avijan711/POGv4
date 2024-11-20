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
            throw new Error('No file uploaded');
        }

        // Validate file type using the actual file path
        validateFileType(req.file.path);

        // Check column mapping
        if (!req.body.columnMapping) {
            throw new Error('Column mapping is required');
        }

        let columnMapping;
        try {
            columnMapping = JSON.parse(req.body.columnMapping);
        } catch (error) {
            throw new Error('Invalid column mapping format');
        }

        // Ensure all mapping values are strings
        Object.entries(columnMapping).forEach(([field, value]) => {
            if (value && typeof value !== 'string') {
                debug.error('Invalid column mapping value:', { field, value });
                throw new Error(`Invalid column mapping value for field: ${field}`);
            }
        });

        // Check required fields using database field names
        if (!columnMapping.ItemID) {
            throw new Error('Item ID column mapping is required');
        }

        // Check supplier ID
        if (!req.body.supplierId) {
            throw new Error('Supplier ID is required');
        }

        // Check inquiry ID
        if (!req.body.inquiryId) {
            throw new Error('Inquiry ID is required');
        }

        next();
    } catch (error) {
        debug.error('Upload validation error:', error);
        res.status(400).json({
            error: 'Validation failed',
            message: error.message,
            suggestion: 'Please check your file and column mapping'
        });
    }
}

function handleErrors(err, req, res, next) {
    debug.error('Error in supplier response middleware:', err);
    
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

    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        suggestion: 'Please try again or contact support'
    });
}

module.exports = {
    validateInquiryId,
    validateResponseId,
    validateChangeId,
    validateBulkDelete,
    validateUpload,
    handleErrors
};
