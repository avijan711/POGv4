const multer = require('multer');
const path = require('path');
const fs = require('fs');
const debug = require('../utils/debug');

// List of valid Excel MIME types
const VALID_EXCEL_MIMETYPES = [
    'application/vnd.ms-excel',                                           // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel.sheet.macroEnabled.12',                    // .xlsm
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',             // .xlsb
    'application/vnd.ms-excel.template.macroEnabled.12',                 // .xltm
    'application/vnd.ms-excel.template',                                 // .xlt
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template' // .xltx
];

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp and original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = 'file-' + uniqueSuffix + ext;
        
        // Store the filename in the request for later use
        req.uploadedFile = {
            filename,
            path: path.join(__dirname, '..', 'uploads', filename)
        };
        
        cb(null, filename);
    }
});

// Configure multer upload
const uploadConfig = {
    storage: storage,
    fileFilter: function (req, file, cb) {
        debug.log('File upload request:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            fieldname: file.fieldname
        });

        // Check file extension
        const ext = path.extname(file.originalname).toLowerCase();
        const isValidExt = ['.xlsx', '.xls'].includes(ext);

        // Check MIME type
        const isValidMime = VALID_EXCEL_MIMETYPES.includes(file.mimetype);

        // Log validation details
        debug.log('File validation:', {
            extension: ext,
            isValidExt,
            mimetype: file.mimetype,
            isValidMime
        });

        if (isValidExt || isValidMime) {
            debug.log('File accepted:', file.originalname);
            return cb(null, true);
        }

        debug.error('File rejected:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            extension: ext
        });

        // Return error through callback
        return cb({
            message: 'Only Excel files (.xlsx, .xls) are allowed',
            code: 'INVALID_FILE_TYPE'
        });
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
};

// Error handler middleware
const handleUploadError = (err, req, res, next) => {
    if (err) {
        debug.error('Upload error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'Maximum file size is 50MB',
                suggestion: 'Please reduce the file size or split into multiple files'
            });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
            return res.status(400).json({
                error: 'Invalid file type',
                message: err.message,
                suggestion: 'Please upload a valid Excel file (.xlsx or .xls)'
            });
        }
        return res.status(400).json({
            error: 'File upload failed',
            message: err.message,
            suggestion: 'Please try again or contact support'
        });
    }
    next();
};

// Cleanup uploaded file
function cleanupFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            debug.log('Cleaned up file:', filePath);
        } catch (error) {
            debug.error('Error cleaning up file:', error);
        }
    }
}

// Enhanced upload middleware with validation
function validateExcelFile(req, res, next) {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        // Set the full file path in req.file
        req.file.fullPath = path.join(__dirname, '..', 'uploads', req.file.filename);

        // Log file details
        debug.log('File upload details:', {
            originalname: req.file.originalname,
            filename: req.file.filename,
            fullPath: req.file.fullPath,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Verify file exists
        if (!fs.existsSync(req.file.fullPath)) {
            throw new Error('File not found after upload');
        }

        next();
    } catch (error) {
        debug.error('File validation error:', error);
        cleanupFile(req.file?.fullPath);
        res.status(400).json({
            error: 'File validation failed',
            message: error.message,
            suggestion: 'Please ensure you are uploading a valid Excel file'
        });
    }
}

// Create multer instance
const upload = multer(uploadConfig);

// Export middleware functions
module.exports = {
    handleUpload: [
        upload.single('file'),
        handleUploadError,
        validateExcelFile
    ],
    handleUploadError,
    validateExcelFile,
    cleanupFile,
    uploadConfig,
    VALID_EXCEL_MIMETYPES
};
