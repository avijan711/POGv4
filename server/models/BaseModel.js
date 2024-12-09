const debug = require('../utils/debug');

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
     * @returns {Promise} - Resolves with query results
     */
    async executeQuery(query, params = []) {
        try {
            return await this.db.query(query, params);
        } catch (err) {
            debug.error('Error executing query:', err);
            throw err;
        }
    }

    /**
     * Execute a single-row query with performance tracking
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @returns {Promise} - Resolves with a single row
     */
    async executeQuerySingle(query, params = []) {
        try {
            return await this.db.querySingle(query, params);
        } catch (err) {
            debug.error('Error executing single query:', err);
            throw err;
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
            return await this.db.run(query, params);
        } catch (err) {
            debug.error('Error executing run:', err);
            throw err;
        }
    }

    /**
     * Execute a transaction with multiple queries and performance tracking
     * @param {Function} transactionCallback - Function containing transaction queries
     * @returns {Promise} - Resolves when transaction is complete
     */
    async executeTransaction(transactionCallback) {
        try {
            const result = await this.db.executeTransaction(async () => {
                return await transactionCallback();
            });
            return result;
        } catch (err) {
            debug.error('Error executing transaction:', err);
            throw err;
        }
    }

    /**
     * Parse JSON fields in database results
     * @param {Object} row - Database row
     * @param {Array} jsonFields - Array of field names that contain JSON
     * @returns {Object} - Row with parsed JSON fields
     */
    parseJsonFields(row, jsonFields) {
        if (!row) {
            debug.error('No row data to parse JSON fields');
            return row;
        }

        debug.log('Parsing JSON fields for row', { row, jsonFields });
        const parsedRow = { ...row };

        for (const field of jsonFields) {
            if (parsedRow[field]) {
                try {
                    if (typeof parsedRow[field] === 'string') {
                        debug.log(`Parsing JSON field: ${field}`);
                        parsedRow[field] = JSON.parse(parsedRow[field]);
                        debug.log(`Parsed ${field}`, parsedRow[field]);
                    }
                } catch (e) {
                    debug.error(`Error parsing JSON field ${field}:`, e);
                    debug.log(`Failed JSON content for ${field}`, parsedRow[field]);
                    parsedRow[field] = null;
                }
            }
        }

        debug.log('Final parsed row', parsedRow);
        return parsedRow;
    }
}

module.exports = BaseModel;
