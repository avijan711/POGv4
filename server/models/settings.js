const { initializeDatabase } = require('../config/database');
let db = null;

// Initialize database connection
(async () => {
    try {
        db = await initializeDatabase();
    } catch (err) {
        console.error('Failed to initialize database in settings model:', err);
    }
})();

class Settings {
    static async get(key) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('Database not initialized'));
                return;
            }
            const sql = 'SELECT SettingValue FROM Settings WHERE SettingKey = ?';
            db.get(sql, [key], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row ? row.SettingValue : null);
            });
        });
    }

    static async getAll() {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('Database not initialized'));
                return;
            }
            const sql = 'SELECT SettingKey, SettingValue FROM Settings';
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                const settings = {};
                rows.forEach(row => {
                    settings[row.SettingKey] = row.SettingValue;
                });
                resolve(settings);
            });
        });
    }

    static async set(key, value) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('Database not initialized'));
                return;
            }
            const sql = `
                INSERT INTO Settings (SettingKey, SettingValue, LastUpdated)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(SettingKey) DO UPDATE SET 
                    SettingValue = excluded.SettingValue,
                    LastUpdated = CURRENT_TIMESTAMP
            `;
            db.run(sql, [key, value], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(true);
            });
        });
    }
}

module.exports = Settings;
