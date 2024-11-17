const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database connection pool
let db = null;

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, '..', 'inventory.db');
        const schemaPath = path.join(__dirname, '..', 'schema.sql');

        // Create database connection with optimized settings
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                reject(err);
                return;
            }

            console.log('Connected to SQLite database');

            try {
                // Configure database settings for better concurrency
                await Promise.all([
                    runStatement('PRAGMA journal_mode = WAL;'),           // Enable Write-Ahead Logging
                    runStatement('PRAGMA synchronous = NORMAL;'),         // Faster writes with reasonable safety
                    runStatement('PRAGMA busy_timeout = 5000;'),          // Wait up to 5 seconds when database is locked
                    runStatement('PRAGMA foreign_keys = ON;'),            // Enable foreign key constraints
                    runStatement('PRAGMA cache_size = -2000;'),           // Use 2MB of cache
                    runStatement('PRAGMA temp_store = MEMORY;')           // Store temp tables in memory
                ]);

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

                // Begin transaction
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

                    // Verify the database setup
                    const verifyDatabase = () => {
                        return new Promise((resolveVerify, rejectVerify) => {
                            db.get('SELECT COUNT(*) as count FROM ItemReferenceChange', [], async (err, row) => {
                                if (err) {
                                    console.error('Error checking test data:', err);
                                    await runStatement('ROLLBACK;');
                                    rejectVerify(err);
                                    return;
                                }

                                console.log('Number of reference changes:', row.count);
                                resolveVerify();
                            });
                        });
                    };

                    await verifyDatabase();
                    await runStatement('COMMIT;');
                    
                    console.log('Database schema and test data initialized successfully');
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
        const tryRun = (retries = 3) => {
            db.run(sql, params, (err) => {
                if (err) {
                    if (err.code === 'SQLITE_BUSY' && retries > 0) {
                        // If database is busy, wait and retry
                        setTimeout(() => tryRun(retries - 1), 1000);
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

// Add a function to manually insert test data
async function insertTestData(database) {
    try {
        await runStatement('BEGIN IMMEDIATE TRANSACTION');

        // Add items
        await runStatement(
            `INSERT OR REPLACE INTO Item (ItemID, HebrewDescription, EnglishDescription) 
             VALUES (?, ?, ?)`,
            ['171366', 'בנד אומגה 308\\2008', 'Original Product 1']
        );

        await runStatement(
            `INSERT OR REPLACE INTO Item (ItemID, HebrewDescription, EnglishDescription) 
             VALUES (?, ?, ?)`,
            ['1692647380', 'בנד אומגה 308\\2008 חדש', 'New Product 1']
        );

        // Add supplier
        await runStatement(
            `INSERT OR REPLACE INTO Supplier (SupplierID, Name, ContactPerson, Email, Phone) 
             VALUES (?, ?, ?, ?, ?)`,
            [1, 'Test Supplier 1', 'Contact 1', 'contact1@test.com', '123-456-7890']
        );

        // Add reference change
        await runStatement(
            `INSERT OR REPLACE INTO ItemReferenceChange 
             (OriginalItemID, NewReferenceID, ChangedByUser, SupplierID, Notes) 
             VALUES (?, ?, ?, ?, ?)`,
            ['171366', '1692647380', 1, null, 'Updated to newer version']
        );

        // Add inquiry
        await runStatement(
            `INSERT OR REPLACE INTO Inquiry (InquiryID, Status, CreatedDate) 
             VALUES (?, ?, datetime('now'))`,
            [1, 'Active']
        );

        // Add inquiry item
        await runStatement(
            `INSERT OR REPLACE INTO InquiryItem 
             (InquiryID, ItemID, OriginalItemID, RequestedQty, HebrewDescription) 
             VALUES (?, ?, ?, ?, ?)`,
            [1, '171366', '171366', 3, 'בנד אומגה 308\\2008']
        );

        await runStatement('COMMIT');
        console.log('Test data inserted successfully');
    } catch (error) {
        console.error('Error inserting test data:', error);
        await runStatement('ROLLBACK');
        throw error;
    }
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
    insertTestData,
    getDatabase
};
