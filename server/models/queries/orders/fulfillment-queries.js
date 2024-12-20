// Queries for order fulfillment operations

const createFulfillmentQuery = `
    INSERT INTO order_fulfillment (
        order_id,
        order_item_id,
        quantity_supplied,
        notes
    ) VALUES (?, ?, ?, ?)
`;

const getFulfillmentsByOrderQuery = `
    SELECT 
        f.fulfillment_id,
        f.order_id,
        f.order_item_id,
        f.quantity_supplied,
        f.fulfillment_date,
        f.notes,
        oi.item_id,
        oi.quantity as ordered_quantity,
        oi.supplied_quantity,
        oi.remaining_quantity,
        oi.fulfillment_status,
        oi.price_quoted
    FROM order_fulfillment f
    JOIN order_item oi ON f.order_item_id = oi.order_item_id
    WHERE f.order_id = ?
    ORDER BY f.fulfillment_date DESC
`;

const getFulfillmentsByOrderItemQuery = `
    SELECT 
        f.fulfillment_id,
        f.quantity_supplied,
        f.fulfillment_date,
        f.notes
    FROM order_fulfillment f
    WHERE f.order_item_id = ?
    ORDER BY f.fulfillment_date DESC
`;

const getOrderFulfillmentStatusQuery = `
    SELECT 
        o.order_id,
        o.supplier_id,
        o.status as order_status,
        oi.order_item_id,
        oi.item_id,
        oi.quantity as ordered_quantity,
        oi.supplied_quantity,
        oi.remaining_quantity,
        oi.fulfillment_status,
        oi.price_quoted,
        (
            SELECT json_group_array(
                json_object(
                    'fulfillment_id', f.fulfillment_id,
                    'quantity_supplied', f.quantity_supplied,
                    'fulfillment_date', f.fulfillment_date,
                    'notes', f.notes
                )
            )
            FROM order_fulfillment f
            WHERE f.order_item_id = oi.order_item_id
            ORDER BY f.fulfillment_date DESC
        ) as fulfillment_history
    FROM "order" o
    JOIN order_item oi ON o.order_id = oi.order_id
    WHERE o.order_id = ?
`;

const validateOrderItemQuery = `
    SELECT 
        oi.order_item_id,
        oi.quantity,
        oi.supplied_quantity,
        oi.remaining_quantity,
        o.status as order_status
    FROM order_item oi
    JOIN "order" o ON oi.order_id = o.order_id
    WHERE oi.order_item_id = ? AND o.order_id = ?
`;

module.exports = {
    createFulfillmentQuery,
    getFulfillmentsByOrderQuery,
    getFulfillmentsByOrderItemQuery,
    getOrderFulfillmentStatusQuery,
    validateOrderItemQuery
};
