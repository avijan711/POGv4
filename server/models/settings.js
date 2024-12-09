const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');
const fs = require('fs');
const path = require('path');

class SettingsModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async get(key) {
        const sql = 'SELECT SettingValue FROM Settings WHERE SettingKey = ?';
        const row = await this.executeQuerySingle(sql, [key]);
        return row ? row.SettingValue : null;
    }

    async getAll() {
        const sql = 'SELECT SettingKey, SettingValue FROM Settings';
        const rows = await this.executeQuery(sql);
        const settings = {};
        rows.forEach(row => {
            settings[row.SettingKey] = row.SettingValue;
        });
        return settings;
    }

    async set(key, value) {
        const sql = `
            INSERT INTO Settings (SettingKey, SettingValue, LastUpdated)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(SettingKey) DO UPDATE SET 
                SettingValue = excluded.SettingValue,
                LastUpdated = CURRENT_TIMESTAMP
        `;
        await this.executeRun(sql, [key, value]);
        return true;
    }

    async resetDatabase() {
        // Define the delete statements directly to avoid parsing issues
        const deleteStatements = [
            'DELETE FROM promotion_item',
            'DELETE FROM order_item',
            'DELETE FROM supplier_response_item',
            'DELETE FROM promotion',
            'DELETE FROM "order"',
            'DELETE FROM supplier_response',
            'DELETE FROM price_history',
            'DELETE FROM inquiry_item',
            'DELETE FROM inquiry',
            'DELETE FROM item_files',
            'DELETE FROM item_reference_change',
            'DELETE FROM supplier',
            'DELETE FROM item'
        ];

        try {
            // Step 1: Disable foreign keys (outside transaction)
            debug.log('Disabling foreign keys');
            await this.executeRun('PRAGMA foreign_keys = OFF');

            try {
                // Step 2: Execute DELETE operations in a transaction
                debug.log('Starting delete operations');
                await this.executeTransaction(async () => {
                    for (const stmt of deleteStatements) {
                        debug.log('Executing:', stmt);
                        await this.executeRun(stmt);
                    }
                });

                // Step 3: Run VACUUM separately (must be outside transaction)
                debug.log('Running VACUUM');
                try {
                    await this.executeRun('VACUUM');
                } catch (vacuumError) {
                    debug.error('Error during VACUUM:', vacuumError);
                    // Continue even if VACUUM fails, as the data is already cleared
                }

                // Step 4: Re-enable foreign keys
                debug.log('Re-enabling foreign keys');
                await this.executeRun('PRAGMA foreign_keys = ON');

                return {
                    success: true,
                    message: 'Database reset successfully',
                    details: `Cleared ${deleteStatements.length} tables`
                };
            } catch (error) {
                // Re-enable foreign keys if transaction fails
                debug.error('Error during reset, re-enabling foreign keys');
                await this.executeRun('PRAGMA foreign_keys = ON');
                throw error;
            }
        } catch (error) {
            debug.error('Error resetting database:', error);

            // Final attempt to re-enable foreign keys
            try {
                await this.executeRun('PRAGMA foreign_keys = ON');
            } catch (pragmaError) {
                debug.error('Error re-enabling foreign keys:', pragmaError);
            }

            throw error;
        }
    }
}

module.exports = SettingsModel;
