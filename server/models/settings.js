const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');

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
}

module.exports = SettingsModel;
