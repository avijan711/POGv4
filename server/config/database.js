const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const debug = require('../utils/debug');
const MigrationManager = require('./migrationManager');

// Create verbose sqlite3 database instance
const verbose = sqlite3.verbose();

// Database connection pool
let db = null;

// Custom error types for better error handling
class DatabaseError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
  }
}

class TransactionError extends DatabaseError {
  constructor(message, details = null) {
    super(message, 'TRANSACTION_ERROR', details);
    this.name = 'TransactionError';
  }
}

// Database Access Layer class
class DatabaseAccessLayer {
  constructor(db) {
    if (!db) {
      throw new DatabaseError('Database instance is required', 'INITIALIZATION_ERROR');
    }
    this.db = db;
    this.inTransaction = false;
  }

  // Core database operations
  async query(sql, params = []) {
    try {
      const queryId = Math.random().toString(36).substring(7);
      debug.time(`Query ${queryId}`);
      debug.log(`SQL Query ${queryId}:`, { sql, params });

      const rows = await this.db.allAsync(sql, params);
      debug.timeEnd(`Query ${queryId}`);
      debug.log(`Query ${queryId} returned ${rows?.length || 0} rows`);
      return rows || [];
    } catch (err) {
      debug.error('Query execution failed:', err);
      throw new DatabaseError('Query execution failed', 'QUERY_ERROR', { sql, params, originalError: err });
    }
  }

  async querySingle(sql, params = []) {
    try {
      const queryId = Math.random().toString(36).substring(7);
      debug.time(`Single Query ${queryId}`);
      debug.log(`SQL Single Query ${queryId}:`, { sql, params });

      const row = await this.db.getAsync(sql, params);
      debug.timeEnd(`Query ${queryId}`);
      debug.log(`Query ${queryId} returned row:`, row);
      return row;
    } catch (err) {
      debug.error('Single query execution failed:', err);
      throw new DatabaseError('Single query execution failed', 'QUERY_ERROR', { sql, params, originalError: err });
    }
  }

  async run(sql, params = []) {
    try {
      const queryId = Math.random().toString(36).substring(7);
      debug.time(`Run ${queryId}`);
      debug.log(`SQL Run ${queryId}:`, { sql, params });

      const result = await this.db.runAsync(sql, params);
      debug.timeEnd(`Run ${queryId}`);
      debug.log(`Run ${queryId} affected ${result?.changes || 0} rows`);
      return result;
    } catch (err) {
      debug.error('Run operation failed:', err);
      throw new DatabaseError('Run operation failed', 'RUN_ERROR', { sql, params, originalError: err });
    }
  }

  // Transaction management
  async executeTransaction(callback) {
    const transactionId = Math.random().toString(36).substring(7);
    debug.time(`Transaction ${transactionId}`);
    debug.log(`Starting transaction ${transactionId}`);

    if (this.inTransaction) {
      debug.error(`Transaction ${transactionId} error: Already in transaction`);
      throw new TransactionError('Cannot start a transaction within a transaction');
    }

    try {
      this.inTransaction = true;
      await this.run('BEGIN IMMEDIATE TRANSACTION');
      debug.log(`Transaction ${transactionId} begun`);

      const result = await callback();
            
      await this.run('COMMIT');
      debug.log(`Transaction ${transactionId} committed successfully`);
      debug.timeEnd(`Transaction ${transactionId}`);
      return result;
    } catch (error) {
      debug.error(`Transaction ${transactionId} error:`, error);
      try {
        await this.run('ROLLBACK');
        debug.log(`Transaction ${transactionId} rolled back successfully`);
      } catch (rollbackError) {
        debug.error(`Failed to rollback transaction ${transactionId}:`, rollbackError);
        throw new TransactionError('Transaction and rollback failed', {
          transactionId,
          originalError: error,
          rollbackError,
        });
      }
      throw new TransactionError('Transaction failed', {
        transactionId,
        originalError: error,
      });
    } finally {
      this.inTransaction = false;
    }
  }
}

// Helper function to promisify database methods
function promisifyDb(db) {
  db.allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  db.getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  db.execAsync = (sql) => new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
    
  db.runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
    
  db.serializeAsync = () => new Promise((resolve) => {
    db.serialize(() => resolve());
  });

  return db;
}

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '..', 'inventory.db');
    const schemaPath = path.join(__dirname, '..', 'schema.sql');

    const Database = verbose.Database;
    db = new Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
      if (err) {
        debug.error('Error connecting to database:', err);
        reject(err);
        return;
      }

      db = promisifyDb(db);
      debug.log('Connected to SQLite database');
            
      try {
        // Configure SQLite pragmas
        await db.getAsync('PRAGMA query_only = 0;');
        await db.runAsync('PRAGMA journal_mode = WAL;');
        await db.runAsync('PRAGMA synchronous = NORMAL;');
        await db.runAsync('PRAGMA busy_timeout = 30000;');
        await db.runAsync('PRAGMA foreign_keys = ON;');
        await db.runAsync('PRAGMA cache_size = -4000;');
        await db.runAsync('PRAGMA temp_store = MEMORY;');
        await db.runAsync('PRAGMA locking_mode = NORMAL;');
        await db.runAsync('PRAGMA mmap_size = 268435456;');

        // Check JSON1 extension
        try {
          await db.getAsync('SELECT json_group_array(1) as test');
        } catch (e) {
          if (e.message.includes('no such function')) {
            debug.error('JSON1 extension not available. Some features may not work.');
          }
          debug.error('Error checking JSON1 extension:', e);
        }

        // Create DAL instance
        const dal = new DatabaseAccessLayer(db);

        // Initialize migration manager
        const migrationManager = new MigrationManager(dal);
                
        try {
          // Initialize migrations table
          await migrationManager.initialize();

          // Check if this is a new database
          const row = await db.getAsync('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="item"');
          const needsInit = !row || row.count === 0;

          if (needsInit) {
            debug.log('New database detected, applying base schema...');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            const cleanSchema = schema
              .split('\n')
              .filter(line => !line.trim().toLowerCase().startsWith('drop'))
              .join('\n');
                        
            await db.execAsync(cleanSchema);
            debug.log('Base schema applied successfully');
          }

          // Apply any pending migrations
          debug.log('Checking for pending migrations...');
          const results = await migrationManager.applyPendingMigrations();
                    
          if (results.length > 0) {
            debug.log('Applied migrations:', results);
          }

          // Verify schema integrity
          await migrationManager.verifySchema();
                    
          debug.log('Database initialization and migrations completed successfully');
          resolve(dal);
        } catch (error) {
          debug.error('Error during database initialization or migration:', error);
          reject(error);
          return;
        }
      } catch (error) {
        debug.error('Error initializing database:', error);
        reject(error);
      }
    });

    db.on('error', (err) => {
      debug.error('Database error:', err);
    });

    process.on('SIGINT', () => {
      if (db) {
        db.close((err) => {
          if (err) {
            debug.error('Error closing database:', err);
          } else {
            debug.log('Database connection closed');
          }
          process.exit(0);
        });
      }
    });
  });
}

// Export a function to get the database instance
function getDatabase() {
  if (!db) {
    throw new DatabaseError('Database not initialized', 'INITIALIZATION_ERROR');
  }
  return new DatabaseAccessLayer(db);
}

module.exports = {
  initializeDatabase,
  getDatabase,
  DatabaseAccessLayer,
  DatabaseError,
  TransactionError,
};
