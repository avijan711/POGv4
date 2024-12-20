const multer = require('multer');
const path = require('path');
const fs = require('fs');
const debug = require('../utils/debug');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage for images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        debug.log('Saving image to:', uploadsDir);
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const filename = Date.now() + '-' + file.originalname;
        debug.log('Generated image filename:', filename);
        cb(null, filename);
    }
});

// Create multer upload instance with error handling
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        debug.log('Processing upload:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype
        });

        // Log form data
        debug.log('Form data:', {
            body: req.body,
            file: file
        });
        
        // Check if it's an image
        if (file.fieldname === 'image' && !file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Define the fields configuration
const uploadFields = [
    { name: 'image', maxCount: 1 },
    { name: 'item_id', maxCount: 1 },
    { name: 'hebrew_description', maxCount: 1 },
    { name: 'english_description', maxCount: 1 },
    { name: 'import_markup', maxCount: 1 },
    { name: 'hs_code', maxCount: 1 },
    { name: 'qty_in_stock', maxCount: 1 },
    { name: 'sold_this_year', maxCount: 1 },
    { name: 'sold_last_year', maxCount: 1 },
    { name: 'retail_price', maxCount: 1 },
    { name: 'reference_id', maxCount: 1 },
    { name: 'notes', maxCount: 1 }
];

// Add middleware to parse form data
const handleUpload = (req, res, next) => {
    debug.log('Starting file upload processing');
    
    const uploadHandler = upload.fields(uploadFields);
    uploadHandler(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            debug.error('Multer error:', err);
            return res.status(400).json({
                error: 'File upload error',
                details: err.message,
                suggestion: 'Please check file size and type'
            });
        } else if (err) {
            debug.error('Unknown upload error:', err);
            return res.status(500).json({
                error: 'Upload failed',
                details: err.message,
                suggestion: 'Please try again or contact support'
            });
        }

        // Log the processed request
        debug.log('Upload processed successfully:', {
            body: req.body,
            files: req.files
        });

        next();
    });
};

// Export the multer instance and middleware functions
module.exports = {
    handleUpload,
    single: upload.single.bind(upload),
    array: upload.array.bind(upload),
    fields: upload.fields.bind(upload),
    none: upload.none.bind(upload)
};
