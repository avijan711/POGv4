const debug = require('../utils/debug');
const { validateFileType } = require('../utils/excelProcessor/validator');
const { cleanupFile } = require('./upload');
const path = require('path');
const fs = require('fs');

function validateUpload(req, res, next) {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'No file uploaded',
        code: 'NO_FILE_ERROR',
      });
    }

    // Set the full path in req.file
    req.file.fullPath = path.join(__dirname, '..', 'uploads', req.file.filename);

    // Verify file exists
    if (!fs.existsSync(req.file.fullPath)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'File not found after upload',
        code: 'FILE_NOT_FOUND_ERROR',
      });
    }

    // Update req.file with the correct path
    req.file.path = req.file.fullPath;

    // Only validate additional fields for /upload endpoint
    if (req.path === '/upload') {
      const validationErrors = [];

      // Check required fields
      if (!req.body.name) {
        validationErrors.push('Promotion name is required');
      }

      if (!req.body.supplier_id) {
        validationErrors.push('Supplier ID is required');
      }

      if (!req.body.start_date) {
        validationErrors.push('Start date is required');
      }

      if (!req.body.end_date) {
        validationErrors.push('End date is required');
      }

      // Validate dates if provided
      if (req.body.start_date && req.body.end_date) {
        const startDate = new Date(req.body.start_date);
        const endDate = new Date(req.body.end_date);

        if (isNaN(startDate.getTime())) {
          validationErrors.push('Invalid start date format');
        }

        if (isNaN(endDate.getTime())) {
          validationErrors.push('Invalid end date format');
        }

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate <= startDate) {
          validationErrors.push('End date must be after start date');
        }
      }

      // Check column mapping
      if (!req.body.column_mapping) {
        validationErrors.push('Column mapping is required');
      } else {
        try {
          JSON.parse(req.body.column_mapping);
        } catch (error) {
          validationErrors.push('Invalid column mapping format');
        }
      }

      // If there are validation errors, return them all at once
      if (validationErrors.length > 0) {
        // Let the route handler clean up the file
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Please check your input data',
          code: 'VALIDATION_ERROR',
          details: {
            errors: validationErrors,
          },
        });
      }
    }

    next();
  } catch (error) {
    debug.error('Upload validation error:', error);
    // Let the route handler clean up the file
    next(error);
  }
}

function handleErrors(err, req, res, next) {
  debug.error('Error in promotion middleware:', err);
    
  // If error has already been handled, pass it along
  if (res.headersSent) {
    return next(err);
  }
    
  // Handle specific error types
  if (err.name === 'PromotionError') {
    return res.status(400).json({
      error: 'Promotion operation failed',
      message: err.message,
      code: err.code,
      details: err.details,
      suggestion: getSuggestionForError(err.code),
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: err.message,
      code: 'VALIDATION_ERROR',
      suggestion: 'Please check your input data',
    });
  }

  if (err.name === 'FileTypeError') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: err.message,
      code: 'FILE_TYPE_ERROR',
      suggestion: 'Please upload an Excel file (.xlsx or .xls)',
    });
  }

  // If we haven't handled the error and headers haven't been sent, pass it to the next handler
  if (!res.headersSent) {
    next(err);
  }
}

// Helper function to provide specific suggestions based on error codes
function getSuggestionForError(code) {
  const suggestions = {
    'INVALID_ITEMS_ERROR': 'Please ensure all items exist in the system before uploading',
    'INVALID_SUPPLIER_ERROR': 'Please verify the supplier ID is correct',
    'INVALID_EXCEL_DATA': 'Please check the Excel file format and ensure it contains valid data',
    'UPLOAD_PROCESSING_ERROR': 'Please try uploading the file again',
    'ITEM_INSERTION_ERROR': 'Please verify all items are valid and try again',
    'PROMOTION_CREATION_ERROR': 'Please check the promotion details and try again',
    'EXCEL_COLUMN_ERROR': 'Please ensure the Excel file has the required columns',
  };
    
  return suggestions[code] || 'Please check your input and try again';
}

module.exports = {
  validateUpload,
  handleErrors,
};
