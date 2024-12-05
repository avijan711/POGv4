const express = require('express');
const debug = require('../utils/debug');
const SettingsModel = require('../models/settings');
const fs = require('fs');
const path = require('path');

function createRouter({ db }) {
    const router = express.Router();
    const settingsModel = new SettingsModel(db);

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
            // Read the clear_database.sql file
            const clearDbPath = path.join(__dirname, '..', 'migrations', 'clear_database.sql');
            const clearDbSql = fs.readFileSync(clearDbPath, 'utf8');

            // Step 1: Execute DELETE operations in a transaction
            await db.runAsync('BEGIN TRANSACTION');
            await db.execAsync(clearDbSql);
            await db.runAsync('COMMIT');

            // Step 2: Run VACUUM separately (outside transaction)
            await db.execAsync('VACUUM');

            // Step 3: Re-enable foreign keys
            await db.runAsync('PRAGMA foreign_keys = ON');

            debug.log('Successfully reset database');

            res.json({ 
                success: true, 
                message: 'Application reset successfully',
                details: 'Database cleared and vacuumed successfully'
            });
        } catch (error) {
            debug.error('Error resetting app:', error);
            
            try {
                // Attempt to rollback if we're in a transaction
                await db.runAsync('ROLLBACK');
                // Always ensure foreign keys are re-enabled
                await db.runAsync('PRAGMA foreign_keys = ON');
            } catch (rollbackError) {
                debug.error('Error during rollback:', rollbackError);
            }

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
