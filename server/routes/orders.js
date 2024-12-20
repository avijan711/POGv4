const express = require('express');
const router = express.Router();
const debug = require('../utils/debug');

module.exports = (orderModel) => {
    /**
     * Get best supplier prices for an inquiry
     * GET /api/orders/best-prices/:inquiryId
     */
    router.get('/best-prices/:inquiryId', async (req, res) => {
        try {
            const inquiryId = parseInt(req.params.inquiryId);
            if (isNaN(inquiryId)) {
                return res.status(400).json({ error: 'Invalid inquiry ID' });
            }

            debug.log('=== Getting best prices for inquiry:', inquiryId);
            
            // Debug log the SQL query
            debug.log('Executing getBestSupplierPrices with inquiryId:', inquiryId);
            
            const prices = await orderModel.getBestSupplierPrices(inquiryId);
            
            // Debug log the results with focus on promotion data
            debug.log('Best prices query returned:', {
                count: prices.length,
                regularPrices: prices.filter(p => !p.IsPromotion).length,
                promotionalPrices: prices.filter(p => p.IsPromotion).length,
                promotions: [...new Set(prices.filter(p => p.IsPromotion).map(p => p.PromotionName))],
                sample: prices.length > 0 ? {
                    ItemID: prices[0].ItemID,
                    SupplierID: prices[0].SupplierID,
                    PriceQuoted: prices[0].PriceQuoted,
                    IsPromotion: prices[0].IsPromotion,
                    PromotionName: prices[0].PromotionName,
                    PromotionGroupID: prices[0].PromotionGroupID
                } : null
            });

            res.json(prices);
        } catch (error) {
            debug.error('Error getting best prices:', error);
            if (error.message === 'Inquiry not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ 
                    error: error.message,
                    details: 'Failed to get best prices'
                });
            }
        }
    });

    /**
     * Create a new order
     * POST /api/orders
     */
    router.post('/', async (req, res) => {
        try {
            const { supplierId, items } = req.body;

            if (!supplierId) {
                return res.status(400).json({ 
                    error: 'Missing supplier ID',
                    details: 'A supplier ID is required to create an order'
                });
            }

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ 
                    error: 'Invalid items',
                    details: 'At least one item is required to create an order'
                });
            }

            // Validate each item
            for (const item of items) {
                if (!item.itemId || !item.quantity || !item.priceQuoted) {
                    return res.status(400).json({ 
                        error: 'Invalid item data',
                        details: 'Each item must have an itemId, quantity, and priceQuoted'
                    });
                }
            }

            const order = await orderModel.createOrder({
                supplierId,
                items: items.map(item => ({
                    itemId: item.itemId,
                    quantity: parseInt(item.quantity),
                    priceQuoted: parseFloat(item.priceQuoted),
                    isPromotion: item.isPromotion || false,
                    promotionGroupId: item.promotionGroupId
                }))
            });

            res.status(201).json(order);
        } catch (error) {
            debug.error('Error creating order:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to create order'
            });
        }
    });

    /**
     * Create orders from an inquiry
     * POST /api/orders/from-inquiry/:inquiryId
     */
    router.post('/from-inquiry/:inquiryId', async (req, res) => {
        try {
            const inquiryId = parseInt(req.params.inquiryId);
            if (isNaN(inquiryId)) {
                return res.status(400).json({ error: 'Invalid inquiry ID' });
            }

            const orderIds = await orderModel.createOrdersFromInquiry(inquiryId);
            res.json({ 
                message: 'Orders created successfully', 
                orderIds 
            });
        } catch (error) {
            debug.error('Error creating orders:', error);
            if (error.message === 'Inquiry not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ 
                    error: error.message,
                    details: 'Failed to create orders'
                });
            }
        }
    });

    /**
     * Get all orders
     * GET /api/orders
     */
    router.get('/', async (req, res) => {
        try {
            const orders = await orderModel.getAllOrders();
            res.json(orders);
        } catch (error) {
            debug.error('Error getting orders:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to get orders'
            });
        }
    });

    /**
     * Update order status
     * PUT /api/orders/:orderId/status
     */
    router.put('/:orderId/status', async (req, res) => {
        try {
            const orderId = parseInt(req.params.orderId);
            if (isNaN(orderId)) {
                return res.status(400).json({ error: 'Invalid order ID' });
            }

            const { status, notes } = req.body;
            if (!status) {
                return res.status(400).json({ error: 'Status is required' });
            }

            await orderModel.updateOrderStatus(orderId, status, notes);
            res.json({ message: 'Order status updated successfully' });
        } catch (error) {
            debug.error('Error updating order status:', error);
            if (error.message === 'Order not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ 
                    error: error.message,
                    details: 'Failed to update order status'
                });
            }
        }
    });

    /**
     * Create a fulfillment record for an order item
     * POST /api/orders/:orderId/items/:orderItemId/fulfillments
     */
    router.post('/:orderId/items/:orderItemId/fulfillments', async (req, res) => {
        try {
            const orderId = parseInt(req.params.orderId);
            const orderItemId = parseInt(req.params.orderItemId);
            const { quantitySupplied, notes } = req.body;

            if (isNaN(orderId) || isNaN(orderItemId)) {
                return res.status(400).json({ error: 'Invalid order ID or order item ID' });
            }

            if (!quantitySupplied || isNaN(quantitySupplied) || quantitySupplied <= 0) {
                return res.status(400).json({ 
                    error: 'Invalid quantity',
                    details: 'Quantity supplied must be a positive number'
                });
            }

            const result = await orderModel.createFulfillment(
                orderId,
                orderItemId,
                quantitySupplied,
                notes
            );

            res.status(201).json(result);
        } catch (error) {
            debug.error('Error creating fulfillment:', error);
            if (error.message.includes('Cannot supply more than')) {
                res.status(400).json({ error: error.message });
            } else if (error.message === 'Order item not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ 
                    error: error.message,
                    details: 'Failed to create fulfillment'
                });
            }
        }
    });

    /**
     * Get fulfillment history for an order
     * GET /api/orders/:orderId/fulfillments
     */
    router.get('/:orderId/fulfillments', async (req, res) => {
        try {
            const orderId = parseInt(req.params.orderId);
            if (isNaN(orderId)) {
                return res.status(400).json({ error: 'Invalid order ID' });
            }

            const fulfillments = await orderModel.getFulfillmentsByOrder(orderId);
            res.json(fulfillments);
        } catch (error) {
            debug.error('Error getting fulfillments:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to get fulfillments'
            });
        }
    });

    /**
     * Get fulfillment status for an order
     * GET /api/orders/:orderId/fulfillment-status
     */
    router.get('/:orderId/fulfillment-status', async (req, res) => {
        try {
            const orderId = parseInt(req.params.orderId);
            if (isNaN(orderId)) {
                return res.status(400).json({ error: 'Invalid order ID' });
            }

            const status = await orderModel.getOrderFulfillmentStatus(orderId);
            res.json(status);
        } catch (error) {
            debug.error('Error getting fulfillment status:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to get fulfillment status'
            });
        }
    });

    /**
     * Get a specific order
     * GET /api/orders/:orderId
     */
    router.get('/:orderId', async (req, res) => {
        try {
            const orderId = parseInt(req.params.orderId);
            if (isNaN(orderId)) {
                return res.status(400).json({ error: 'Invalid order ID' });
            }

            const order = await orderModel.getOrderById(orderId);
            res.json(order);
        } catch (error) {
            debug.error('Error getting order:', error);
            if (error.message === 'Order not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ 
                    error: error.message,
                    details: 'Failed to get order'
                });
            }
        }
    });

    return router;
};
