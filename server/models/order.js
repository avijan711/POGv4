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

class OrderModel {
    constructor(db) {
        this.db = db;
    }

    getBestSupplierPrices(inquiryId) {
        return new Promise((resolve, reject) => {
            console.log('\n=== Starting getBestSupplierPrices for inquiry:', inquiryId, '===');
            
            // First check if the inquiry exists
            this.db.get(checkInquiryExistsQuery, [inquiryId], (err, inquiry) => {
                if (err) {
                    console.error('Error checking inquiry:', err);
                    reject(new Error('Failed to check inquiry'));
                    return;
                }

                if (!inquiry) {
                    console.error('Inquiry not found:', inquiryId);
                    reject(new Error('Inquiry not found'));
                    return;
                }

                console.log('Found inquiry:', inquiryId);

                // Debug: Check inquiry items first
                this.db.all(debugInquiryItemsQuery, [inquiryId], (err, inquiryItems) => {
                    if (err) {
                        console.error('Error in debug inquiry items query:', err);
                    } else {
                        console.log('\nDebug inquiry items:', inquiryItems);
                        
                        // For each inquiry item, check its supplier prices
                        inquiryItems.forEach(item => {
                            this.db.all(debugSupplierPricesQuery, [item.ItemID], (err, prices) => {
                                if (err) {
                                    console.error(`Error checking prices for item ${item.ItemID}:`, err);
                                } else {
                                    console.log(`\nSupplier prices for item ${item.ItemID}:`, prices);
                                }

                                // If there's an original item ID, check its prices too
                                if (item.OriginalItemID && item.OriginalItemID !== item.ItemID) {
                                    this.db.all(debugSupplierPricesQuery, [item.OriginalItemID], (err, originalPrices) => {
                                        if (err) {
                                            console.error(`Error checking prices for original item ${item.OriginalItemID}:`, err);
                                        } else {
                                            console.log(`\nSupplier prices for original item ${item.OriginalItemID}:`, originalPrices);
                                        }
                                    });
                                }
                            });
                        });
                    }

                    // Debug: Check item references
                    this.db.all(debugPriceReferencesQuery, [inquiryId], (err, references) => {
                        if (err) {
                            console.error('Error in debug references query:', err);
                        } else {
                            console.log('\nDebug item references:', references);
                            
                            // Analyze references
                            const referenceMap = {};
                            references.forEach(ref => {
                                if (!referenceMap[ref.ItemID]) {
                                    referenceMap[ref.ItemID] = {
                                        originalItemID: ref.OriginalItemID,
                                        prices: []
                                    };
                                }
                                if (ref.SupplierPriceItemID) {
                                    referenceMap[ref.ItemID].prices.push({
                                        priceItemID: ref.SupplierPriceItemID,
                                        price: ref.PriceQuoted,
                                        lastUpdated: ref.LastUpdated
                                    });
                                }
                            });
                            console.log('\nReference analysis:', referenceMap);
                        }

                        // Then get the best prices
                        console.log('\nExecuting best prices query...');
                        console.log('Query:', getBestSupplierPricesQuery);
                        this.db.all(getBestSupplierPricesQuery, [inquiryId], (err, results) => {
                            if (err) {
                                console.error('Error getting supplier prices:', err);
                                console.error('Error details:', err.message);
                                reject(new Error('Failed to get supplier prices'));
                                return;
                            }

                            // Log results
                            console.log('\n=== Best prices results ===');
                            console.log('Total items:', results.length);
                            if (results.length > 0) {
                                console.log('Sample items:');
                                results.slice(0, 3).forEach(item => {
                                    console.log('Item:', {
                                        itemID: item.ItemID,
                                        supplierID: item.SupplierID,
                                        price: item.PriceQuoted,
                                        description: item.HebrewDescription
                                    });
                                });
                            } else {
                                console.log('No results found - analyzing possible reasons:');
                                console.log('- Number of inquiry items:', inquiryItems?.length || 0);
                                console.log('- Number of references:', references?.length || 0);
                            }
                            console.log('=== End best prices results ===\n');

                            resolve(results);
                        });
                    });
                });
            });
        });
    }

    getReplacements(inquiryId) {
        return new Promise((resolve, reject) => {
            console.log('=== Starting getReplacements for inquiry:', inquiryId, '===');
            
            // First check if the inquiry exists
            this.db.get(checkInquiryExistsQuery, [inquiryId], (err, inquiry) => {
                if (err) {
                    console.error('Error checking inquiry existence:', err);
                    reject(new Error(`Failed to check inquiry: ${err.message}`));
                    return;
                }

                if (!inquiry) {
                    console.error('Inquiry not found:', inquiryId);
                    reject(new Error('Inquiry not found'));
                    return;
                }

                console.log('Found inquiry:', inquiryId);

                // Debug: Check item references first
                this.db.all(debugItemReferencesQuery, [inquiryId], (err, debugRows) => {
                    if (err) {
                        console.error('Error in debug query:', err);
                    } else {
                        console.log('Debug item references:', debugRows);
                    }

                    // Then get the replacements
                    this.db.all(getReplacementsQuery, [inquiryId], (err, rows) => {
                        if (err) {
                            console.error('Error executing replacements query:', err);
                            reject(new Error(`Failed to get replacements: ${err.message}`));
                            return;
                        }

                        // Debug log
                        console.log('Raw replacements results:', rows);
                        console.log('Total replacements found:', rows.length);

                        // Convert to map for easier lookup
                        const replacementsMap = {};
                        rows.forEach(row => {
                            if (row.originalItemId && row.newItemId) {
                                console.log('Processing replacement:', {
                                    originalItemId: row.originalItemId,
                                    newItemId: row.newItemId,
                                    source: row.source,
                                    descriptions: {
                                        original: row.originalDescription,
                                        new: row.newDescription,
                                        inquiry: row.inquiryDescription
                                    }
                                });

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

                        resolve(replacementsMap);
                    });
                });
            });
        });
    }

    getAllOrders() {
        return new Promise((resolve, reject) => {
            this.db.all(getAllOrdersQuery, [], (err, orders) => {
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

    getOrderById(orderId) {
        return new Promise((resolve, reject) => {
            this.db.get(getOrderByIdQuery, [orderId], (err, order) => {
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

    createOrder(data) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                // Create the order
                this.db.run(
                    'INSERT INTO "Order" (SupplierID, Status) VALUES (?, ?)',
                    [data.supplierId, 'Pending'],
                    function(err) {
                        if (err) {
                            console.error('Error creating order:', err);
                            this.db.run('ROLLBACK');
                            reject(new Error('Failed to create order'));
                            return;
                        }

                        const orderId = this.lastID;

                        // Create order items
                        const insertItem = this.db.prepare(
                            'INSERT INTO OrderItem (OrderID, ItemID, Quantity, PriceQuoted, IsPromotion, PromotionGroupID) VALUES (?, ?, ?, ?, ?, ?)'
                        );

                        try {
                            data.items.forEach(item => {
                                insertItem.run(
                                    orderId,
                                    item.itemId,
                                    item.quantity,
                                    item.priceQuoted,
                                    item.isPromotion ? 1 : 0,
                                    item.promotionGroupId || null
                                );
                            });

                            insertItem.finalize();

                            this.db.run('COMMIT', async (err) => {
                                if (err) {
                                    console.error('Error committing transaction:', err);
                                    this.db.run('ROLLBACK');
                                    reject(new Error('Failed to commit transaction'));
                                    return;
                                }

                                try {
                                    // Get the created order
                                    const order = await this.getOrderById(orderId);
                                    resolve(order);
                                } catch (err) {
                                    reject(err);
                                }
                            });
                        } catch (err) {
                            console.error('Error inserting order items:', err);
                            this.db.run('ROLLBACK');
                            reject(new Error('Failed to create order items'));
                        }
                    }
                );
            });
        });
    }

    updateOrderStatus(orderId, status, notes = null) {
        return new Promise((resolve, reject) => {
            const query = notes ? updateOrderStatusQuery.withNotes : updateOrderStatusQuery.withoutNotes;
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

    createOrdersFromInquiry(inquiryId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                this.getBestSupplierPrices(inquiryId)
                    .then(items => {
                        // Group items by best price per supplier
                        const supplierGroups = this._groupItemsByBestPrice(items);
                        
                        // Create orders for each supplier group
                        this._createSupplierOrders(inquiryId, supplierGroups)
                            .then(orderIds => {
                                // Update inquiry status
                                this.db.run(updateInquiryStatusQuery, ['Ordered', inquiryId], (err) => {
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
                                });
                            })
                            .catch(err => {
                                this.db.run('ROLLBACK');
                                reject(err);
                            });
                    })
                    .catch(err => {
                        console.error('Error in createOrdersFromInquiry:', err);
                        this.db.run('ROLLBACK');
                        reject(err);
                    });
            });
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

    _createSupplierOrders(inquiryId, supplierGroups) {
        return new Promise((resolve, reject) => {
            const orderIds = [];
            let processedSuppliers = 0;
            const totalSuppliers = Object.keys(supplierGroups).length;

            for (const [supplierId, items] of Object.entries(supplierGroups)) {
                this.db.run(createOrderQuery, [inquiryId, supplierId, 'Pending'], function(err) {
                    if (err) {
                        reject(new Error('Failed to create order'));
                        return;
                    }

                    const orderId = this.lastID;
                    orderIds.push(orderId);

                    this._createOrderItems(orderId, supplierId, items)
                        .then(() => {
                            processedSuppliers++;
                            if (processedSuppliers === totalSuppliers) {
                                resolve(orderIds);
                            }
                        })
                        .catch(reject);
                });
            }
        });
    }

    _createOrderItems(orderId, supplierId, items) {
        return Promise.all(items.map(item => {
            return new Promise((resolve, reject) => {
                const query = item.IsPromotion ? 
                    createOrderItemQuery.promotion : 
                    createOrderItemQuery.regular;

                const params = item.IsPromotion ?
                    [orderId, item.ItemID, item.InquiryItemID, item.RequestedQty, item.PriceQuoted, 1, item.PromotionGroupID] :
                    [orderId, item.ItemID, item.InquiryItemID, item.RequestedQty, item.PriceQuoted, item.ItemID, supplierId];

                this.db.run(query, params, err => {
                    if (err) {
                        reject(new Error('Failed to create order item'));
                        return;
                    }
                    resolve();
                });
            });
        }));
    }
}

module.exports = OrderModel;
