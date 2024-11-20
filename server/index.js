const path = require('path');
const { initializeDatabase, insertTestData, getDatabase } = require('./config/database');
const configureServer = require('./config/server');
const ItemModel = require('./models/item');
const InquiryModel = require('./models/inquiry');
const OrderModel = require('./models/order');
const fs = require('fs');

// Retry configuration
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

// Utility function to retry operations
async function retryOperation(operation, attempts = RETRY_ATTEMPTS, delay = RETRY_DELAY) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await operation();
        } catch (error) {
            if (error.code === 'SQLITE_BUSY' && i < attempts - 1) {
                console.log(`Database busy, retrying operation in ${delay}ms... (Attempt ${i + 1}/${attempts})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
}

// Initialize database and start server
async function startServer() {
    let server;

    try {
        // Initialize database with retries
        console.log('Initializing database...');
        await retryOperation(async () => {
            await initializeDatabase();
        });
        console.log('Database initialized successfully');

        // Only insert test data if tables are empty
        const db = getDatabase();
        const hasData = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM Item', [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row.count > 0);
            });
        });

        if (!hasData) {
            console.log('Inserting test data...');
            await retryOperation(async () => {
                await insertTestData(getDatabase());
            });
            console.log('Test data inserted successfully');
        }

        // Configure server
        const { app, port } = configureServer();

        // Initialize models with the database instance
        const itemModel = new ItemModel(db);
        const inquiryModel = new InquiryModel(db);
        const orderModel = new OrderModel(db);

        // Add database reinitialization endpoint with retries
        app.post('/api/reinitialize-db', async (req, res) => {
            try {
                console.log('Reinitializing database...');
                await retryOperation(async () => {
                    const db = getDatabase();
                    
                    // Read and execute schema without dropping tables
                    const schemaPath = path.join(__dirname, 'schema.sql');
                    const schema = fs.readFileSync(schemaPath, 'utf8');
                    
                    await new Promise((resolve, reject) => {
                        db.exec(schema, (err) => {
                            if (err) {
                                console.error('Error executing schema:', err);
                                reject(err);
                            } else {
                                console.log('Schema executed successfully');
                                resolve();
                            }
                        });
                    });
                });
                
                res.json({ 
                    success: true,
                    message: 'Database schema updated successfully' 
                });
            } catch (error) {
                console.error('Error reinitializing database:', error);
                res.status(500).json({ 
                    success: false,
                    error: 'Failed to reinitialize database',
                    details: error.message 
                });
            }
        });

        // Set up routes with retry-enabled database access
        app.use('/api/items', require('./routes/items')(itemModel));
        app.use('/api/inquiries', require('./routes/inquiries')(inquiryModel));
        app.use('/api/suppliers', require('./routes/suppliers')(db));
        app.use('/api/supplier-responses', require('./routes/supplier-responses')(db));
        app.use('/api/settings', require('./routes/settings'));
        app.use('/api/promotions', require('./routes/promotions')(db));
        app.use('/api/orders', require('./routes/orders')(orderModel));

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

        // Enhanced error handler with retry suggestions
        app.use((err, req, res, next) => {
            console.error('Unhandled error:', err);

            if (err.code === 'SQLITE_BUSY') {
                return res.status(503).json({
                    error: 'Database is busy',
                    message: 'The system is experiencing high load. Please try again in a few moments.',
                    suggestion: 'Your request will be automatically retried'
                });
            }

            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).json({
                    error: 'Data constraint violation',
                    message: err.message,
                    suggestion: 'Please check your input data and try again'
                });
            }

            if (err.code === 'SQLITE_LOCKED') {
                return res.status(503).json({
                    error: 'Database table is locked',
                    message: 'Please try again in a moment',
                    suggestion: 'Your request will be automatically retried'
                });
            }

            res.status(500).json({
                error: 'Internal server error',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        });

        // Start server with enhanced error handling
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

        // Enhanced cleanup function
        const cleanup = async () => {
            console.log('\nShutting down gracefully...');
            
            if (server) {
                await new Promise(resolve => server.close(resolve));
                console.log('Server closed');
            }

            const db = getDatabase();
            if (db) {
                await new Promise(resolve => {
                    db.run('PRAGMA optimize', () => {
                        db.close(() => {
                            console.log('Database connection closed');
                            resolve();
                        });
                    });
                });
            }

            process.exit(0);
        };

        // Enhanced error handling
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
        const db = getDatabase();
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
