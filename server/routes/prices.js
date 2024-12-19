const express = require('express');
const debug = require('../utils/debug');
const PriceHistoryService = require('../services/priceHistoryService');

function createRouter({ db }) {
    if (!db) {
        throw new Error('Database instance is required');
    }

    const router = express.Router();
    const priceHistoryService = new PriceHistoryService(db);

    // Get price history for an item from a supplier
    router.get('/history/:itemId/:supplierId', async (req, res, next) => {
        try {
            const { itemId, supplierId } = req.params;
            const { start_date, end_date } = req.query;

            const dateRange = start_date && end_date ? { start: start_date, end: end_date } : null;

            debug.log('Fetching price history:', {
                itemId,
                supplierId,
                dateRange
            });

            const history = await priceHistoryService.getPriceHistory(
                itemId,
                supplierId,
                dateRange
            );

            res.json(history);
        } catch (error) {
            debug.error('Error fetching price history:', error);
            next(error);
        }
    });

    // Get current price for an item from a supplier
    router.get('/current/:itemId/:supplierId', async (req, res, next) => {
        try {
            const { itemId, supplierId } = req.params;

            debug.log('Fetching current price:', {
                itemId,
                supplierId
            });

            const price = await priceHistoryService.getCurrentPrice(
                itemId,
                supplierId
            );

            if (!price) {
                return res.status(404).json({
                    error: 'Price not found',
                    message: 'No current price found for this item and supplier'
                });
            }

            res.json(price);
        } catch (error) {
            debug.error('Error fetching current price:', error);
            next(error);
        }
    });

    // Get price list for a supplier
    router.get('/list/:supplierId', async (req, res, next) => {
        try {
            const { supplierId } = req.params;
            const includePromotions = req.query.include_promotions !== 'false';

            debug.log('Fetching supplier price list:', {
                supplierId,
                includePromotions
            });

            const priceList = await priceHistoryService.getSupplierPriceList(
                supplierId,
                includePromotions
            );

            res.json(priceList);
        } catch (error) {
            debug.error('Error fetching supplier price list:', error);
            next(error);
        }
    });

    // Update prices for multiple items
    router.post('/update/:supplierId', async (req, res, next) => {
        try {
            const { supplierId } = req.params;
            const { items, source_type, source_id } = req.body;

            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Items array is required and must not be empty'
                });
            }

            if (!source_type || !['inquiry', 'promotion', 'manual'].includes(source_type)) {
                return res.status(400).json({
                    error: 'Invalid source type',
                    message: 'Source type must be one of: inquiry, promotion, manual'
                });
            }

            debug.log('Updating prices:', {
                supplierId,
                itemCount: items.length,
                sourceType: source_type,
                sourceId: source_id
            });

            const result = await priceHistoryService.updatePriceList(
                items,
                supplierId,
                source_type,
                source_id
            );

            res.json(result);
        } catch (error) {
            debug.error('Error updating prices:', error);
            next(error);
        }
    });

    // Cleanup expired promotions (can be called by a scheduled job)
    router.post('/cleanup-promotions', async (req, res, next) => {
        try {
            debug.log('Cleaning up expired promotions');

            const result = await priceHistoryService.cleanupExpiredPromotions();

            res.json({
                success: true,
                message: 'Expired promotions cleaned up successfully',
                updatedCount: result.changes
            });
        } catch (error) {
            debug.error('Error cleaning up promotions:', error);
            next(error);
        }
    });

    return router;
}

module.exports = createRouter;
