const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage for images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('Saving image to:', uploadsDir);
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const filename = Date.now() + '-' + file.originalname;
        console.log('Generated image filename:', filename);
        cb(null, filename);
    }
});

// Create multer upload instance with error handling
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log('Received image:', file.originalname);
        console.log('Image mimetype:', file.mimetype);
        
        // Check if it's an image
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

module.exports = upload;
