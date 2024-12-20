const BaseModel = require('./BaseModel');
const { 
    getReplacementsQuery, 
    debugItemReferencesQuery,
    checkInquiryExistsQuery 
} = require('./queries/replacements');
const { 
    getBestSupplierPricesQuery,
    debugInquiryItemsQuery,
    debugSupplierPricesQuery,
    debugItemReferencesQuery: debugPriceReferencesQuery
} = require('./queries/supplierPrices');
const { 
    getAllOrdersQuery,
    getOrderByIdQuery,
    createOrderQuery,
    createOrderItemQuery,
    updateInquiryStatusQuery,
    updateOrderStatusQuery
} = require('./queries/orders');
const {
    createFulfillmentQuery,
    getFulfillmentsByOrderQuery,
    getFulfillmentsByOrderItemQuery,
    getOrderFulfillmentStatusQuery,
    validateOrderItemQuery
} = require('./queries/orders/fulfillment-queries');
const InquiryModel = require('./inquiry');
const debug = require('../utils/debug');

class OrderModel extends BaseModel {
    constructor(db) {
        super(db);
        this.inquiryModel = new InquiryModel(db);
    }

    async getBestSupplierPrices(inquiryId) {
        debug.log('Getting best supplier prices for inquiry:', inquiryId);

        try {
            // First check if the inquiry exists using InquiryModel
            const inquiry = await this.inquiryModel.getInquiryById(inquiryId);
            if (!inquiry) {
                debug.log('Inquiry not found:', inquiryId);
                throw new Error('Inquiry not found');
            }

            debug.log('Found inquiry, getting best prices');

            // Debug log the query parameters
            debug.log('Query parameters:', { inquiryId });

            // Get best prices - pass inquiryId three times:
            // 1. For inquiry_items CTE
            // 2. For supplier_responses CTE
            // 3. For active_promotions mapping in UNION ALL
            const prices = await this.executeQuery(getBestSupplierPricesQuery, [inquiryId, inquiryId, inquiryId]);
            
            debug.log('Best prices query returned:', {
                count: prices.length,
                sample: prices.length > 0 ? {
                    ItemID: prices[0].ItemID,
                    SupplierID: prices[0].SupplierID,
                    PriceQuoted: prices[0].PriceQuoted,
                    IsPromotion: prices[0].IsPromotion,
                    PromotionName: prices[0].PromotionName
                } : null
            });

            return prices;
        } catch (error) {
            debug.error('Error in getBestSupplierPrices:', error);
            throw error;
        }
    }

    async getReplacements(inquiryId) {
        debug.log('Getting replacements for inquiry:', inquiryId);

        try {
            // First check if the inquiry exists using InquiryModel
            const inquiry = await this.inquiryModel.getInquiryById(inquiryId);
            if (!inquiry) {
                debug.log('Inquiry not found:', inquiryId);
                throw new Error('Inquiry not found');
            }

            debug.log('Found inquiry, getting replacements');

            // Get replacements
            const rows = await this.executeQuery(getReplacementsQuery, [inquiryId]);

            // Convert to map
            const replacementsMap = {};
            rows.forEach(row => {
                if (row.originalItemId && row.newItemId) {
                    replacementsMap[row.originalItemId] = {
                        newItemId: row.newItemId,
                        source: row.source,
                        supplierName: row.supplierName,
                        description: row.description,
                        changeDate: row.changeDate,
                        originalDescription: row.originalDescription,
                        newDescription: row.newDescription,
                        inquiryDescription: row.inquiryDescription
                    };
                }
            });

            debug.log('Replacements found:', {
                count: Object.keys(replacementsMap).length,
                sample: Object.keys(replacementsMap).length > 0 ? 
                    replacementsMap[Object.keys(replacementsMap)[0]] : null
            });

            return replacementsMap;
        } catch (error) {
            debug.error('Error in getReplacements:', error);
            throw error;
        }
    }

    async getAllOrders() {
        try {
            const orders = await this.executeQuery(getAllOrdersQuery);
            return orders.map(order => ({
                ...order,
                Items: JSON.parse(order.Items)
            }));
        } catch (error) {
            debug.error('Error in getAllOrders:', error);
            throw error;
        }
    }

    async getOrderById(orderId) {
        try {
            const order = await this.executeQuerySingle(getOrderByIdQuery, [orderId]);
            if (!order) {
                throw new Error('Order not found');
            }
            order.Items = JSON.parse(order.Items);
            return order;
        } catch (error) {
            debug.error('Error in getOrderById:', error);
            throw error;
        }
    }

    async createOrder(data) {
        try {
            return await this.executeTransaction(async () => {
                // Create order
                const orderResult = await this.executeRun(
                    'INSERT INTO "Order" (SupplierID, Status) VALUES (?, ?)',
                    [data.supplierId, 'Pending']
                );
                const orderId = orderResult.lastID;

                // Create order items
                for (const item of data.items) {
                    await this.executeRun(
                        `INSERT INTO OrderItem (
                            OrderID, ItemID, Quantity, PriceQuoted, 
                            IsPromotion, PromotionGroupID
                        ) VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            orderId,
                            item.itemId,
                            item.quantity,
                            item.priceQuoted,
                            item.isPromotion ? 1 : 0,
                            item.promotionGroupId || null
                        ]
                    );
                }

                // Return created order
                return await this.getOrderById(orderId);
            });
        } catch (error) {
            debug.error('Error in createOrder:', error);
            throw error;
        }
    }

    async updateOrderStatus(orderId, status, notes = null) {
        try {
            const query = notes ? updateOrderStatusQuery.withNotes : updateOrderStatusQuery.withoutNotes;
            const params = notes ? [status, notes, orderId] : [status, orderId];
            const result = await this.executeRun(query, params);
            if (result.changes === 0) {
                throw new Error('Order not found');
            }
            return { updated: true };
        } catch (error) {
            debug.error('Error in updateOrderStatus:', error);
            throw error;
        }
    }

    async createOrdersFromInquiry(inquiryId) {
        try {
            return await this.executeTransaction(async () => {
                // Get best prices for each item
                const items = await this.getBestSupplierPrices(inquiryId);
                
                // Group items by supplier
                const supplierGroups = this._groupItemsByBestPrice(items);
                
                // Create orders for each supplier group
                const orderIds = [];
                for (const [supplierId, items] of Object.entries(supplierGroups)) {
                    const result = await this.executeRun(createOrderQuery, [inquiryId, supplierId, 'Pending']);
                    const orderId = result.lastID;
                    orderIds.push(orderId);

                    // Create order items
                    for (const item of items) {
                        const query = item.IsPromotion ? 
                            createOrderItemQuery.promotion : 
                            createOrderItemQuery.regular;

                        const params = item.IsPromotion ?
                            [orderId, item.ItemID, item.InquiryItemID, item.RequestedQty, item.PriceQuoted, 1, item.PromotionGroupID] :
                            [orderId, item.ItemID, item.InquiryItemID, item.RequestedQty, item.PriceQuoted, item.ItemID, supplierId];

                        await this.executeRun(query, params);
                    }
                }

                // Update inquiry status
                await this.executeRun(updateInquiryStatusQuery, ['Ordered', inquiryId]);

                return orderIds;
            });
        } catch (error) {
            debug.error('Error in createOrdersFromInquiry:', error);
            throw error;
        }
    }

    // New methods for order fulfillment

    async createFulfillment(orderId, orderItemId, quantitySupplied, notes = null) {
        try {
            return await this.executeTransaction(async () => {
                // Validate order item
                const orderItem = await this.executeQuerySingle(
                    validateOrderItemQuery,
                    [orderItemId, orderId]
                );

                if (!orderItem) {
                    throw new Error('Order item not found');
                }

                if (orderItem.order_status === 'cancelled') {
                    throw new Error('Cannot fulfill cancelled order');
                }

                const newSuppliedTotal = orderItem.supplied_quantity + quantitySupplied;
                if (newSuppliedTotal > orderItem.quantity) {
                    throw new Error('Cannot supply more than ordered quantity');
                }

                // Create fulfillment record
                await this.executeRun(
                    createFulfillmentQuery,
                    [orderId, orderItemId, quantitySupplied, notes]
                );

                // Get updated fulfillment status
                return await this.getOrderFulfillmentStatus(orderId);
            });
        } catch (error) {
            debug.error('Error in createFulfillment:', error);
            throw error;
        }
    }

    async getFulfillmentsByOrder(orderId) {
        try {
            const fulfillments = await this.executeQuery(
                getFulfillmentsByOrderQuery,
                [orderId]
            );
            return fulfillments;
        } catch (error) {
            debug.error('Error in getFulfillmentsByOrder:', error);
            throw error;
        }
    }

    async getFulfillmentsByOrderItem(orderItemId) {
        try {
            const fulfillments = await this.executeQuery(
                getFulfillmentsByOrderItemQuery,
                [orderItemId]
            );
            return fulfillments;
        } catch (error) {
            debug.error('Error in getFulfillmentsByOrderItem:', error);
            throw error;
        }
    }

    async getOrderFulfillmentStatus(orderId) {
        try {
            const status = await this.executeQuery(
                getOrderFulfillmentStatusQuery,
                [orderId]
            );

            // Parse fulfillment history JSON for each item
            return status.map(item => ({
                ...item,
                fulfillment_history: JSON.parse(item.fulfillment_history || '[]')
            }));
        } catch (error) {
            debug.error('Error in getOrderFulfillmentStatus:', error);
            throw error;
        }
    }

    _groupItemsByBestPrice(items) {
        // First get best price for each item
        const bestPrices = items.reduce((acc, item) => {
            if (!acc[item.ItemID] || item.PriceQuoted < acc[item.ItemID].PriceQuoted) {
                acc[item.ItemID] = item;
            }
            return acc;
        }, {});

        // Then group by supplier
        return Object.values(bestPrices).reduce((groups, item) => {
            if (!groups[item.SupplierID]) {
                groups[item.SupplierID] = [];
            }
            groups[item.SupplierID].push(item);
            return groups;
        }, {});
    }
}

module.exports = OrderModel;
