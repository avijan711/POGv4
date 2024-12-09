const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SettingsModel extends BaseModel {
    constructor(dal) {
        super(dal);
    }

    async getAllSettings() {
        const sql = 'SELECT * FROM settings';
        return await this.executeQuery(sql);
    }

    async getSetting(key) {
        const sql = 'SELECT * FROM settings WHERE key = ?';
        return await this.executeQuerySingle(sql, [key]);
    }

    async updateSetting(key, value, description = null) {
        const sql = `
            INSERT INTO settings (key, value, description)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                description = COALESCE(excluded.description, settings.description),
                updated_at = CURRENT_TIMESTAMP
        `;
        await this.executeRun(sql, [key, value.toString(), description]);
        return await this.getSetting(key);
    }

    async resetDatabase() {
        try {
            debug.log('Starting database reset...');

            // Get paths
            const resetScriptPath = path.join(__dirname, '..', 'reset_db.sql');
            const dbPath = path.join(__dirname, '..', 'inventory.db');

            // Ensure the reset script exists
            if (!fs.existsSync(resetScriptPath)) {
                debug.error('Reset script not found:', resetScriptPath);
                throw new Error('Reset script not found');
            }

            // Execute the reset script using sqlite3
            const command = `sqlite3 "${dbPath}" ".read ${resetScriptPath}"`;
            debug.log('Executing command:', command);

            try {
                const { stdout, stderr } = await execPromise(command);
                
                if (stderr) {
                    debug.error('SQLite error output:', stderr);
                    throw new Error('Error executing reset script: ' + stderr);
                }

                if (stdout) {
                    debug.log('SQLite output:', stdout);
                }
            } catch (err) {
                debug.error('Error executing sqlite3 command:', err);
                throw new Error('Failed to execute sqlite3 command: ' + err.message);
            }

            // Verify database state
            try {
                const settings = await this.getAllSettings();
                debug.log('Settings after reset:', settings);
                
                if (!settings || settings.length === 0) {
                    throw new Error('Settings table is empty after reset');
                }

                // Execute VACUUM separately
                debug.log('Executing VACUUM...');
                await this.executeRun('VACUUM;');
                debug.log('VACUUM completed successfully');

                debug.log('Database reset completed successfully');
                return { 
                    success: true, 
                    message: 'Database reset successfully',
                    details: 'All data has been cleared while preserving settings'
                };
            } catch (err) {
                debug.error('Error verifying database state:', err);
                throw new Error('Database verification failed after reset: ' + err.message);
            }
        } catch (error) {
            debug.error('Error during database reset:', error);
            throw error;
        }
    }
}

module.exports = SettingsModel;
