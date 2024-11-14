const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('Saving file to:', uploadsDir);
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename with timestamp and original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = uniqueSuffix + ext;
        console.log('Generated filename:', filename);
        cb(null, filename);
    }
});

// Create multer upload instance with error handling
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log('Received file:', file.originalname);
        console.log('File mimetype:', file.mimetype);
        console.log('Request body:', req.body);
        
        // Check file type
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream'
        ];
        const allowedExtensions = /\.(xlsx|xls)$/i;
        
        if (!allowedTypes.includes(file.mimetype) && 
            !allowedExtensions.test(file.originalname)) {
            return cb(new Error('Only Excel files (.xlsx or .xls) are allowed'));
        }

        cb(null, true);
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
}).single('file');

// Middleware to handle file upload
const handleUpload = (req, res, next) => {
    console.log('Handling upload request');
    console.log('Request headers:', req.headers);
    
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'File too large',
                    details: 'Maximum file size is 50MB',
                    suggestion: 'Please reduce the file size or split into multiple files'
                });
            }
            return res.status(400).json({
                error: 'File upload error',
                details: err.message,
                suggestion: 'Please try again with a smaller file or contact support if the issue persists'
            });
        } else if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({
                error: 'File upload failed',
                details: err.message,
                suggestion: 'Please ensure you are uploading a valid Excel file'
            });
        }

        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({
                error: 'No file uploaded',
                details: 'Please select a file to upload',
                suggestion: 'Click the browse button to select a file'
            });
        }

        // Check if inquiry number is provided
        if (!req.body.inquiryNumber) {
            cleanupFile(req.file.path);
            return res.status(400).json({
                error: 'Missing inquiry number',
                details: 'An inquiry number is required',
                suggestion: 'Please enter an inquiry number'
            });
        }

        // Check if column mapping is provided
        if (!req.body.columnMapping) {
            cleanupFile(req.file.path);
            return res.status(400).json({
                error: 'Missing column mapping',
                details: 'Column mapping is required',
                suggestion: 'Please ensure column mapping is provided'
            });
        }

        // Try to parse column mapping
        try {
            JSON.parse(req.body.columnMapping);
        } catch (err) {
            cleanupFile(req.file.path);
            return res.status(400).json({
                error: 'Invalid column mapping',
                details: 'The column mapping format is invalid',
                suggestion: 'Please ensure the column mapping is properly formatted'
            });
        }

        console.log('Upload successful:', {
            file: req.file,
            inquiryNumber: req.body.inquiryNumber,
            columnMapping: req.body.columnMapping
        });

        next();
    });
};

// Middleware to validate Excel files
const validateExcelFile = (req, res, next) => {
    console.log('Validating Excel file...');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    if (!req.file) {
        return res.status(400).json({ 
            error: 'No file uploaded',
            details: 'Please select a file to upload',
            suggestion: 'Click the browse button to select a file'
        });
    }

    const allowedExtensions = /\.(xlsx|xls)$/i;
    if (!allowedExtensions.test(req.file.originalname)) {
        console.log('Invalid file type:', req.file.originalname);
        cleanupFile(req.file.path);
        return res.status(400).json({ 
            error: 'Invalid file type',
            details: 'Please upload an Excel file (.xlsx or .xls)',
            suggestion: 'Download the sample file for reference'
        });
    }

    // Ensure the file exists on disk
    if (!fs.existsSync(req.file.path)) {
        return res.status(400).json({ 
            error: 'File not found',
            details: 'The uploaded file could not be processed',
            suggestion: 'Please try uploading the file again'
        });
    }

    // Validate file size
    const stats = fs.statSync(req.file.path);
    if (stats.size === 0) {
        cleanupFile(req.file.path);
        return res.status(400).json({ 
            error: 'Empty file',
            details: 'The uploaded file is empty',
            suggestion: 'Please ensure the file contains data'
        });
    }

    console.log('File validation successful');
    next();
};

// Function to clean up uploaded files
const cleanupFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log('Cleaned up file:', filePath);
        } catch (err) {
            console.error('Error cleaning up file:', err);
        }
    }
};

module.exports = {
    handleUpload,
    validateExcelFile,
    cleanupFile
};
