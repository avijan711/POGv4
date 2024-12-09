const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const debug = require('../utils/debug');

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
    }

    // Core database operations
    async query(sql, params = []) {
        try {
            const queryId = Math.random().toString(36).substring(7);
            debug.time(`Query ${queryId}`);
            debug.logQuery(`Query ${queryId}`, sql, params);

            const rows = await this.db.allAsync(sql, params);
            debug.timeEnd(`Query ${queryId}`);
            return rows || [];
        } catch (err) {
            throw new DatabaseError('Query execution failed', 'QUERY_ERROR', { sql, params, originalError: err });
        }
    }

    async querySingle(sql, params = []) {
        try {
            const queryId = Math.random().toString(36).substring(7);
            debug.time(`Single Query ${queryId}`);
            debug.logQuery(`Single Query ${queryId}`, sql, params);

            const row = await this.db.getAsync(sql, params);
            debug.timeEnd(`Query ${queryId}`);
            return row;
        } catch (err) {
            throw new DatabaseError('Single query execution failed', 'QUERY_ERROR', { sql, params, originalError: err });
        }
    }

    async run(sql, params = []) {
        try {
            const queryId = Math.random().toString(36).substring(7);
            debug.time(`Run ${queryId}`);
            debug.logQuery(`Run ${queryId}`, sql, params);

            const result = await this.db.runAsync(sql, params);
            debug.timeEnd(`Run ${queryId}`);
            return result;
        } catch (err) {
            throw new DatabaseError('Run operation failed', 'RUN_ERROR', { sql, params, originalError: err });
        }
    }

    // Transaction management
    async executeTransaction(callback) {
        const transactionId = Math.random().toString(36).substring(7);
        debug.time(`Transaction ${transactionId}`);
        debug.log(`Starting transaction ${transactionId}`);

        try {
            await this.run('BEGIN IMMEDIATE TRANSACTION');
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
                    rollbackError
                });
            }
            throw new TransactionError('Transaction failed', {
                transactionId,
                originalError: error
            });
        }
    }
}

// Helper function to run PRAGMA settings
const setPragma = (db, pragma, value) => {
    return new Promise((resolve, reject) => {
        const pragmaStatement = `PRAGMA ${pragma} = ${value};`;
        db.run(pragmaStatement, (err) => {
            if (err) {
                console.error(`Error setting ${pragma}:`, err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

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
                console.error('Error connecting to database:', err);
                reject(err);
                return;
            }

            db = promisifyDb(db);
            console.log('Connected to SQLite database');
            
            try {
                await db.getAsync("PRAGMA query_only = 0;");
                await setPragma(db, 'journal_mode', 'WAL');
                await setPragma(db, 'synchronous', 'NORMAL');
                await setPragma(db, 'busy_timeout', '30000');
                await setPragma(db, 'foreign_keys', 'ON');
                await setPragma(db, 'cache_size', '-4000');
                await setPragma(db, 'temp_store', 'MEMORY');
                await setPragma(db, 'locking_mode', 'NORMAL');
                await setPragma(db, 'mmap_size', '268435456');

                try {
                    await db.getAsync("SELECT json_group_array(1) as test");
                } catch (e) {
                    if (e.message.includes('no such function')) {
                        console.error('JSON1 extension not available. Some features may not work.');
                    }
                    console.error('Error checking JSON1 extension:', e);
                }

                const row = await db.getAsync('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="item"');
                const needsInit = !row || row.count === 0;

                if (needsInit) {
                    console.log('Database needs initialization, creating tables...');
                    const schema = fs.readFileSync(schemaPath, 'utf8');
                    const cleanSchema = schema
                        .split('\n')
                        .filter(line => !line.trim().toLowerCase().startsWith('drop'))
                        .join('\n');
                    
                    const statements = [];
                    let currentStatement = '';
                    let inTrigger = false;

                    cleanSchema.split(';').forEach(statement => {
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

                    await db.runAsync('BEGIN IMMEDIATE TRANSACTION;');

                    try {
                        console.log('Executing schema statements...');
                        for (let i = 0; i < statements.length; i++) {
                            const statement = statements[i].trim();
                            if (!statement) continue;
                            
                            try {
                                await db.runAsync(statement);
                            } catch (err) {
                                if (err.code !== 'SQLITE_ERROR' || !err.message.includes('already exists')) {
                                    console.error(`Error executing statement ${i + 1}:`, err);
                                    console.error('Statement:', statement);
                                    await db.runAsync('ROLLBACK;');
                                    reject(err);
                                    return;
                                }
                            }
                        }

                        await db.runAsync('COMMIT;');
                        console.log('Database schema initialized successfully');
                    } catch (error) {
                        console.error('Error during database initialization:', error);
                        await db.runAsync('ROLLBACK;');
                        reject(error);
                    }
                } else {
                    console.log('Database already initialized, skipping schema creation');
                }

                // Create DAL instance
                const dal = new DatabaseAccessLayer(db);
                resolve(dal);
            } catch (error) {
                console.error('Error initializing database:', error);
                reject(error);
            }
        });

        db.on('error', (err) => {
            console.error('Database error:', err);
        });

        process.on('SIGINT', () => {
            if (db) {
                db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('Database connection closed');
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
    TransactionError
};
