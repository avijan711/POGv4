const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const debug = require('../utils/debug');

class MigrationManager {
  constructor(db) {
    this.db = db;
    this.migrationsPath = path.join(__dirname, '..', 'migrations');
    this.schemaPath = path.join(this.migrationsPath, 'schema');
  }

  /**
     * Calculate SHA-256 checksum of a file's contents
     */
  async calculateChecksum(content) {
    const hash = crypto.createHash('sha256');
    // Only remove comments and empty lines, preserve formatting
    const normalizedContent = content
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--'))
      .join('\n');
    hash.update(normalizedContent);
    return hash.digest('hex');
  }

  /**
     * Split SQL content into statements while preserving triggers and views
     */
  splitSqlStatements(content) {
    const statements = [];
    let currentStatement = '';
    let inCompoundStatement = false;
    let compoundType = null;
    let bracketCount = 0;

    // Split into lines but preserve comments for readability
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim().toUpperCase();
            
      // Skip empty lines
      if (!line.trim()) {
        if (currentStatement) {
          currentStatement += '\n';
        }
        continue;
      }

      // Check if we're starting a compound statement
      if (!inCompoundStatement) {
        if (trimmedLine.includes('CREATE TRIGGER')) {
          inCompoundStatement = true;
          compoundType = 'TRIGGER';
        } else if (trimmedLine.includes('CREATE VIEW')) {
          inCompoundStatement = true;
          compoundType = 'VIEW';
        }
      }

      // Count brackets for nested statements
      bracketCount += (line.match(/\(/g) || []).length;
      bracketCount -= (line.match(/\)/g) || []).length;

      // Add line to current statement
      currentStatement += line + '\n';

      // Handle statement completion
      if (inCompoundStatement) {
        if ((compoundType === 'VIEW' && trimmedLine.endsWith(';')) ||
                    (compoundType === 'TRIGGER' && trimmedLine === 'END;')) {
          statements.push(currentStatement.trim());
          currentStatement = '';
          inCompoundStatement = false;
          compoundType = null;
          bracketCount = 0;
        }
      } else if (trimmedLine.endsWith(';') && bracketCount === 0) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements;
  }

  /**
     * Initialize migrations table and apply schema migrations
     */
  async initialize() {
    debug.log('Initializing migration manager...');
        
    // Create migrations table using the schema file
    const schemaFile = path.join(this.schemaPath, '001_create_migrations_table.sql');
    const schemaContent = await fs.readFile(schemaFile, 'utf8');
        
    try {
      await this.db.executeTransaction(async () => {
        await this.db.run('PRAGMA foreign_keys = OFF');
        await this.db.run(schemaContent);
        await this.db.run('PRAGMA foreign_keys = ON');
      });
      debug.log('Migrations table initialized successfully');
    } catch (error) {
      debug.error('Error initializing migrations table:', error);
      throw error;
    }
  }

  /**
     * Get list of applied migrations
     */
  async getAppliedMigrations() {
    const sql = `
            SELECT filename, checksum, applied_at, success
            FROM schema_migrations
            ORDER BY filename
        `;
    return await this.db.query(sql);
  }

  /**
     * Get list of pending migrations
     */
  async getPendingMigrations() {
    const applied = await this.getAppliedMigrations();
    const appliedFiles = new Set(applied.map(m => m.filename));
        
    // Get all .sql files from migrations directory
    const files = await fs.readdir(this.migrationsPath);
    const pendingFiles = files
      .filter(f => f.endsWith('.sql') && !appliedFiles.has(f))
      .sort();
        
    return pendingFiles;
  }

  /**
     * Apply a single migration
     */
  async applyMigration(filename) {
    const filePath = path.join(this.migrationsPath, filename);
    const content = await fs.readFile(filePath, 'utf8');
    const checksum = await this.calculateChecksum(content);

    debug.log(`Applying migration: ${filename}`);

    try {
      await this.db.executeTransaction(async () => {
        // Insert migration record
        await this.db.run(`
                    INSERT INTO schema_migrations (filename, checksum)
                    VALUES (?, ?)
                `, [filename, checksum]);

        // Skip empty migrations
        if (content.trim()) {
          // Split content into statements, preserving triggers and views
          const statements = this.splitSqlStatements(content);

          // Execute each statement
          for (const stmt of statements) {
            if (stmt.trim()) {
              try {
                await this.db.run(stmt);
              } catch (err) {
                debug.error(`Error executing statement:\n${stmt}\n\nError:`, err);
                throw err;
              }
            }
          }
        }

        // Mark as successful
        await this.db.run(`
                    UPDATE schema_migrations
                    SET success = 1
                    WHERE filename = ?
                `, [filename]);
      });

      debug.log(`Successfully applied migration: ${filename}`);
      return true;
    } catch (error) {
      debug.error(`Error applying migration ${filename}:`, error);

      // Record the error
      try {
        await this.db.run(`
                    UPDATE schema_migrations
                    SET error_message = ?
                    WHERE filename = ?
                `, [error.message, filename]);
      } catch (updateError) {
        debug.error('Error recording migration failure:', updateError);
      }

      throw error;
    }
  }

  /**
     * Apply all pending migrations
     */
  async applyPendingMigrations() {
    const pendingFiles = await this.getPendingMigrations();
        
    if (pendingFiles.length === 0) {
      debug.log('No pending migrations found');
      return [];
    }

    debug.log(`Found ${pendingFiles.length} pending migrations`);
    const results = [];

    for (const file of pendingFiles) {
      try {
        await this.applyMigration(file);
        results.push({ file, success: true });
      } catch (error) {
        results.push({ file, success: false, error: error.message });
        throw error; // Stop migration process on first error
      }
    }

    return results;
  }

  /**
     * Verify database schema integrity
     */
  async verifySchema() {
    const applied = await this.getAppliedMigrations();
        
    for (const migration of applied) {
      const filePath = path.join(this.migrationsPath, migration.filename);
      const content = await fs.readFile(filePath, 'utf8');
      const currentChecksum = await this.calculateChecksum(content);
            
      if (currentChecksum !== migration.checksum) {
        throw new Error(
          `Schema integrity violation: ${migration.filename} has been modified after being applied`,
        );
      }
    }
        
    debug.log('Schema integrity verified successfully');
    return true;
  }
}

module.exports = MigrationManager;