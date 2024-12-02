const express = require('express');
const cors = require('cors');
const path = require('path');
const debug = require('./utils/debug');
const { initializeDatabase, getDatabase } = require('./config/database');
const ItemModel = require('./models/item');
const InquiryModel = require('./models/inquiry');
const InquiryItemModel = require('./models/inquiry/item');
const PromotionModel = require('./models/promotion');
const createItemsRouter = require('./routes/items');
const createInquiriesRouter = require('./routes/inquiries');
const createPromotionsRouter = require('./routes/promotions');

const app = express();
const port = process.env.PORT || 5002;

// Configure CORS with credentials
app.use(cors({
  origin: 'http://localhost:3000', // React app's origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition'],
  exposedHeaders: ['Content-Disposition']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files with proper MIME types
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set appropriate content type for images
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    }
    // Add cache control headers
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
  }
}));

async function startServer() {
    try {
        // Initialize database
        console.log('Initializing database...');
        await initializeDatabase();
        const db = getDatabase();
        console.log('Database initialized successfully');

        // Create model instances with database connection
        const itemModel = new ItemModel(db);
        const inquiryModel = new InquiryModel(db);
        const inquiryItemModel = new InquiryItemModel(db);
        const promotionModel = new PromotionModel(db);

        // Create and mount routes
        app.use('/api/items', createItemsRouter(itemModel));
        app.use('/api/inquiries', createInquiriesRouter({ 
            db,
            inquiryModel,
            inquiryItemModel,
            promotionModel
        }));
        app.use('/api/promotions', createPromotionsRouter(promotionModel));

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        });

        // Start server
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
            console.log(`API endpoint: http://localhost:${port}/api`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    const db = getDatabase();
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
                process.exit(1);
            }
            console.log('Database connection closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

startServer();
