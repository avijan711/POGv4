const express = require('express');
const router = express.Router();
const Settings = require('../models/settings');
const { getDatabase } = require('../config/database');
const fs = require('fs');
const path = require('path');

// Get all settings
router.get('/', async (req, res) => {
    try {
        const settings = await Settings.getAll();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific setting
router.get('/:key', async (req, res) => {
    try {
        const value = await Settings.get(req.params.key);
        if (value === null) {
            res.status(404).json({ error: 'Setting not found' });
            return;
        }
        res.json({ [req.params.key]: value });
    } catch (error) {
        console.error('Error fetching setting:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update or create a setting
router.post('/', async (req, res) => {
    try {
        const { eurToIls } = req.body;
        
        if (eurToIls !== undefined) {
            await Settings.set('eurToIls', eurToIls.toString());
        }

        const updatedSettings = await Settings.getAll();
        res.json(updatedSettings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset application data
router.post('/reset', async (req, res) => {
    const db = getDatabase();
    try {
        // Read the clear_database.sql file
        const clearDbPath = path.join(__dirname, '..', 'migrations', 'clear_database.sql');
        const clearDbSql = fs.readFileSync(clearDbPath, 'utf8');

        // Execute the SQL script directly
        await new Promise((resolve, reject) => {
            db.exec(clearDbSql, (err) => {
                if (err) {
                    console.error('Error executing clear_database.sql:', err);
                    reject(err);
                } else {
                    console.log('Successfully executed clear_database.sql');
                    resolve();
                }
            });
        });

        res.json({ 
            success: true, 
            message: 'Application reset successfully',
            details: 'Database cleared and vacuumed successfully'
        });
    } catch (error) {
        // Rollback on error
        await new Promise((resolve, reject) => {
            db.run('ROLLBACK', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Re-enable foreign key constraints even on error
        await new Promise((resolve, reject) => {
            db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.error('Error resetting app:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error resetting application', 
            error: error.message 
        });
    }
});

module.exports = router;
