const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const debug = require('../utils/debug');

// Create verbose sqlite3 database instance
const verbose = sqlite3.verbose();

// Database connection pool
let db = null;

// Helper function to run PRAGMA settings
const setPragma = (pragma, value) => {
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
    // Promisify get and all methods using arrow functions to preserve context
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
    
    // Custom promisification for run to preserve this context
    db.runAsync = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
    
    // Add serialize method that returns a Promise
    db.serializeAsync = () => new Promise((resolve) => {
        db.serialize(() => resolve());
    });

    return db;
}

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, '..', 'inventory.db');
        const schemaPath = path.join(__dirname, '..', 'schema.sql');

        // Create database connection with verbose mode
        const Database = verbose.Database;
        db = new Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                reject(err);
                return;
            }

            // Promisify database methods
            db = promisifyDb(db);

            console.log('Connected to SQLite database');
            
            try {
                // First, ensure we're not in a transaction
                await db.getAsync("PRAGMA query_only = 0;");

                // Set critical PRAGMA settings first
                await setPragma('journal_mode', 'WAL');
                await setPragma('synchronous', 'NORMAL');
                
                // Set remaining PRAGMA settings
                await setPragma('busy_timeout', '30000');
                await setPragma('foreign_keys', 'ON');
                await setPragma('cache_size', '-4000');
                await setPragma('temp_store', 'MEMORY');
                await setPragma('locking_mode', 'NORMAL');
                await setPragma('mmap_size', '268435456');

                // Check JSON1 extension
                try {
                    await db.getAsync("SELECT json_group_array(1) as test");
                } catch (e) {
                    if (e.message.includes('no such function')) {
                        console.error('JSON1 extension not available. Some features may not work.');
                    }
                    console.error('Error checking JSON1 extension:', e);
                }

                // Check if database needs initialization
                const row = await db.getAsync('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="item"');
                const needsInit = !row || row.count === 0;

                if (needsInit) {
                    console.log('Database needs initialization, creating tables...');
                    // Read schema
                    const schema = fs.readFileSync(schemaPath, 'utf8');
                    
                    // Remove DROP statements
                    const cleanSchema = schema
                        .split('\n')
                        .filter(line => !line.trim().toLowerCase().startsWith('drop'))
                        .join('\n');
                    
                    // Split schema into individual statements, preserving triggers
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

                    // Begin transaction for schema creation
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

                resolve(db);
            } catch (error) {
                console.error('Error initializing database:', error);
                reject(error);
            }
        });

        // Handle database errors
        db.on('error', (err) => {
            console.error('Database error:', err);
        });

        // Handle process termination
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
        throw new Error('Database not initialized');
    }
    return db;
}

module.exports = {
    initializeDatabase,
    getDatabase
};
