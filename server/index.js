const express = require('express');
const cors = require('cors');
const debug = require('./utils/debug');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, DatabaseAccessLayer } = require('./config/database');

// Import route creators
const createItemRoutes = require('./routes/items');
const createSupplierRoutes = require('./routes/suppliers');
const createInquiryRoutes = require('./routes/inquiries');
const createSupplierResponseRoutes = require('./routes/supplier-responses');
const createPromotionRoutes = require('./routes/promotions');
const createSettingsRoutes = require('./routes/settings');
const createPriceRoutes = require('./routes/prices');
const createOrderRoutes = require('./routes/orders');

// Import models
const PromotionModel = require('./models/promotion');
const OrderModel = require('./models/order');

async function runMigrations(dal) {
  debug.log('Running migrations...');
  const migrations = [
    'add_price_history_tables.sql',
    'add_item_notes.sql',
    'add_currency_settings.sql',
    'add_supplier_price_indexes.sql',
  ];

  for (const migration of migrations) {
    const migrationPath = path.join(__dirname, 'migrations', migration);
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      try {
        // Split the SQL into individual statements, preserving CREATE TRIGGER statements
        const statements = [];
        let currentStatement = '';
        let inTrigger = false;

        sql.split(';').forEach(statement => {
          statement = statement.trim();
          if (!statement) return;

          if (statement.toUpperCase().includes('CREATE TRIGGER') || inTrigger) {
            inTrigger = true;
            currentStatement += statement + ';';
            if (statement.toUpperCase().includes('END')) {
              statements.push(currentStatement);
              currentStatement = '';
              inTrigger = false;
            }
          } else {
            statements.push(statement + ';');
          }
        });

        // Execute each statement
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await dal.run(statement);
            } catch (err) {
              // Ignore "already exists" errors
              if (!err.message.includes('already exists')) {
                throw err;
              }
            }
          }
        }
        debug.log(`Migration ${migration} completed successfully`);
      } catch (err) {
        debug.error(`Error running migration ${migration}:`, err);
        // Continue with other migrations
      }
    }
  }
}

async function startServer() {
  try {
    const app = express();
    const port = process.env.PORT || 5002;

    // Initialize database connection and get DAL instance
    const dal = await initializeDatabase();
    debug.log('Database initialized successfully');

    // Initialize models with DAL
    const promotionModel = new PromotionModel(dal);
    const orderModel = new OrderModel(dal);

    // Run migrations
    await runMigrations(dal);

    // Middleware
    app.use(cors({
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true,
      optionsSuccessStatus: 200,
      preflightContinue: false,
    }));
    app.use(express.json());

    // Serve static files
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    app.use('/uploads/item-files', express.static(path.join(__dirname, 'uploads', 'item-files')));

    // Ensure upload directories exist
    const uploadsDir = path.join(__dirname, 'uploads');
    const itemFilesDir = path.join(__dirname, 'uploads', 'item-files');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    if (!fs.existsSync(itemFilesDir)) {
      fs.mkdirSync(itemFilesDir);
    }

    // Register routes
    app.use('/api/items', createItemRoutes({ db: dal }));
    app.use('/api/suppliers', createSupplierRoutes({ db: dal }));
    app.use('/api/inquiries', createInquiryRoutes({ db: dal }));
    app.use('/api/supplier-responses', createSupplierResponseRoutes({ db: dal }));
    app.use('/api/promotions', createPromotionRoutes({ db: dal, promotionModel }));
    app.use('/api/settings', createSettingsRoutes({ db: dal }));
    app.use('/api/prices', createPriceRoutes({ db: dal }));
    app.use('/api/orders', createOrderRoutes(orderModel));

    // Error handling
    app.use((err, req, res, next) => {
      debug.error('Global error handler:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        details: err.details || null,
      });
    });

    // Start server
    app.listen(port, () => {
      debug.log(`Server running on port ${port}`);
      debug.log('Server configuration:', {
        port,
        cors: {
          origin: 'http://localhost:3000',
          credentials: true,
        },
      });
    });

    // Schedule promotion cleanup job (runs daily at midnight)
    const CronJob = require('cron').CronJob;
    const PriceHistoryService = require('./services/priceHistoryService');
    const priceHistoryService = new PriceHistoryService(dal);

    new CronJob('0 0 * * *', async () => {
      try {
        debug.log('Running scheduled promotion cleanup');
        await priceHistoryService.cleanupExpiredPromotions();
        debug.log('Promotion cleanup completed');
      } catch (error) {
        debug.error('Error in promotion cleanup job:', error);
      }
    }, null, true);

    // Log successful initialization
    debug.log('Server initialization completed successfully');
    debug.log('Routes initialized:');
    debug.log('- /api/items');
    debug.log('- /api/suppliers');
    debug.log('- /api/inquiries');
    debug.log('- /api/supplier-responses');
    debug.log('- /api/promotions');
    debug.log('- /api/settings');
    debug.log('- /api/prices');
    debug.log('- /api/orders');
    debug.log('Static file serving:');
    debug.log('- /uploads');
    debug.log('- /uploads/item-files');

  } catch (error) {
    debug.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  debug.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  debug.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
