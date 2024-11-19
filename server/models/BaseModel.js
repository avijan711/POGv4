const debug = require('../utils/debug');

class BaseModel {
    constructor(db) {
        if (!db) {
            throw new Error('Database instance is required');
        }
        this.db = db;
        
        // Get prototype methods if they exist
        const proto = Object.getPrototypeOf(db);
        this.all = proto.all ? proto.all.bind(db) : db.all.bind(db);
        this.get = proto.get ? proto.get.bind(db) : db.get.bind(db);
        this.run = proto.run ? proto.run.bind(db) : db.run.bind(db);
    }

    /**
     * Execute a database query with parameters and performance tracking
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @returns {Promise} - Resolves with query results
     */
    async executeQuery(query, params = []) {
        const queryId = Math.random().toString(36).substring(7);
        debug.time(`Query ${queryId}`);
        debug.logQuery(`Query ${queryId}`, query, params);

        try {
            const result = await new Promise((resolve, reject) => {
                this.all(query, params, (err, rows) => {
                    if (err) {
                        debug.error(`Query ${queryId} error:`, err);
                        reject(err);
                        return;
                    }
                    resolve(rows || []);
                });
            });

            debug.log(`Query ${queryId} result`, result);
            debug.timeEnd(`Query ${queryId}`);
            return result;
        } catch (error) {
            debug.error(`Query ${queryId} failed:`, error);
            throw error;
        }
    }

    /**
     * Execute a single-row query with performance tracking
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @returns {Promise} - Resolves with a single row
     */
    async executeQuerySingle(query, params = []) {
        const queryId = Math.random().toString(36).substring(7);
        debug.time(`Single Query ${queryId}`);
        debug.logQuery(`Single Query ${queryId}`, query, params);

        try {
            const result = await new Promise((resolve, reject) => {
                this.get(query, params, (err, row) => {
                    if (err) {
                        debug.error(`Single Query ${queryId} error:`, err);
                        reject(err);
                        return;
                    }
                    resolve(row);
                });
            });

            debug.log(`Single Query ${queryId} result`, result);
            debug.timeEnd(`Single Query ${queryId}`);
            return result;
        } catch (error) {
            debug.error(`Single Query ${queryId} failed:`, error);
            throw error;
        }
    }

    /**
     * Execute a database run command with performance tracking
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @returns {Promise} - Resolves with the result
     */
    async executeRun(query, params = []) {
        const queryId = Math.random().toString(36).substring(7);
        debug.time(`Run ${queryId}`);
        debug.logQuery(`Run ${queryId}`, query, params);

        try {
            const result = await new Promise((resolve, reject) => {
                this.run(query, params, function(err) {
                    if (err) {
                        debug.error(`Run ${queryId} error:`, err);
                        reject(err);
                        return;
                    }
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                });
            });

            debug.log(`Run ${queryId} result`, result);
            debug.timeEnd(`Run ${queryId}`);
            return result;
        } catch (error) {
            debug.error(`Run ${queryId} failed:`, error);
            throw error;
        }
    }

    /**
     * Execute a transaction with multiple queries and performance tracking
     * @param {Function} transactionCallback - Function containing transaction queries
     * @returns {Promise} - Resolves when transaction is complete
     */
    async executeTransaction(transactionCallback) {
        const transactionId = Math.random().toString(36).substring(7);
        debug.time(`Transaction ${transactionId}`);
        debug.log(`Starting transaction ${transactionId}`);

        try {
            await this.executeRun('BEGIN TRANSACTION');

            const result = await transactionCallback();

            await this.executeRun('COMMIT');

            debug.log(`Transaction ${transactionId} committed successfully`);
            debug.timeEnd(`Transaction ${transactionId}`);
            return result;
        } catch (error) {
            debug.error(`Transaction ${transactionId} error:`, error);
            await this.executeRun('ROLLBACK');
            throw error;
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
