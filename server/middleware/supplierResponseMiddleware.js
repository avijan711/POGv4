const debug = require('../utils/debug');

function validateInquiryId(req, res, next) {
  const inquiryId = req.params.inquiry_id;
  if (!inquiryId) {
    return res.status(400).json({ error: 'Inquiry ID is required' });
  }
  next();
}

function validateResponseId(req, res, next) {
  const responseId = req.params.response_id;
  if (!responseId) {
    return res.status(400).json({ error: 'Response ID is required' });
  }
  next();
}

function validateChangeId(req, res, next) {
  const changeId = req.params.change_id;
  if (!changeId) {
    return res.status(400).json({ error: 'Change ID is required' });
  }
  next();
}

function validateBulkDelete(req, res, next) {
  const { date, supplier_id } = req.params;
    
  // Validate date and supplier_id presence
  if (!date || !supplier_id) {
    return res.status(400).json({ error: 'Date and supplier ID are required' });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ 
      error: 'Invalid date format',
      message: 'Date must be in YYYY-MM-DD format',
    });
  }

  // Validate supplier_id is a valid number
  const supplierId = parseInt(supplier_id, 10);
  if (isNaN(supplierId) || supplierId <= 0) {
    return res.status(400).json({ 
      error: 'Invalid supplier ID',
      message: 'Supplier ID must be a positive number',
    });
  }

  // Store the validated supplier_id as a number
  req.validatedSupplierId = supplierId;

  debug.log('Bulk delete validation:', {
    date,
    supplier_id,
    validatedSupplierId: supplierId,
  });

  next();
}

function validateUpload(req, res, next) {
  try {
    // Check if file exists and was accepted by multer
    if (!req.file) {
      const error = new Error('No file uploaded or file was rejected');
      error.name = 'ValidationError';
      throw error;
    }

    // Validate column mapping
    if (!req.body.column_mapping) {
      const error = new Error('Column mapping is required');
      error.name = 'ValidationError';
      throw error;
    }

    let columnMapping;
    try {
      columnMapping = JSON.parse(req.body.column_mapping);
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
    const requiredFields = ['item_id', 'price_quoted'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);
    if (missingFields.length > 0) {
      const error = new Error(`Missing required column mappings: ${missingFields.join(', ')}`);
      error.name = 'ValidationError';
      throw error;
    }

    // Check supplier ID
    if (!req.body.supplier_id) {
      const error = new Error('Supplier ID is required');
      error.name = 'ValidationError';
      throw error;
    }

    // Check inquiry ID
    if (!req.body.inquiry_id) {
      const error = new Error('Inquiry ID is required');
      error.name = 'ValidationError';
      throw error;
    }

    // Store the validated mapping back in the request
    req.validatedMapping = Object.assign({}, columnMapping, {
      price: columnMapping.price_quoted, // Ensure price field is mapped for internal use
    });

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
      suggestion: 'Please check your input data',
    });
  }

  if (err.name === 'FileTypeError') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: err.message,
      suggestion: 'Please upload an Excel file (.xlsx or .xls)',
    });
  }

  if (err.name === 'ColumnMappingError') {
    return res.status(400).json({
      error: 'Invalid column mapping',
      message: err.message,
      suggestion: 'Please check your column mapping configuration',
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
  handleErrors,
};
