const getAllOrdersQuery = `
    SELECT 
        o.OrderID,
        o.InquiryID,
        o.OrderDate,
        o.Status,
        o.Notes,
        s.SupplierID,
        s.Name as SupplierName,
        s.ContactPerson,
        s.Email,
        s.Phone,
        json_group_array(
            json_object(
                'orderItemId', oi.OrderItemID,
                'itemId', oi.ItemID,
                'quantity', oi.Quantity,
                'priceQuoted', oi.PriceQuoted,
                'hebrewDescription', i.HebrewDescription,
                'englishDescription', i.EnglishDescription,
                'isPromotion', oi.IsPromotion,
                'promotionGroupId', oi.PromotionGroupID
            )
        ) as Items
    FROM \`Order\` o
    JOIN Supplier s ON o.SupplierID = s.SupplierID
    JOIN OrderItem oi ON o.OrderID = oi.OrderID
    JOIN Item i ON oi.ItemID = i.ItemID
    GROUP BY o.OrderID
    ORDER BY o.OrderDate DESC
`;

const getOrderByIdQuery = `
    SELECT 
        o.OrderID,
        o.InquiryID,
        o.OrderDate,
        o.Status,
        o.Notes,
        s.SupplierID,
        s.Name as SupplierName,
        s.ContactPerson,
        s.Email,
        s.Phone,
        json_group_array(
            json_object(
                'orderItemId', oi.OrderItemID,
                'itemId', oi.ItemID,
                'quantity', oi.Quantity,
                'priceQuoted', oi.PriceQuoted,
                'hebrewDescription', i.HebrewDescription,
                'englishDescription', i.EnglishDescription,
                'isPromotion', oi.IsPromotion,
                'promotionGroupId', oi.PromotionGroupID
            )
        ) as Items
    FROM \`Order\` o
    JOIN Supplier s ON o.SupplierID = s.SupplierID
    JOIN OrderItem oi ON o.OrderID = oi.OrderID
    JOIN Item i ON oi.ItemID = i.ItemID
    WHERE o.OrderID = ?
    GROUP BY o.OrderID
`;

const createOrderQuery = 'INSERT INTO `Order` (InquiryID, SupplierID, Status) VALUES (?, ?, ?)';

const createOrderItemQuery = {
    promotion: `
        INSERT INTO OrderItem (
            OrderID, 
            ItemID, 
            InquiryItemID,
            Quantity,
            PriceQuoted,
            IsPromotion,
            PromotionGroupID
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    regular: `
        INSERT INTO OrderItem (
            OrderID, 
            ItemID, 
            InquiryItemID,
            Quantity,
            PriceQuoted,
            SupplierResponseID
        ) 
        SELECT ?, ?, ?, ?, ?, SupplierResponseID
        FROM SupplierResponse
        WHERE ItemID = ? AND SupplierID = ? AND Status = 'Active'
        ORDER BY ResponseDate DESC
        LIMIT 1
    `
};

const updateInquiryStatusQuery = 'UPDATE Inquiry SET Status = ? WHERE InquiryID = ?';

const updateOrderStatusQuery = {
    withNotes: 'UPDATE `Order` SET Status = ?, Notes = ? WHERE OrderID = ?',
    withoutNotes: 'UPDATE `Order` SET Status = ? WHERE OrderID = ?'
};

module.exports = {
    getAllOrdersQuery,
    getOrderByIdQuery,
    createOrderQuery,
    createOrderItemQuery,
    updateInquiryStatusQuery,
    updateOrderStatusQuery
};
