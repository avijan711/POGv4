class OrderModel {
    constructor(db) {
        this.db = db;
    }

    getBestSupplierPrices(inquiryId) {
        return new Promise((resolve, reject) => {
            const query = `
                WITH InquiryItems AS (
                    -- Get all items from the inquiry with their details
                    SELECT 
                        ii.ItemID,
                        ii.InquiryItemID,
                        ii.RequestedQty,
                        i.HebrewDescription,
                        i.EnglishDescription,
                        i.ImportMarkup,
                        COALESCE(
                            CAST(ii.RetailPrice AS NUMERIC),
                            (
                                SELECT ILSRetailPrice 
                                FROM ItemHistory ih 
                                WHERE ih.ItemID = ii.ItemID 
                                AND ih.ILSRetailPrice IS NOT NULL 
                                ORDER BY ih.Date DESC 
                                LIMIT 1
                            ),
                            0
                        ) as RetailPrice
                    FROM InquiryItem ii
                    JOIN Item i ON ii.ItemID = i.ItemID
                    WHERE ii.InquiryID = ?
                ),
                BaseSuppliers AS (
                    -- Get all suppliers
                    SELECT 
                        SupplierID,
                        Name as SupplierName
                    FROM Supplier
                ),
                PromotionSuppliers AS (
                    -- Get suppliers with active promotions and matching items
                    SELECT DISTINCT
                        s.SupplierID,
                        s.SupplierName,
                        1 as IsPromotion,
                        pg.Name as PromotionName,
                        pg.PromotionGroupID
                    FROM BaseSuppliers s
                    JOIN PromotionGroup pg ON s.SupplierID = pg.SupplierID
                    JOIN Promotion p ON pg.PromotionGroupID = p.PromotionGroupID
                    JOIN InquiryItems ii ON p.ItemID = ii.ItemID
                    WHERE pg.IsActive = 1
                    AND p.IsActive = 1
                    AND datetime('now') BETWEEN pg.StartDate AND pg.EndDate
                ),
                SupplierTypes AS (
                    -- Regular suppliers
                    SELECT 
                        s.SupplierID,
                        s.SupplierName,
                        0 as IsPromotion,
                        NULL as PromotionName,
                        NULL as PromotionGroupID
                    FROM BaseSuppliers s
                    
                    UNION ALL
                    
                    -- Add promotion suppliers
                    SELECT * FROM PromotionSuppliers
                ),
                ItemSupplierCombos AS (
                    -- Create all possible item-supplier combinations with retail price
                    SELECT 
                        ii.ItemID,
                        ii.InquiryItemID,
                        ii.RequestedQty,
                        ii.HebrewDescription,
                        ii.EnglishDescription,
                        ii.ImportMarkup,
                        ii.RetailPrice,
                        st.SupplierID,
                        st.SupplierName,
                        st.IsPromotion,
                        st.PromotionName,
                        st.PromotionGroupID
                    FROM InquiryItems ii
                    CROSS JOIN SupplierTypes st
                ),
                AllPrices AS (
                    -- Get regular supplier prices
                    SELECT 
                        isc.*,
                        sr.PriceQuoted,
                        sr.Status as ResponseStatus
                    FROM ItemSupplierCombos isc
                    JOIN SupplierResponse sr ON 
                        isc.ItemID = sr.ItemID AND 
                        isc.SupplierID = sr.SupplierID AND 
                        sr.Status = 'Active'
                    WHERE isc.IsPromotion = 0
                    
                    UNION ALL
                    
                    -- Get promotion prices (only include when promotion price exists)
                    SELECT 
                        isc.*,
                        p.PromoPrice as PriceQuoted,
                        'Active' as ResponseStatus
                    FROM ItemSupplierCombos isc
                    JOIN Promotion p ON 
                        isc.ItemID = p.ItemID AND
                        isc.PromotionGroupID = p.PromotionGroupID AND
                        p.IsActive = 1
                    WHERE isc.IsPromotion = 1
                ),
                BestPrices AS (
                    -- Calculate best price for each item
                    SELECT 
                        ItemID,
                        MIN(PriceQuoted) as BestPrice
                    FROM AllPrices
                    WHERE PriceQuoted IS NOT NULL
                    GROUP BY ItemID
                )
                SELECT 
                    ap.*,
                    bp.BestPrice
                FROM AllPrices ap
                LEFT JOIN BestPrices bp ON ap.ItemID = bp.ItemID
                ORDER BY 
                    ap.ItemID,
                    ap.IsPromotion DESC,
                    ap.PriceQuoted ASC NULLS LAST
            `;

            this.db.all(query, [inquiryId], (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    reject(new Error('Failed to get supplier prices'));
                    return;
                }

                // Log the first item to examine its structure
                if (results && results.length > 0) {
                    const sampleItem = results[0];
                    console.log('Sample item structure:', {
                        item: sampleItem,
                        importMarkup: sampleItem.ImportMarkup,
                        retailPrice: sampleItem.RetailPrice,
                        priceQuoted: sampleItem.PriceQuoted,
                        // Log the raw values and their types
                        rawValues: {
                            importMarkup: {
                                value: sampleItem.ImportMarkup,
                                type: typeof sampleItem.ImportMarkup
                            },
                            retailPrice: {
                                value: sampleItem.RetailPrice,
                                type: typeof sampleItem.RetailPrice
                            }
                        }
                    });
                }

                resolve(results);
            });
        });
    }

    /**
     * Create orders from an inquiry by grouping items by their best suppliers
     * @param {number} inquiryId - The ID of the inquiry
     * @returns {Promise<Array>} Array of created order IDs
     */
    createOrdersFromInquiry(inquiryId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                // First get all best prices
                this.getBestSupplierPrices(inquiryId)
                    .then(items => {
                        // Filter to only get the best price for each item
                        const bestPrices = items.reduce((acc, item) => {
                            if (!acc[item.ItemID] || item.PriceQuoted < acc[item.ItemID].PriceQuoted) {
                                acc[item.ItemID] = item;
                            }
                            return acc;
                        }, {});

                        // Group items by supplier
                        const supplierGroups = Object.values(bestPrices).reduce((groups, item) => {
                            if (!groups[item.SupplierID]) {
                                groups[item.SupplierID] = [];
                            }
                            groups[item.SupplierID].push(item);
                            return groups;
                        }, {});

                        const orderIds = [];
                        let processedSuppliers = 0;
                        const totalSuppliers = Object.keys(supplierGroups).length;

                        // Create an order for each supplier
                        for (const [supplierId, supplierItems] of Object.entries(supplierGroups)) {
                            this.db.run(
                                'INSERT INTO `Order` (InquiryID, SupplierID, Status) VALUES (?, ?, ?)',
                                [inquiryId, supplierId, 'Pending'],
                                function(err) {
                                    if (err) {
                                        console.error('Error creating order:', err);
                                        this.db.run('ROLLBACK');
                                        reject(new Error('Failed to create order'));
                                        return;
                                    }

                                    const orderId = this.lastID;
                                    orderIds.push(orderId);
                                    let processedItems = 0;

                                    // Add items to the order
                                    supplierItems.forEach(item => {
                                        const insertQuery = item.IsPromotion ?
                                            `INSERT INTO OrderItem (
                                                OrderID, 
                                                ItemID, 
                                                InquiryItemID,
                                                Quantity,
                                                PriceQuoted,
                                                IsPromotion,
                                                PromotionGroupID
                                            ) VALUES (?, ?, ?, ?, ?, ?, ?)` :
                                            `INSERT INTO OrderItem (
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
                                            LIMIT 1`;

                                        const params = item.IsPromotion ?
                                            [orderId, item.ItemID, item.InquiryItemID, item.RequestedQty, item.PriceQuoted, 1, item.PromotionGroupID] :
                                            [orderId, item.ItemID, item.InquiryItemID, item.RequestedQty, item.PriceQuoted, item.ItemID, supplierId];

                                        this.db.run(insertQuery, params, (err) => {
                                            if (err) {
                                                console.error('Error creating order item:', err);
                                                this.db.run('ROLLBACK');
                                                reject(new Error('Failed to create order item'));
                                                return;
                                            }

                                            processedItems++;
                                            if (processedItems === supplierItems.length) {
                                                processedSuppliers++;
                                                if (processedSuppliers === totalSuppliers) {
                                                    // Update inquiry status
                                                    this.db.run(
                                                        'UPDATE Inquiry SET Status = ? WHERE InquiryID = ?',
                                                        ['Ordered', inquiryId],
                                                        (err) => {
                                                            if (err) {
                                                                console.error('Error updating inquiry status:', err);
                                                                this.db.run('ROLLBACK');
                                                                reject(new Error('Failed to update inquiry status'));
                                                                return;
                                                            }

                                                            this.db.run('COMMIT', (err) => {
                                                                if (err) {
                                                                    console.error('Error committing transaction:', err);
                                                                    this.db.run('ROLLBACK');
                                                                    reject(new Error('Failed to commit transaction'));
                                                                    return;
                                                                }
                                                                resolve(orderIds);
                                                            });
                                                        }
                                                    );
                                                }
                                            }
                                        });
                                    });
                                }
                            );
                        }
                    })
                    .catch(err => {
                        console.error('Error in createOrdersFromInquiry:', err);
                        this.db.run('ROLLBACK');
                        reject(err);
                    });
            });
        });
    }

    /**
     * Get all orders with their items and supplier information
     * @returns {Promise<Array>} Array of orders with their details
     */
    getAllOrders() {
        return new Promise((resolve, reject) => {
            const query = `
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

            this.db.all(query, [], (err, orders) => {
                if (err) {
                    console.error('Error getting orders:', err);
                    reject(new Error('Failed to get orders'));
                    return;
                }

                // Parse the JSON string of items for each order
                orders = orders.map(order => ({
                    ...order,
                    Items: JSON.parse(order.Items)
                }));

                resolve(orders);
            });
        });
    }

    /**
     * Get a specific order by ID with all its details
     * @param {number} orderId - The ID of the order to retrieve
     * @returns {Promise<Object>} The order details
     */
    getOrderById(orderId) {
        return new Promise((resolve, reject) => {
            const query = `
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

            this.db.get(query, [orderId], (err, order) => {
                if (err) {
                    console.error('Error getting order:', err);
                    reject(new Error('Failed to get order'));
                    return;
                }

                if (!order) {
                    reject(new Error('Order not found'));
                    return;
                }

                // Parse the JSON string of items
                order.Items = JSON.parse(order.Items);
                resolve(order);
            });
        });
    }

    /**
     * Update the status of an order
     * @param {number} orderId - The ID of the order to update
     * @param {string} status - The new status
     * @param {string} notes - Optional notes about the status change
     * @returns {Promise<void>}
     */
    updateOrderStatus(orderId, status, notes = null) {
        return new Promise((resolve, reject) => {
            const query = notes 
                ? 'UPDATE `Order` SET Status = ?, Notes = ? WHERE OrderID = ?'
                : 'UPDATE `Order` SET Status = ? WHERE OrderID = ?';
            const params = notes ? [status, notes, orderId] : [status, orderId];

            this.db.run(query, params, function(err) {
                if (err) {
                    console.error('Error updating order status:', err);
                    reject(new Error('Failed to update order status'));
                    return;
                }

                if (this.changes === 0) {
                    reject(new Error('Order not found'));
                    return;
                }

                resolve();
            });
        });
    }
}

module.exports = OrderModel;
