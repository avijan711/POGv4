const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

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

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, '..', 'inventory.db');
        const schemaPath = path.join(__dirname, '..', 'schema.sql');

        // Create database connection
        db = new verbose.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                reject(err);
                return;
            }

            console.log('Connected to SQLite database');
            
            // Debug: Log available methods on db instance
            console.log('Available database methods:', Object.keys(db));
            console.log('Is "all" method available?', typeof db.all === 'function');
            console.log('Is "get" method available?', typeof db.get === 'function');
            console.log('Is "run" method available?', typeof db.run === 'function');

            try {
                // First, ensure we're not in a transaction
                await new Promise((resolve, reject) => {
                    db.get("PRAGMA query_only = 0;", (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

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
                    await new Promise((resolve, reject) => {
                        db.get("SELECT json_group_array(1) as test", [], function(err) {
                            if (err && err.message.includes('no such function')) {
                                console.error('JSON1 extension not available. Some features may not work.');
                            }
                            resolve();
                        });
                    });
                } catch (e) {
                    console.error('Error checking JSON1 extension:', e);
                }

                // Read schema
                const schema = fs.readFileSync(schemaPath, 'utf8');
                
                // Split schema into individual statements, preserving triggers
                const statements = [];
                let currentStatement = '';
                let inTrigger = false;

                schema.split(';').forEach(statement => {
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
                await runStatement('BEGIN IMMEDIATE TRANSACTION;');

                try {
                    console.log('Executing schema statements...');
                    for (let i = 0; i < statements.length; i++) {
                        const statement = statements[i].trim();
                        if (!statement) continue;
                        
                        try {
                            await runStatement(statement);
                        } catch (err) {
                            if (err.code !== 'SQLITE_ERROR' || !err.message.includes('already exists')) {
                                console.error(`Error executing statement ${i + 1}:`, err);
                                console.error('Statement:', statement);
                                await runStatement('ROLLBACK;');
                                reject(err);
                                return;
                            }
                        }
                    }

                    // Verify the database setup by checking if the item table exists
                    const verifyDatabase = () => {
                        return new Promise((resolveVerify, rejectVerify) => {
                            db.get('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="item"', [], async (err, row) => {
                                if (err) {
                                    console.error('Error verifying database setup:', err);
                                    await runStatement('ROLLBACK;');
                                    rejectVerify(err);
                                    return;
                                }

                                if (row.count === 0) {
                                    console.error('Database verification failed: item table not found');
                                    await runStatement('ROLLBACK;');
                                    rejectVerify(new Error('Database setup incomplete'));
                                    return;
                                }

                                console.log('Database verification successful');
                                resolveVerify();
                            });
                        });
                    };

                    await verifyDatabase();
                    await runStatement('COMMIT;');
                    
                    console.log('Database schema initialized successfully');
                    resolve(db);
                } catch (error) {
                    console.error('Error during database initialization:', error);
                    await runStatement('ROLLBACK;');
                    reject(error);
                }
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

// Utility function to run SQL statements with proper error handling and retries
const runStatement = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        const tryRun = (retries = 5) => {  // Increased retries to 5
            db.run(sql, params, (err) => {
                if (err) {
                    console.error('SQL Error:', err.message);
                    console.error('SQL Statement:', sql);
                    console.error('Parameters:', params);
                    
                    if (err.code === 'SQLITE_BUSY' && retries > 0) {
                        // If database is busy, wait and retry with exponential backoff
                        const delay = Math.min(1000 * Math.pow(2, 5 - retries), 8000);  // Max 8 second delay
                        console.log(`Database busy, retrying in ${delay}ms... (${retries} retries left)`);
                        setTimeout(() => tryRun(retries - 1), delay);
                    } else {
                        reject(err);
                    }
                    return;
                }
                resolve();
            });
        };
        tryRun();
    });
};

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
