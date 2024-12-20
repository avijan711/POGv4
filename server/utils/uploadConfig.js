const path = require('path');
const fs = require('fs');
const debug = require('./debug');

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

// Configure multer storage options
const uploadConfig = {
    storage: {
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
            cb(null, file.fieldname + '-' + uniqueSuffix + ext);
        }
    },
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
        return cb(null, false);
    },
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1 // Only allow 1 file per request
    }
};

module.exports = {
    uploadConfig,
    VALID_EXCEL_MIMETYPES
};
