const express = require('express');
const debug = require('../utils/debug');
const SettingsModel = require('../models/settings');
const { DatabaseAccessLayer } = require('../config/database');

function createRouter({ db }) {
    const router = express.Router();
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    const settingsModel = new SettingsModel(dal);

    // Get all settings
    router.get('/', async (req, res) => {
        try {
            const settings = await settingsModel.getAll();
            res.json(settings);
        } catch (error) {
            debug.error('Error fetching settings:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Get a specific setting
    router.get('/:key', async (req, res) => {
        try {
            const value = await settingsModel.get(req.params.key);
            if (value === null) {
                res.status(404).json({ error: 'Setting not found' });
                return;
            }
            res.json({ [req.params.key]: value });
        } catch (error) {
            debug.error('Error fetching setting:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Update or create a setting
    router.post('/', async (req, res) => {
        try {
            const { eurToIls } = req.body;
            
            if (eurToIls !== undefined) {
                await settingsModel.set('eurToIls', eurToIls.toString());
            }

            const updatedSettings = await settingsModel.getAll();
            res.json(updatedSettings);
        } catch (error) {
            debug.error('Error updating settings:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Reset application data
    router.post('/reset', async (req, res) => {
        try {
            const result = await settingsModel.resetDatabase();
            res.json(result);
        } catch (error) {
            debug.error('Error resetting app:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error resetting application', 
                error: error.message 
            });
        }
    });

    return router;
}

module.exports = createRouter;
