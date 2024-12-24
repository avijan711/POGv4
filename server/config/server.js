const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

function configureServer() {
  const app = express();
  const port = process.env.PORT || 5002;

  // CORS configuration
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.0.30:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Content-Disposition',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Type', 'Content-Disposition'],
    credentials: true,
  }));
    
  // Handle preflight requests
  app.options('*', cors());

  // Parse URL-encoded bodies (as sent by HTML forms)
  app.use(express.urlencoded({ 
    extended: true,
    limit: '50mb',
  }));

  // Parse JSON bodies (as sent by API clients)
  app.use(express.json({ 
    limit: '50mb',
  }));

  // Log all requests
  app.use((req, res, next) => {
    console.log(`\n=== ${new Date().toISOString()} ===`);
    console.log(`${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.columnMapping) {
        try {
          sanitizedBody.columnMapping = JSON.parse(sanitizedBody.columnMapping);
        } catch (e) {
          console.warn('Could not parse column mapping');
        }
      }
      console.log('Body:', JSON.stringify(sanitizedBody, null, 2));
    }
    if (req.file) {
      console.log('File:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      });
    }
    next();
  });

  // Create uploads directory if it doesn't exist
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!require('fs').existsSync(uploadDir)) {
    require('fs').mkdirSync(uploadDir, { recursive: true });
  }

  // API route prefix to avoid conflicts with static files
  app.use('/api', (req, res, next) => {
    // Ensure API routes return JSON
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // Serve static files AFTER API routes
  app.use('/uploads', express.static(uploadDir));
  app.use(express.static(path.join(__dirname, '..'))); // Serve files from server directory

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('\n=== Error Handler ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
        
    // Clean up any uploaded files if there's an error
    if (req.file) {
      const fs = require('fs');
      console.log('Cleaning up file:', req.file.path);
      fs.unlink(req.file.path, (unlinkError) => {
        if (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        } else {
          console.log('File cleaned up successfully');
        }
      });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        details: 'The uploaded file exceeds the size limit',
        suggestion: 'Please upload a smaller file (max 50MB)',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file',
        details: 'Too many files or wrong field name',
        suggestion: 'Please upload only one file using the correct field name',
      });
    }

    // Handle multer errors
    if (err.name === 'MulterError') {
      return res.status(400).json({
        error: 'File upload error',
        details: err.message,
        suggestion: 'Please ensure you are uploading a valid file',
      });
    }

    // Handle SQLite errors
    if (err.code && err.code.startsWith('SQLITE_')) {
      console.error('SQLite error:', err);
      return res.status(500).json({
        error: 'Database error',
        details: 'An error occurred while processing your request',
        suggestion: 'Please try again or contact support if the issue persists',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      details: err.message,
      suggestion: 'Please try again or contact support if the issue persists',
    });
  });

  return { app, port };
}

module.exports = configureServer;
