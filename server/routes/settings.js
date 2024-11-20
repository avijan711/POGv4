const express = require('express');
const router = express.Router();
const Settings = require('../models/settings');
const { getDatabase } = require('../config/database');

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
        // Begin transaction
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Define tables in order of dependency (children first, then parents)
        const tables = [
            'OrderItem',           // Child of Order, Item, InquiryItem
            '"Order"',             // Child of Inquiry, Supplier
            'promotion_items',     // Child of promotions, Item
            'promotions',          // Child of Supplier
            'SupplierResponseItem', // Child of SupplierResponse, Item
            'SupplierResponse',    // Child of Inquiry, Supplier, Item
            'InquiryItem',         // Child of Inquiry, Item
            'Inquiry',             // Base table
            'ItemHistory',         // Child of Item
            'ItemReferenceChange', // Child of Item, Supplier
            'SupplierPrice',       // Child of Item, Supplier
            'Supplier',            // Base table
            'Item'                 // Base table
        ];

        // Delete data from each table
        for (const table of tables) {
            try {
                await new Promise((resolve, reject) => {
                    const query = `DELETE FROM ${table}`;
                    console.log(`Executing: ${query}`);
                    db.run(query, (err) => {
                        if (err) {
                            console.error(`Error deleting from ${table}:`, err);
                            reject(err);
                        } else {
                            console.log(`Successfully cleared table: ${table}`);
                            resolve();
                        }
                    });
                });
            } catch (error) {
                if (!error.message.includes('no such table')) {
                    throw error;
                } else {
                    console.log(`Table ${table} does not exist, skipping...`);
                }
            }
        }

        // Reset auto-increment counters if sqlite_sequence exists
        try {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM sqlite_sequence', (err) => {
                    if (err && !err.message.includes('no such table')) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.log('No sqlite_sequence table found, skipping...');
        }

        // Commit transaction
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ 
            success: true, 
            message: 'Application reset successfully',
            details: `Cleared ${tables.length} tables in the correct dependency order`
        });
    } catch (error) {
        // Rollback on error
        await new Promise((resolve, reject) => {
            db.run('ROLLBACK', (err) => {
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
