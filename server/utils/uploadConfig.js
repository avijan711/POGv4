const multer = require('multer');
const path = require('path');
const fs = require('fs');

function getUploadConfig() {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadsDir = path.join(__dirname, '..', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            cb(null, uploadsDir);
        },
        filename: function (req, file, cb) {
            const timestamp = Date.now();
            const ext = path.extname(file.originalname);
            cb(null, `supplier-response-${timestamp}${ext}`);
        }
    });

    const fileFilter = (req, file, cb) => {
        // Check file extension
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            return cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }

        // Check mimetype
        const allowedMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('Only Excel files are allowed'));
        }

        cb(null, true);
    };

    return { storage, fileFilter };
}

module.exports = { getUploadConfig };
