const path = require('path');
const { initializeDatabase } = require('./config/database');
const configureServer = require('./config/server');
const ItemModel = require('./models/item');
const InquiryModel = require('./models/inquiry');
const OrderModel = require('./models/order');

// Initialize database and start server
async function startServer() {
    let db;
    let server;

    try {
        // Initialize database
        db = await initializeDatabase();
        console.log('Database initialized successfully');

        // Configure server
        const { app, port } = configureServer();

        // Initialize models
        const itemModel = new ItemModel(db);
        const inquiryModel = new InquiryModel(db);
        const orderModel = new OrderModel(db);

        // Set up routes
        app.use('/api/items', require('./routes/items')(itemModel));
        app.use('/api/inquiries', require('./routes/inquiries')(inquiryModel));
        app.use('/api/suppliers', require('./routes/suppliers')(db));
        app.use('/api/supplier-responses', require('./routes/supplier-responses')(db));
        app.use('/api/settings', require('./routes/settings'));
        app.use('/api/promotions', require('./routes/promotions')(db));
        app.use('/api/orders', require('./routes/orders')(orderModel)); // Changed to use orderModel

        // Add sample file route
        app.get('/sample.xlsx', (req, res) => {
            const filePath = path.join(__dirname, 'sample_inventory.xlsx');
            res.download(filePath, 'sample_inventory.xlsx', (err) => {
                if (err) {
                    console.error('Error downloading sample file:', err);
                    res.status(500).json({ 
                        error: 'Error downloading file',
                        details: err.message,
                        suggestion: 'Please try again or contact support if the issue persists'
                    });
                }
            });
        });

        // Global error handler
        app.use((err, req, res, next) => {
            console.error('Unhandled error:', err);

            // Handle specific error types
            if (err.code === 'SQLITE_BUSY') {
                return res.status(503).json({
                    error: 'Database is busy',
                    message: 'Please try again in a moment'
                });
            }

            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).json({
                    error: 'Data constraint violation',
                    message: err.message
                });
            }

            // Default error response
            res.status(500).json({
                error: 'Internal server error',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        });

        // Start listening with error handling
        server = app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log(`Upload endpoint: http://localhost:${port}/api/inquiries/upload`);
            console.log(`Sample file endpoint: http://localhost:${port}/sample.xlsx`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use. Please:
                1. Stop any other server instances
                2. Wait a few seconds
                3. Try again
                Or use a different port by setting the PORT environment variable`);
                process.exit(1);
            } else {
                console.error('Server error:', err);
                process.exit(1);
            }
        });

        // Handle process termination
        const cleanup = async () => {
            console.log('\nShutting down gracefully...');
            
            // Close server first to stop accepting new connections
            if (server) {
                await new Promise(resolve => server.close(resolve));
                console.log('Server closed');
            }

            // Close database connections
            if (db) {
                await new Promise(resolve => db.close(() => {
                    console.log('Database connection closed');
                    resolve();
                }));
            }

            // Clean up any temporary files
            const uploadDir = path.join(__dirname, 'uploads');
            if (fs.existsSync(uploadDir)) {
                fs.readdirSync(uploadDir).forEach(file => {
                    const filePath = path.join(uploadDir, file);
                    if (file.startsWith('promotion-')) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`Cleaned up temporary file: ${file}`);
                        } catch (err) {
                            console.error(`Error cleaning up file ${file}:`, err);
                        }
                    }
                });
            }

            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('uncaughtException', (err) => {
            console.error('Uncaught exception:', err);
            cleanup();
        });
        process.on('unhandledRejection', (err) => {
            console.error('Unhandled rejection:', err);
            cleanup();
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        if (db) {
            await new Promise(resolve => db.close(resolve));
        }
        process.exit(1);
    }
}

// Start the server
startServer().catch(error => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
});
