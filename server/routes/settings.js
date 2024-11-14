const express = require('express');
const router = express.Router();
const Settings = require('../models/settings');

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

module.exports = router;
