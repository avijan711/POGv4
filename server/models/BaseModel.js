class BaseModel {
    constructor(db) {
        this.db = db;
    }

    /**
     * Execute a database query with parameters
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @returns {Promise} - Resolves with query results
     */
    executeQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    /**
     * Execute a single-row query
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters
     * @returns {Promise} - Resolves with a single row
     */
    executeQuerySingle(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    reject(err);
                    return;
                }
                console.log('Raw database row:', row);
                resolve(row);
            });
        });
    }

    /**
     * Execute a transaction with multiple queries
     * @param {Function} transactionCallback - Function containing transaction queries
     * @returns {Promise} - Resolves when transaction is complete
     */
    executeTransaction(transactionCallback) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                try {
                    transactionCallback(this.db)
                        .then(() => {
                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('Error committing transaction:', err);
                                    this.db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }
                                resolve();
                            });
                        })
                        .catch((err) => {
                            console.error('Error in transaction:', err);
                            this.db.run('ROLLBACK');
                            reject(err);
                        });
                } catch (err) {
                    console.error('Error executing transaction:', err);
                    this.db.run('ROLLBACK');
                    reject(err);
                }
            });
        });
    }

    /**
     * Parse JSON fields in database results
     * @param {Object} row - Database row
     * @param {Array} jsonFields - Array of field names that contain JSON
     * @returns {Object} - Row with parsed JSON fields
     */
    parseJsonFields(row, jsonFields) {
        if (!row) return row;

        console.log('Parsing JSON fields for row:', row);
        console.log('JSON fields to parse:', jsonFields);

        const parsedRow = { ...row };
        for (const field of jsonFields) {
            console.log(`Processing field ${field}:`, {
                value: parsedRow[field],
                type: typeof parsedRow[field]
            });

            if (parsedRow[field]) {
                try {
                    if (typeof parsedRow[field] === 'object') {
                        console.log(`Field ${field} is already an object, skipping parsing`);
                        continue;
                    }
                    console.log(`Attempting to parse ${field}:`, parsedRow[field]);
                    parsedRow[field] = JSON.parse(parsedRow[field]);
                    console.log(`Successfully parsed ${field}:`, parsedRow[field]);
                } catch (e) {
                    console.error(`Error parsing JSON field ${field}:`, {
                        error: e,
                        value: parsedRow[field],
                        type: typeof parsedRow[field]
                    });
                    parsedRow[field] = null;
                }
            } else {
                console.log(`Field ${field} is null or undefined`);
            }
        }

        console.log('Final parsed row:', parsedRow);
        return parsedRow;
    }
}

module.exports = BaseModel;
