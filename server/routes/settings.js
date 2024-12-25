const express = require('express');
const Settings = require('../models/settings');
const debug = require('../utils/debug');

function createSettingsRouter({ db }) {
  const router = express.Router();
  const settingsModel = new Settings(db);

  // Get all settings
  router.get('/', async (req, res) => {
    try {
      const settings = await settingsModel.getAllSettings();
      res.json({ success: true, settings });
    } catch (err) {
      debug.error('Error fetching settings:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch settings', 
      });
    }
  });

  // Get debug settings
  router.get('/debug', async (req, res) => {
    try {
      const debugSettings = await settingsModel.getSetting('debug');
      res.json({ 
        success: true, 
        settings: debugSettings ? JSON.parse(debugSettings.value) : {
          general: true,
          errors: true,
          database: false,
          performance: false,
          routes: false,
          middleware: false,
        },
      });
    } catch (err) {
      debug.error('Error fetching debug settings:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch debug settings', 
      });
    }
  });

  // Update debug settings
  router.post('/debug', async (req, res) => {
    try {
      const { type, enabled } = req.body;
      if (!type) {
        return res.status(400).json({
          success: false,
          message: 'Debug type is required',
        });
      }

      // Validate input
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Debug enabled status must be a boolean',
          details: `Received: ${typeof enabled}`,
        });
      }

      // Validate debug type
      const validTypes = ['general', 'errors', 'database', 'performance', 'routes', 'middleware'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid debug type',
          details: `Must be one of: ${validTypes.join(', ')}`,
        });
      }

      // Get current settings
      const currentSettings = await settingsModel.getSetting('debug');
      if (!currentSettings) {
        return res.status(500).json({
          success: false,
          message: 'Debug settings not found',
          details: 'Unable to retrieve current debug settings',
        });
      }

      // Parse and update settings
      const settings = JSON.parse(currentSettings.value);
      settings[type] = enabled;

      // Save settings (model will handle JSON validation and storage)
      const updatedSetting = await settingsModel.updateSetting('debug', settings, 'Debug logging settings');

      res.json({
        success: true,
        settings: JSON.parse(updatedSetting.value),
        message: `Debug ${type} ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (err) {
      debug.error('Error updating debug settings:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update debug settings', 
      });
    }
  });

  // Update individual setting
  router.put('/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;

      if (value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Setting value is required',
        });
      }

      const setting = await settingsModel.updateSetting(key, value, description);
            
      res.json({
        success: true,
        setting,
      });
    } catch (err) {
      debug.error('Error updating setting:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to update setting',
      });
    }
  });

  // Reset database
  router.post('/reset', async (req, res) => {
    try {
      const result = await settingsModel.resetDatabase();
      res.json(result);
    } catch (err) {
      debug.error('Error resetting database:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to reset database',
        error: err.message,
      });
    }
  });

  return router;
}

module.exports = createSettingsRouter;
