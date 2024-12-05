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

class OrderModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async getBestSupplierPrices(inquiryId) {
        // First check if the inquiry exists
        const inquiry = await this.executeQuerySingle(checkInquiryExistsQuery, [inquiryId]);
        if (!inquiry) {
            throw new Error('Inquiry not found');
        }

        // Get best prices
        return await this.executeQuery(getBestSupplierPricesQuery, [inquiryId]);
    }

    async getReplacements(inquiryId) {
        // First check if the inquiry exists
        const inquiry = await this.executeQuerySingle(checkInquiryExistsQuery, [inquiryId]);
        if (!inquiry) {
            throw new Error('Inquiry not found');
        }

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

        return replacementsMap;
    }

    async getAllOrders() {
        const orders = await this.executeQuery(getAllOrdersQuery);
        return orders.map(order => ({
            ...order,
            Items: JSON.parse(order.Items)
        }));
    }

    async getOrderById(orderId) {
        const order = await this.executeQuerySingle(getOrderByIdQuery, [orderId]);
        if (!order) {
            throw new Error('Order not found');
        }
        order.Items = JSON.parse(order.Items);
        return order;
    }

    async createOrder(data) {
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
    }

    async updateOrderStatus(orderId, status, notes = null) {
        const query = notes ? updateOrderStatusQuery.withNotes : updateOrderStatusQuery.withoutNotes;
        const params = notes ? [status, notes, orderId] : [status, orderId];
        const result = await this.executeRun(query, params);
        if (result.changes === 0) {
            throw new Error('Order not found');
        }
        return { updated: true };
    }

    async createOrdersFromInquiry(inquiryId) {
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
