const multer = require('multer');
const path = require('path');
const fs = require('fs');
const debug = require('../utils/debug');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'item-files');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `item-${req.params.id}-${uniqueSuffix}${ext}`;
        
    // Store the filename in the request for later use
    if (!req.uploadedFiles) req.uploadedFiles = [];
    req.uploadedFiles.push({
      originalname: file.originalname,
      filename: filename,
      path: path.join('item-files', filename),
      mimetype: file.mimetype,
    });
        
    cb(null, filename);
  },
});

// Configure multer upload
const uploadConfig = {
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
};

// Error handler middleware
const handleUploadError = (err, req, res, next) => {
  if (err) {
    debug.error('Upload error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 50MB',
        suggestion: 'Please reduce the file size or split into multiple files',
      });
    }
    return res.status(400).json({
      error: 'File upload failed',
      message: err.message,
      suggestion: 'Please try again or contact support',
    });
  }
  next();
};

// Cleanup uploaded files on error
function cleanupFiles(files) {
  if (!files) return;
  files.forEach(file => {
    if (file.path) {
      const filePath = path.join(__dirname, '..', 'uploads', file.path);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          debug.log('Cleaned up file:', filePath);
        } catch (error) {
          debug.error('Error cleaning up file:', error);
        }
      }
    }
  });
}

// Enhanced upload middleware with validation
function validateFiles(req, res, next) {
  try {
    if (!req.files?.length) {
      throw new Error('No files uploaded');
    }

    // Log file details
    debug.log('Files upload details:', req.uploadedFiles);

    // Verify files exist
    req.uploadedFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', 'uploads', file.path);
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found after upload');
      }
    });

    next();
  } catch (error) {
    debug.error('File validation error:', error);
    cleanupFiles(req.uploadedFiles);
    res.status(400).json({
      error: 'File validation failed',
      message: error.message,
      suggestion: 'Please ensure you are uploading valid files',
    });
  }
}

// Create multer instance
const upload = multer(uploadConfig);

// Export middleware functions
module.exports = {
  handleUpload: [
    upload.array('files', 10), // Allow up to 10 files, using 'files' as the field name
    handleUploadError,
    validateFiles,
  ],
  handleUploadError,
  validateFiles,
  cleanupFiles,
};
