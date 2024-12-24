const debug = require('../utils/debug');

/**
 * Error class for database constraint violations
 */
class ConstraintViolationError extends Error {
  constructor(message, constraint) {
    super(message);
    this.name = 'ConstraintViolationError';
    this.constraint = constraint;
  }
}

class BaseModel {
  constructor(dal) {
    if (!dal) {
      throw new Error('Database Access Layer instance is required');
    }
    this.db = dal;
  }

  /**
     * Execute a database query with parameters and performance tracking
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @param {Object} options - Query options
     * @returns {Promise} - Resolves with query results
     */
  async executeQuery(query, params = [], options = {}) {
    try {
      const { forUpdate } = options;
      const finalQuery = forUpdate ? `${query} FOR UPDATE` : query;
            
      debug.logQuery('Executing query', finalQuery, params);

      return await this.db.query(finalQuery, params);
    } catch (err) {
      this.handleDatabaseError(err);
    }
  }

  /**
     * Execute a single-row query with performance tracking
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @param {Object} options - Query options
     * @returns {Promise} - Resolves with a single row
     */
  async executeQuerySingle(query, params = [], options = {}) {
    try {
      const { forUpdate } = options;
      const finalQuery = forUpdate ? `${query} FOR UPDATE` : query;
            
      debug.logQuery('Executing single query', finalQuery, params);

      return await this.db.querySingle(finalQuery, params);
    } catch (err) {
      this.handleDatabaseError(err);
    }
  }

  /**
     * Execute a database run command with performance tracking
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @returns {Promise} - Resolves with the result
     */
  async executeRun(query, params = []) {
    try {
      debug.logQuery('Executing run', query, params);

      return await this.db.run(query, params);
    } catch (err) {
      this.handleDatabaseError(err);
    }
  }

  /**
     * Execute a transaction with multiple queries and performance tracking
     * @param {Function} transactionCallback - Function containing transaction queries
     * @param {Object} options - Transaction options
     * @returns {Promise} - Resolves when transaction is complete
     */
  async executeTransaction(transactionCallback, options = {}) {
    const { isolationLevel = 'SERIALIZABLE' } = options;
        
    try {
      debug.logDatabase('Starting transaction', { isolationLevel, options });

      // Set isolation level and enable foreign keys
      await this.db.run(`PRAGMA read_uncommitted = ${isolationLevel === 'READ_UNCOMMITTED' ? 1 : 0}`);
      await this.db.run('PRAGMA foreign_keys = ON');
            
      const result = await this.db.executeTransaction(async () => {
        return await transactionCallback();
      });

      debug.logDatabase('Transaction completed', { success: true });
      return result;
    } catch (err) {
      console.error('Transaction failed:', err);
      this.handleDatabaseError(err);
    } finally {
      // Reset isolation level to default
      await this.db.run('PRAGMA read_uncommitted = 0');
    }
  }

  /**
     * Handle database errors and convert them to appropriate error types
     * @param {Error} err - The original error
     * @throws {Error} - Throws appropriate error type
     */
  handleDatabaseError(err) {
    console.error('Database error:', err);

    if (err.message.includes('UNIQUE constraint failed')) {
      const constraint = err.message.match(/UNIQUE constraint failed: (.+)/)?.[1];
      throw new ConstraintViolationError('Unique constraint violation', constraint);
    }

    if (err.message.includes('CHECK constraint failed')) {
      const constraint = err.message.match(/CHECK constraint failed: (.+)/)?.[1];
      throw new ConstraintViolationError('Check constraint violation', constraint);
    }

    if (err.message.includes('FOREIGN KEY constraint failed')) {
      const constraint = err.message.match(/FOREIGN KEY constraint failed/)?.[0];
      throw new ConstraintViolationError('Foreign key constraint violation', constraint);
    }

    throw err;
  }

  /**
     * Parse JSON fields in database results
     * @param {Object} row - Database row
     * @param {Array} jsonFields - Array of field names that contain JSON
     * @returns {Object} - Row with parsed JSON fields
     */
  parseJsonFields(row, jsonFields) {
    if (!row) {
      console.error('No row data to parse JSON fields');
      return row;
    }

    debug.logDatabase('Parsing JSON fields', { row, jsonFields });
    const parsedRow = { ...row };

    for (const field of jsonFields) {
      if (parsedRow[field]) {
        try {
          if (typeof parsedRow[field] === 'string') {
            debug.logDatabase(`Parsing JSON field: ${field}`, parsedRow[field]);
            parsedRow[field] = JSON.parse(parsedRow[field]);
            debug.logDatabase(`Parsed ${field}`, parsedRow[field]);
          }
        } catch (e) {
          console.error(`Error parsing JSON field ${field}:`, e);
          debug.logDatabase(`Failed JSON content for ${field}`, parsedRow[field]);
          parsedRow[field] = null;
        }
      }
    }

    debug.logDatabase('Final parsed row', parsedRow);
    return parsedRow;
  }

  /**
     * Check if a constraint violation is for a specific constraint
     * @param {Error} error - The error to check
     * @param {string} constraintName - The name of the constraint
     * @returns {boolean} - True if the error is for the specified constraint
     */
  isConstraintViolation(error, constraintName) {
    return (
      error instanceof ConstraintViolationError &&
            error.constraint?.includes(constraintName)
    );
  }
}

// Export BaseModel as default and ConstraintViolationError as a named export
BaseModel.ConstraintViolationError = ConstraintViolationError;
module.exports = BaseModel;
