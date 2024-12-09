const express = require('express');
const debug = require('../utils/debug');
const { DatabaseAccessLayer } = require('../config/database');

function createSettingsRouter({ db }) {
    const router = express.Router();
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);

    // Get all settings
    router.get('/', async (req, res) => {
        try {
            const sql = 'SELECT * FROM settings';
            const settings = await dal.executeQuery(sql);
            
            // Convert to key-value object
            const settingsObject = settings.reduce((acc, setting) => {
                acc[setting.key] = {
                    value: setting.value,
                    description: setting.description,
                    updatedAt: setting.updated_at
                };
                return acc;
            }, {});

            res.json(settingsObject);
        } catch (err) {
            debug.error('Error fetching settings:', err);
            res.status(500).json({
                error: 'Failed to fetch settings',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get specific setting
    router.get('/:key', async (req, res) => {
        try {
            const sql = 'SELECT * FROM settings WHERE key = ?';
            const [setting] = await dal.executeQuery(sql, [req.params.key]);

            if (!setting) {
                return res.status(404).json({
                    error: 'Setting not found',
                    details: `No setting exists with key: ${req.params.key}`,
                    suggestion: 'Please verify the setting key'
                });
            }

            res.json({
                value: setting.value,
                description: setting.description,
                updatedAt: setting.updated_at
            });
        } catch (err) {
            debug.error('Error fetching setting:', err);
            res.status(500).json({
                error: 'Failed to fetch setting',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Update setting
    router.put('/:key', async (req, res) => {
        try {
            const { value, description } = req.body;

            if (value === undefined) {
                return res.status(400).json({
                    error: 'Missing value',
                    details: 'Value is required',
                    suggestion: 'Please provide a value for the setting'
                });
            }

            // Validate EUR/ILS rate if updating that setting
            if (req.params.key === 'eur_ils_rate') {
                const rate = parseFloat(value);
                if (isNaN(rate) || rate <= 0) {
                    return res.status(400).json({
                        error: 'Invalid rate',
                        details: 'EUR/ILS rate must be a positive number',
                        suggestion: 'Please provide a valid exchange rate'
                    });
                }
            }

            const sql = `
                INSERT INTO settings (key, value, description)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    description = COALESCE(excluded.description, settings.description)
            `;

            await dal.executeRun(sql, [req.params.key, value.toString(), description]);

            // Get updated setting
            const [setting] = await dal.executeQuery(
                'SELECT * FROM settings WHERE key = ?',
                [req.params.key]
            );

            res.json({
                message: 'Setting updated successfully',
                setting: {
                    value: setting.value,
                    description: setting.description,
                    updatedAt: setting.updated_at
                }
            });
        } catch (err) {
            debug.error('Error updating setting:', err);
            res.status(500).json({
                error: 'Failed to update setting',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    return router;
}

module.exports = createSettingsRouter;
