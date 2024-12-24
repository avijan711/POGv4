const debug = require('../utils/debug');
const { DateValidationError } = require('../utils/dateUtils');

function handleErrors(err, req, res, next) {
  debug.error('Error in middleware:', err);
    
  if (res.headersSent) {
    return next(err);
  }
    
  if (err instanceof DateValidationError) {
    return res.status(400).json({
      error: 'Date Validation Error',
      message: err.message,
      suggestion: 'Please use format YYYY-MM-DD',
    });
  }
    
  // Handle validation errors
  if (err.name === 'ValidationError' || err.message.includes('Missing required') || err.message.includes('Cannot insert')) {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      suggestion: 'Please ensure all required fields are provided and valid',
    });
  }

  // Handle database constraint errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({
      error: 'Database Constraint Error',
      message: 'A required field is missing or invalid',
      suggestion: 'Please check that all required fields are provided correctly',
    });
  }
    
  // Handle transaction errors
  if (err.code === 'TRANSACTION_ERROR') {
    return res.status(400).json({
      error: 'Transaction Error',
      message: err.message,
      suggestion: 'Please try again or contact support if the issue persists',
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    suggestion: 'Please try again or contact support if the issue persists',
  });
}

module.exports = handleErrors;
