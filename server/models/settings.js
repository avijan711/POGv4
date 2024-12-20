const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SettingsModel extends BaseModel {
    constructor(dal) {
        super(dal);
        this.initializeDebugSettings();
    }

    async initializeDebugSettings() {
        try {
            const debugSetting = await this.getSetting('debug');
            if (debugSetting) {
                const settings = JSON.parse(debugSetting.value);
                await debug.updateSettings(settings);
            }
        } catch (err) {
            console.error('Error initializing debug settings:', err);
        }
    }

    async getAllSettings() {
        try {
            const sql = 'SELECT * FROM settings';
            return await this.executeQuery(sql);
        } catch (err) {
            console.error('Error fetching settings:', err);
            throw err;
        }
    }

    async getSetting(key) {
        try {
            const sql = 'SELECT * FROM settings WHERE key = ?';
            const setting = await this.executeQuerySingle(sql, [key]);
            
            // If it's a debug setting, update the debug utility
            if (key === 'debug' && setting) {
                try {
                    const debugSettings = JSON.parse(setting.value);
                    await debug.updateSettings(debugSettings);
                } catch (err) {
                    console.error('Error parsing debug settings:', err);
                }
            }
            
            return setting;
        } catch (err) {
            console.error('Error fetching setting:', err);
            throw err;
        }
    }

    async updateSetting(key, value, description = null) {
        try {
            const sql = `
                INSERT INTO settings (key, value, description)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    description = COALESCE(excluded.description, settings.description),
                    updated_at = CURRENT_TIMESTAMP
            `;
            await this.executeRun(sql, [key, value.toString(), description]);

            // If it's a debug setting, update the debug utility
            if (key === 'debug') {
                try {
                    const debugSettings = JSON.parse(value);
                    await debug.updateSettings(debugSettings);
                } catch (err) {
                    console.error('Error updating debug settings:', err);
                }
            }

            return await this.getSetting(key);
        } catch (err) {
            console.error('Error updating setting:', err);
            throw err;
        }
    }

    async resetDatabase() {
        try {
            console.log('Starting database reset...');

            // Get paths
            const resetScriptPath = path.join(__dirname, '..', 'reset_db.sql');
            const dbPath = path.join(__dirname, '..', 'inventory.db');

            // Ensure the reset script exists
            if (!fs.existsSync(resetScriptPath)) {
                console.error('Reset script not found:', resetScriptPath);
                throw new Error('Reset script not found');
            }

            // Execute the reset script using sqlite3
            const command = `sqlite3 "${dbPath}" ".read ${resetScriptPath}"`;
            console.log('Executing command:', command);

            try {
                const { stdout, stderr } = await execPromise(command);
                
                if (stderr) {
                    console.error('SQLite error output:', stderr);
                    throw new Error('Error executing reset script: ' + stderr);
                }

                if (stdout) {
                    console.log('SQLite output:', stdout);
                }
            } catch (err) {
                console.error('Error executing sqlite3 command:', err);
                throw new Error('Failed to execute sqlite3 command: ' + err.message);
            }

            // Verify database state
            try {
                const settings = await this.getAllSettings();
                console.log('Settings after reset:', settings);
                
                if (!settings || settings.length === 0) {
                    throw new Error('Settings table is empty after reset');
                }

                // Execute VACUUM separately
                console.log('Executing VACUUM...');
                await this.executeRun('VACUUM;');
                console.log('VACUUM completed successfully');

                console.log('Database reset completed successfully');
                return { 
                    success: true, 
                    message: 'Database reset successfully',
                    details: 'All data has been cleared while preserving settings'
                };
            } catch (err) {
                console.error('Error verifying database state:', err);
                throw new Error('Database verification failed after reset: ' + err.message);
            }
        } catch (error) {
            console.error('Error during database reset:', error);
            throw error;
        }
    }
}

module.exports = SettingsModel;
