const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, getDatabase } = require('./config/database');

// Import models
const PromotionModel = require('./models/promotion');
const InquiryModel = require('./models/inquiry');
const InquiryItemModel = require('./models/inquiry/item');
const OrderModel = require('./models/order');

// Import route creators
const createItemsRouter = require('./routes/items');
const createOrdersRouter = require('./routes/orders');
const createPromotionsRouter = require('./routes/promotions');
const createSettingsRouter = require('./routes/settings');
const createSuppliersRouter = require('./routes/suppliers');
const createInquiriesRouter = require('./routes/inquiries');
const createSupplierResponsesRouter = require('./routes/supplier-responses');

// Create Express app
const app = express();

// CORS configuration
const corsOptions = {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();
        const db = getDatabase();

        // Initialize models
        const inquiryModel = new InquiryModel(db);
        const inquiryItemModel = new InquiryItemModel(db);
        const promotionModel = new PromotionModel(db);
        const orderModel = new OrderModel(db);
        await promotionModel.initialize();

        // Mount routes with proper error handling
        function mountRoute(path, createRouter, options = {}) {
            try {
                // Create router with appropriate dependencies
                const router = options.deps ? 
                    createRouter(options.deps) : 
                    createRouter({ db });

                // Validate router
                if (!router || typeof router.use !== 'function') {
                    throw new Error(`Invalid router returned for ${path}`);
                }

                // Apply CORS to each route
                router.use(cors(corsOptions));

                // Mount router
                app.use(path, router);
                console.log(`Mounted route: ${path}`);
            } catch (err) {
                console.error(`Failed to mount route ${path}:`, err);
                throw err;
            }
        }

        // Mount each route
        const routes = [
            { path: '/api/items', creator: createItemsRouter },
            { 
                path: '/api/orders', 
                creator: createOrdersRouter, 
                deps: orderModel 
            },
            { 
                path: '/api/promotions', 
                creator: createPromotionsRouter, 
                deps: { db, promotionModel }
            },
            { 
                path: '/api/settings', 
                creator: createSettingsRouter,
                deps: { db }  // Added db dependency for settings route
            },
            { path: '/api/suppliers', creator: createSuppliersRouter },
            { 
                path: '/api/inquiries', 
                creator: createInquiriesRouter,
                deps: { db, inquiryModel, inquiryItemModel }
            },
            { 
                path: '/api/supplier-responses', 
                creator: createSupplierResponsesRouter,
                deps: { db }
            }
        ];

        // Mount routes in sequence
        for (const route of routes) {
            mountRoute(route.path, route.creator, route.deps ? { deps: route.deps } : undefined);
        }

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error('Global error handler:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message
            });
        });

        // Start server
        const port = process.env.PORT || 5002;
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    const db = getDatabase();
    if (db) {
        db.close(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

startServer();
