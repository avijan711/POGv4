const express = require('express');
const router = express.Router();

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

            console.log('=== Getting best prices for inquiry:', inquiryId);
            const prices = await orderModel.getBestSupplierPrices(inquiryId);
            res.json(prices);
        } catch (error) {
            console.error('Error getting best prices:', error);
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
            console.error('Error creating order:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to create order'
            });
        }
    });

    /**
     * Get replacements for an inquiry
     * GET /api/orders/:inquiryId/replacements
     */
    router.get('/:inquiryId/replacements', async (req, res) => {
        try {
            const inquiryId = parseInt(req.params.inquiryId);
            if (isNaN(inquiryId)) {
                return res.status(400).json({ error: 'Invalid inquiry ID' });
            }

            console.log('=== Getting replacements for inquiry:', inquiryId);
            const replacementsMap = await orderModel.getReplacements(inquiryId);
            
            // Convert map to array for API response
            const replacements = Object.entries(replacementsMap).map(([originalItemId, replacement]) => ({
                originalItemId,
                newItemId: replacement.newItemId,
                source: replacement.source,
                supplierName: replacement.supplierName,
                description: replacement.description,
                changeDate: replacement.changeDate,
                originalDescription: replacement.originalDescription,
                newDescription: replacement.newDescription,
                inquiryDescription: replacement.inquiryDescription
            }));

            // Debug log
            console.log('=== Replacements response ===');
            console.log('Total replacements:', replacements.length);
            if (replacements.length > 0) {
                console.log('Sample replacement:', replacements[0]);
            }

            // Return empty array if no replacements found
            res.json(replacements);
        } catch (error) {
            console.error('Error getting replacements:', error);
            
            if (error.message === 'Inquiry not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ 
                    error: error.message,
                    details: 'Failed to get replacements'
                });
            }
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
            console.error('Error creating orders:', error);
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
            console.error('Error getting orders:', error);
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
            console.error('Error updating order status:', error);
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
     * Get a specific order
     * GET /api/orders/:orderId
     * NOTE: This must be the last route to avoid conflicts with other routes
     */
    router.get('/:orderId', async (req, res) => {
        try {
            // Skip if this is a replacements request
            if (req.path.endsWith('/replacements')) {
                return next();
            }

            const orderId = parseInt(req.params.orderId);
            if (isNaN(orderId)) {
                return res.status(400).json({ error: 'Invalid order ID' });
            }

            const order = await orderModel.getOrderById(orderId);
            res.json(order);
        } catch (error) {
            console.error('Error getting order:', error);
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
