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
      const settings = await this.executeQuery(sql);
      
      // Convert numeric values to numbers
      return settings.map(setting => {
        if (setting && !isNaN(setting.value)) {
          const newSetting = Object.assign({}, setting);
          newSetting.value = parseFloat(setting.value);
          return newSetting;
        }
        return setting;
      });
    } catch (err) {
      console.error('Error fetching settings:', err);
      throw err;
    }
  }

  async getSetting(key) {
    try {
      let sql;
      let params;

      if (key === 'debug') {
        // Use json_extract to get debug settings as proper JSON
        sql = `
          SELECT
            key,
            json_object(
              'general', CAST(json_extract(value, '$.general') AS BOOLEAN),
              'errors', CAST(json_extract(value, '$.errors') AS BOOLEAN),
              'database', CAST(json_extract(value, '$.database') AS BOOLEAN),
              'performance', CAST(json_extract(value, '$.performance') AS BOOLEAN),
              'routes', CAST(json_extract(value, '$.routes') AS BOOLEAN),
              'middleware', CAST(json_extract(value, '$.middleware') AS BOOLEAN)
            ) as value,
            description,
            updated_at
          FROM settings
          WHERE key = ?
        `;
      } else {
        sql = 'SELECT * FROM settings WHERE key = ?';
      }
      
      params = [key];
      const setting = await this.executeQuerySingle(sql, params);
            
      if (key === 'debug' && setting) {
        // Parse JSON, validate and convert to proper boolean values
        const debugSettings = JSON.parse(setting.value);
        const validatedSettings = this.validateDebugSettings(debugSettings);
        debug.updateSettings(validatedSettings);
        setting.value = JSON.stringify(validatedSettings);
      }
            
      return setting;
    } catch (err) {
      console.error('Error fetching setting:', err);
      throw err;
    }
  }

  validateDebugSettings(settings) {
    const requiredKeys = ['general', 'errors', 'database', 'performance', 'routes', 'middleware'];
    const missingKeys = requiredKeys.filter(key => settings[key] === undefined);
    
    if (missingKeys.length > 0) {
      throw new Error(`Invalid debug settings: missing required keys: ${missingKeys.join(', ')}`);
    }

    // Convert values to boolean and validate
    const convertedSettings = {};
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'boolean') {
        convertedSettings[key] = value;
      } else if (value === 1 || value === 0 || value === '1' || value === '0') {
        convertedSettings[key] = Boolean(Number(value));
      } else if (value === 'true' || value === 'false') {
        convertedSettings[key] = value === 'true';
      } else {
        throw new Error(`Invalid debug settings: ${key} must be a boolean, 0/1, or "true"/"false"`);
      }
    }

    return convertedSettings;
  }

  async updateSetting(key, value, description = null) {
    try {
      let sql;
      let params;

      if (key === 'debug') {
        // Parse value if it's a string
        const settings = typeof value === 'string' ? JSON.parse(value) : value;
        
        // Validate debug settings
        this.validateDebugSettings(settings);

        // Use SQLite's json_object() function to store JSON
        // Convert settings to proper boolean values
        const validatedSettings = this.validateDebugSettings(settings);
        
        sql = `
          INSERT INTO settings (key, value, description)
          VALUES (?, json_object(
            'general', CAST(? AS BOOLEAN),
            'errors', CAST(? AS BOOLEAN),
            'database', CAST(? AS BOOLEAN),
            'performance', CAST(? AS BOOLEAN),
            'routes', CAST(? AS BOOLEAN),
            'middleware', CAST(? AS BOOLEAN)
          ), ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            description = COALESCE(excluded.description, settings.description),
            updated_at = CURRENT_TIMESTAMP
        `;
        
        params = [
          key,
          validatedSettings.general,
          validatedSettings.errors,
          validatedSettings.database,
          validatedSettings.performance,
          validatedSettings.routes,
          validatedSettings.middleware,
          description,
        ];

        // Update debug utility first
        debug.updateSettings(settings);
      } else {
        // Handle non-debug settings
        sql = `
          INSERT INTO settings (key, value, description)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            description = COALESCE(excluded.description, settings.description),
            updated_at = CURRENT_TIMESTAMP
        `;
        
        params = [
          key,
          typeof value === 'number' ? value.toString() : value.toString(),
          description,
        ];
      }

      await this.executeRun(sql, params);
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
          details: 'All data has been cleared while preserving settings',
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
