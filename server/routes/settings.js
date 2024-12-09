const express = require('express');
const debug = require('../utils/debug');
const SettingsModel = require('../models/settings');
const { DatabaseAccessLayer } = require('../config/database');

function createSettingsRouter({ db }) {
    const router = express.Router();
    const settingsModel = new SettingsModel(db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db));

    // Get all settings
    router.get('/', async (req, res) => {
        try {
            const settings = await settingsModel.getAllSettings();
            
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
            const setting = await settingsModel.getSetting(req.params.key);

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

            const setting = await settingsModel.updateSetting(req.params.key, value, description);

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

    // Reset database
    router.post('/reset', async (req, res) => {
        try {
            debug.log('Starting database reset...');
            const result = await settingsModel.resetDatabase();
            
            if (result.success) {
                debug.log('Database reset completed successfully');
                res.json({
                    success: true,
                    message: 'Database reset successfully',
                    details: 'All data has been cleared and tables have been reinitialized'
                });
            } else {
                throw new Error('Database reset failed');
            }
        } catch (err) {
            debug.error('Error resetting database:', err);
            
            // Determine if this is a known error type
            const isTransactionError = err.name === 'TransactionError';
            const isDatabaseError = err.name === 'DatabaseError';
            
            res.status(500).json({
                error: 'Failed to reset database',
                details: err.message,
                type: isTransactionError ? 'TRANSACTION_ERROR' : 
                      isDatabaseError ? 'DATABASE_ERROR' : 'UNKNOWN_ERROR',
                suggestion: isTransactionError ? 'Database transaction failed, please try again' :
                           isDatabaseError ? 'Database operation failed, please check the logs' :
                           'Please try again or contact support if the issue persists'
            });
        }
    });

    return router;
}

module.exports = createSettingsRouter;
