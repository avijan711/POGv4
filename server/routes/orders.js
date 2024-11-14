const express = require('express');
const router = express.Router();

module.exports = (orderModel) => {
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
            res.status(500).json({ error: error.message });
        }
    });

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

            // Debug output
            console.log('=== Response data analysis ===');
            console.log('Total items:', prices.length);
            console.log('Unique suppliers:', new Set(prices.map(p => p.SupplierName)));
            console.log('Items with promotions:', prices.filter(p => p.IsPromotion).length);
            console.log('Unique promotion groups:', new Set(prices.filter(p => p.IsPromotion).map(p => p.PromotionName)));
            
            // Sample data for each type
            const regularPrice = prices.find(p => !p.IsPromotion);
            const promoPrice = prices.find(p => p.IsPromotion);
            console.log('=== Sample regular price ===', regularPrice);
            console.log('=== Sample promotion price ===', promoPrice);

            // Price analysis
            const pricesByItem = prices.reduce((acc, p) => {
                if (!acc[p.ItemID]) acc[p.ItemID] = [];
                acc[p.ItemID].push({
                    supplier: p.SupplierName,
                    price: p.PriceQuoted,
                    isPromo: p.IsPromotion,
                    promoName: p.PromotionName
                });
                return acc;
            }, {});

            console.log('=== Price comparison by item ===');
            Object.entries(pricesByItem).forEach(([itemId, prices]) => {
                console.log(`Item ${itemId}:`, prices);
            });

            res.json(prices);
        } catch (error) {
            console.error('Error getting best prices:', error);
            res.status(500).json({ error: error.message });
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
            res.status(500).json({ error: error.message });
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
            console.error('Error getting order:', error);
            if (error.message === 'Order not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
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
                res.status(500).json({ error: error.message });
            }
        }
    });

    return router;
};
