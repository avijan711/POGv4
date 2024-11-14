const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use absolute path for database
const dbPath = path.join(__dirname, '..', 'inventory.db');

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Check if database exists
    const dbExists = fs.existsSync(dbPath);
    console.log(`Database ${dbExists ? 'exists' : 'does not exist'} at ${dbPath}`);

    const db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      
      try {
        // Enable foreign keys
        await new Promise((resolve, reject) => {
          db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
              console.error('Error enabling foreign keys:', err);
              reject(err);
              return;
            }
            console.log('Foreign keys enabled');
            resolve();
          });
        });

        // Always apply schema to ensure all tables exist
        console.log('Applying schema...');
        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        const statements = schemaSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);

        // Also get the Order tables specific SQL
        const orderTablesPath = path.join(__dirname, '..', 'create_order_tables.sql');
        const orderTablesSQL = fs.readFileSync(orderTablesPath, 'utf8');
        const orderStatements = orderTablesSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);

        // Combine all statements
        const allStatements = [...statements, ...orderStatements];

        await new Promise((resolve, reject) => {
          db.serialize(() => {
            // Execute each statement in a transaction
            db.run('BEGIN TRANSACTION');
            
            // Create a promise for each statement
            const stmtPromises = allStatements.map(statement => {
              return new Promise((resolveStmt, rejectStmt) => {
                db.run(statement, (err) => {
                  if (err) {
                    console.error('Error executing statement:', err);
                    console.error('Statement:', statement);
                    rejectStmt(err);
                  } else {
                    resolveStmt();
                  }
                });
              });
            });

            // Wait for all statements to complete
            Promise.all(stmtPromises)
              .then(() => {
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Error committing transaction:', err);
                    db.run('ROLLBACK');
                    reject(err);
                  } else {
                    console.log('Schema applied successfully');
                    resolve();
                  }
                });
              })
              .catch(err => {
                console.error('Error applying schema:', err);
                db.run('ROLLBACK');
                reject(err);
              });
          });
        });

        console.log('Database initialized successfully');

        // Verify tables exist
        await new Promise((resolve, reject) => {
          db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
            if (err) {
              console.error('Error verifying tables:', err);
              reject(err);
              return;
            }
            console.log('Available tables:', tables.map(t => t.name).join(', '));
            resolve();
          });
        });

        // Verify foreign keys are enabled
        await new Promise((resolve, reject) => {
          db.get('PRAGMA foreign_keys', [], (err, result) => {
            if (err) {
              console.error('Error checking foreign keys:', err);
              reject(err);
              return;
            }
            console.log('Foreign keys status:', result);
            resolve();
          });
        });

        resolve(db);
      } catch (error) {
        console.error('Error initializing database:', error);
        reject(error);
      }
    });
  });
}

module.exports = {
  initializeDatabase
};
