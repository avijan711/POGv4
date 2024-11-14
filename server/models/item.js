class ItemModel {
    constructor(db) {
        this.db = db;
    }

    getAllItems() {
        return new Promise((resolve, reject) => {
            const query = `
                WITH LatestHistoryDates AS (
                    SELECT ItemID, MAX(Date) as maxDate
                    FROM ItemHistory
                    GROUP BY ItemID
                ),
                LatestHistory AS (
                    SELECT h.*
                    FROM ItemHistory h
                    INNER JOIN LatestHistoryDates d 
                        ON h.ItemID = d.ItemID 
                        AND h.Date = d.maxDate
                ),
                AllReferenceChanges AS (
                    SELECT 
                        OriginalItemID,
                        NewReferenceID,
                        ChangedByUser,
                        ChangeDate,
                        Notes,
                        SupplierID,
                        ROW_NUMBER() OVER (
                            PARTITION BY CASE 
                                WHEN OriginalItemID IS NOT NULL THEN OriginalItemID 
                                ELSE NewReferenceID 
                            END 
                            ORDER BY ChangeDate DESC
                        ) as rn
                    FROM ItemReferenceChange
                    WHERE OriginalItemID IS NOT NULL OR NewReferenceID IS NOT NULL
                    -- Exclude self-referencing changes
                    AND OriginalItemID != NewReferenceID
                ),
                LatestReferenceChanges AS (
                    SELECT *
                    FROM AllReferenceChanges
                    WHERE rn = 1
                )
                SELECT 
                    i.ItemID as itemID,
                    i.HebrewDescription as hebrewDescription,
                    i.EnglishDescription as englishDescription,
                    i.ImportMarkup as importMarkup,
                    i.HSCode as hsCode,
                    i.Image as image,
                    ih.ILSRetailPrice as retailPrice,
                    COALESCE(ih.QtyInStock, 0) as qtyInStock,
                    COALESCE(ih.QtySoldThisYear, 0) as soldThisYear,
                    COALESCE(ih.QtySoldLastYear, 0) as soldLastYear,
                    ih.Date as lastUpdated,
                    CASE 
                        WHEN rc1.NewReferenceID IS NOT NULL 
                        AND rc1.OriginalItemID != rc1.NewReferenceID THEN json_object(
                            'newReferenceID', rc1.NewReferenceID,
                            'changedByUser', rc1.ChangedByUser,
                            'changeDate', rc1.ChangeDate,
                            'notes', rc1.Notes,
                            'supplierName', s1.Name,
                            'source', CASE 
                                WHEN rc1.SupplierID IS NOT NULL THEN 'supplier'
                                WHEN rc1.ChangedByUser = 1 THEN 'user'
                                ELSE NULL
                            END
                        )
                        ELSE NULL
                    END as referenceChange,
                    CASE 
                        WHEN rc2.OriginalItemID IS NOT NULL 
                        AND rc2.OriginalItemID != rc2.NewReferenceID THEN json_object(
                            'originalItemID', rc2.OriginalItemID,
                            'changedByUser', rc2.ChangedByUser,
                            'changeDate', rc2.ChangeDate,
                            'notes', rc2.Notes,
                            'supplierName', s2.Name,
                            'source', CASE 
                                WHEN rc2.SupplierID IS NOT NULL THEN 'supplier'
                                WHEN rc2.ChangedByUser = 1 THEN 'user'
                                ELSE NULL
                            END
                        )
                        ELSE NULL
                    END as referencedBy
                FROM Item i
                LEFT JOIN LatestHistory ih ON i.ItemID = ih.ItemID
                LEFT JOIN LatestReferenceChanges rc1 ON i.ItemID = rc1.OriginalItemID
                LEFT JOIN LatestReferenceChanges rc2 ON i.ItemID = rc2.NewReferenceID
                LEFT JOIN Supplier s1 ON rc1.SupplierID = s1.SupplierID
                LEFT JOIN Supplier s2 ON rc2.SupplierID = s2.SupplierID
                ORDER BY i.ItemID
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('Error getting items:', err);
                    reject(err);
                    return;
                }

                // Parse reference JSON for each row
                rows = rows.map(row => {
                    try {
                        if (row.referenceChange) {
                            row.referenceChange = JSON.parse(row.referenceChange);
                        }
                        if (row.referencedBy) {
                            row.referencedBy = JSON.parse(row.referencedBy);
                        }
                    } catch (e) {
                        console.error('Error parsing reference data:', e);
                        row.referenceChange = null;
                        row.referencedBy = null;
                    }
                    return row;
                });

                console.log('Items with history:', rows.map(row => ({
                    itemId: row.itemID,
                    qtyInStock: row.qtyInStock,
                    soldThisYear: row.soldThisYear,
                    soldLastYear: row.soldLastYear
                })));

                resolve(rows);
            });
        });
    }

    getItemById(itemId) {
        return new Promise((resolve, reject) => {
            const queries = {
                item: `
                    WITH LatestHistory AS (
                        SELECT 
                            ItemID,
                            MAX(Date) as maxDate,
                            ILSRetailPrice,
                            QtyInStock,
                            QtySoldThisYear,
                            QtySoldLastYear
                        FROM ItemHistory
                        GROUP BY ItemID
                    ),
                    AllReferenceChanges AS (
                        SELECT 
                            OriginalItemID,
                            NewReferenceID,
                            ChangedByUser,
                            ChangeDate,
                            Notes,
                            SupplierID,
                            ROW_NUMBER() OVER (
                                PARTITION BY CASE 
                                    WHEN OriginalItemID IS NOT NULL THEN OriginalItemID 
                                    ELSE NewReferenceID 
                                END 
                                ORDER BY ChangeDate DESC
                            ) as rn
                        FROM ItemReferenceChange
                        WHERE (OriginalItemID IS NOT NULL OR NewReferenceID IS NOT NULL)
                        -- Exclude self-referencing changes
                        AND OriginalItemID != NewReferenceID
                    ),
                    LatestReferenceChanges AS (
                        SELECT *
                        FROM AllReferenceChanges
                        WHERE rn = 1
                    )
                    SELECT 
                        i.ItemID as itemID,
                        i.HebrewDescription as hebrewDescription,
                        i.EnglishDescription as englishDescription,
                        i.ImportMarkup as importMarkup,
                        i.HSCode as hsCode,
                        i.Image as image,
                        ih.ILSRetailPrice as retailPrice,
                        COALESCE(ih.QtyInStock, 0) as qtyInStock,
                        COALESCE(ih.QtySoldThisYear, 0) as soldThisYear,
                        COALESCE(ih.QtySoldLastYear, 0) as soldLastYear,
                        ih.maxDate as lastUpdated,
                        CASE 
                            WHEN rc1.NewReferenceID IS NOT NULL 
                            AND rc1.OriginalItemID != rc1.NewReferenceID THEN json_object(
                                'newReferenceID', rc1.NewReferenceID,
                                'changedByUser', rc1.ChangedByUser,
                                'changeDate', rc1.ChangeDate,
                                'notes', rc1.Notes,
                                'supplierName', s1.Name,
                                'source', CASE 
                                    WHEN rc1.SupplierID IS NOT NULL THEN 'supplier'
                                    WHEN rc1.ChangedByUser = 1 THEN 'user'
                                    ELSE NULL
                                END
                            )
                            ELSE NULL
                        END as referenceChange,
                        CASE 
                            WHEN rc2.OriginalItemID IS NOT NULL 
                            AND rc2.OriginalItemID != rc2.NewReferenceID THEN json_object(
                                'originalItemID', rc2.OriginalItemID,
                                'changedByUser', rc2.ChangedByUser,
                                'changeDate', rc2.ChangeDate,
                                'notes', rc2.Notes,
                                'supplierName', s2.Name,
                                'source', CASE 
                                    WHEN rc2.SupplierID IS NOT NULL THEN 'supplier'
                                    WHEN rc2.ChangedByUser = 1 THEN 'user'
                                    ELSE NULL
                                END
                            )
                            ELSE NULL
                        END as referencedBy
                    FROM Item i
                    LEFT JOIN LatestHistory ih ON i.ItemID = ih.ItemID
                    LEFT JOIN LatestReferenceChanges rc1 ON i.ItemID = rc1.OriginalItemID
                    LEFT JOIN LatestReferenceChanges rc2 ON i.ItemID = rc2.NewReferenceID
                    LEFT JOIN Supplier s1 ON rc1.SupplierID = s1.SupplierID
                    LEFT JOIN Supplier s2 ON rc2.SupplierID = s2.SupplierID
                    WHERE i.ItemID = ?
                `,
                priceHistory: `
                    SELECT 
                        Date as date,
                        ILSRetailPrice as price
                    FROM ItemHistory
                    WHERE ItemID = ?
                    ORDER BY Date DESC
                `,
                supplierPrices: `
                    WITH LatestSupplierPrices AS (
                        SELECT 
                            sr.ItemID,
                            sr.SupplierID,
                            sr.PriceQuoted,
                            sr.ResponseDate,
                            sr.Status,
                            sr.IsPromotion,
                            sr.PromotionName,
                            NULL as PromotionStartDate,
                            NULL as PromotionEndDate,
                            s.Name as SupplierName,
                            ROW_NUMBER() OVER (
                                PARTITION BY sr.SupplierID 
                                ORDER BY sr.ResponseDate DESC
                            ) as rn,
                            LAG(sr.PriceQuoted) OVER (
                                PARTITION BY sr.SupplierID 
                                ORDER BY sr.ResponseDate DESC
                            ) as PreviousPrice
                        FROM SupplierResponse sr
                        JOIN Supplier s ON s.SupplierID = sr.SupplierID
                        WHERE sr.ItemID = ?
                        
                        UNION ALL
                        
                        SELECT 
                            p.ItemID,
                            pg.SupplierID,
                            p.PromoPrice as PriceQuoted,
                            datetime('now') as ResponseDate,
                            'Active' as Status,
                            1 as IsPromotion,
                            pg.Name as PromotionName,
                            pg.StartDate as PromotionStartDate,
                            pg.EndDate as PromotionEndDate,
                            s.Name as SupplierName,
                            1 as rn,
                            NULL as PreviousPrice
                        FROM Promotion p
                        JOIN PromotionGroup pg ON p.PromotionGroupID = pg.PromotionGroupID
                        JOIN Supplier s ON pg.SupplierID = s.SupplierID
                        WHERE p.ItemID = ?
                        AND p.IsActive = 1
                        AND pg.IsActive = 1
                        AND datetime('now') BETWEEN pg.StartDate AND pg.EndDate
                    )
                    SELECT 
                        PriceQuoted as price,
                        ResponseDate as date,
                        Status as status,
                        SupplierName as supplierName,
                        IsPromotion as isPromotion,
                        PromotionName as promotionName,
                        PromotionStartDate as promotionStartDate,
                        PromotionEndDate as promotionEndDate,
                        CASE 
                            WHEN PreviousPrice IS NOT NULL 
                            THEN ((PriceQuoted - PreviousPrice) / PreviousPrice) * 100 
                            ELSE 0 
                        END as change
                    FROM LatestSupplierPrices
                    WHERE rn = 1
                    ORDER BY date DESC
                `,
                promotions: `
                    SELECT 
                        pg.StartDate as startDate,
                        pg.EndDate as endDate,
                        p.PromoPrice as price,
                        p.IsActive as isActive,
                        pg.Name as promotionName,
                        s.Name as supplierName
                    FROM Promotion p
                    JOIN PromotionGroup pg ON p.PromotionGroupID = pg.PromotionGroupID
                    JOIN Supplier s ON pg.SupplierID = s.SupplierID
                    WHERE p.ItemID = ?
                    ORDER BY pg.StartDate DESC
                `
            };

            const result = {};

            Promise.all([
                new Promise((resolve, reject) => {
                    this.db.get(queries.item, [itemId], (err, row) => {
                        if (err) reject(err);
                        else {
                            if (row && row.referenceChange) {
                                try {
                                    row.referenceChange = JSON.parse(row.referenceChange);
                                } catch (e) {
                                    console.error('Error parsing reference change:', e);
                                    row.referenceChange = null;
                                }
                            }
                            if (row && row.referencedBy) {
                                try {
                                    row.referencedBy = JSON.parse(row.referencedBy);
                                } catch (e) {
                                    console.error('Error parsing referencedBy:', e);
                                    row.referencedBy = null;
                                }
                            }
                            result.item = row;
                            resolve();
                        }
                    });
                }),
                new Promise((resolve, reject) => {
                    this.db.all(queries.priceHistory, [itemId], (err, rows) => {
                        if (err) reject(err);
                        else {
                            result.priceHistory = rows.map((row, index, arr) => {
                                const nextPrice = arr[index + 1]?.price;
                                if (nextPrice) {
                                    const change = ((row.price - nextPrice) / nextPrice) * 100;
                                    return { ...row, change };
                                }
                                return { ...row, change: 0 };
                            });
                            resolve();
                        }
                    });
                }),
                new Promise((resolve, reject) => {
                    this.db.all(queries.supplierPrices, [itemId, itemId], (err, rows) => {
                        if (err) reject(err);
                        else {
                            result.supplierPrices = rows;
                            resolve();
                        }
                    });
                }),
                new Promise((resolve, reject) => {
                    this.db.all(queries.promotions, [itemId], (err, rows) => {
                        if (err) reject(err);
                        else {
                            result.promotions = rows;
                            resolve();
                        }
                    });
                })
            ])
            .then(() => resolve(result))
            .catch(reject);
        });
    }

    updateItem(itemId, data, image = null) {
        return new Promise((resolve, reject) => {
            const db = this.db; // Store reference to this.db
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Update Item table
                const itemQuery = `
                    UPDATE Item SET 
                        HebrewDescription = ?,
                        EnglishDescription = ?,
                        ImportMarkup = ?,
                        HSCode = ?
                    WHERE ItemID = ?
                `;
                const itemParams = [
                    data.hebrewDescription,
                    data.englishDescription || '',
                    data.importMarkup || 1.30,
                    data.hsCode || '',
                    itemId
                ];

                db.run(itemQuery, itemParams, function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }

                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        reject(new Error('Item not found'));
                        return;
                    }

                    // Update InquiryItem table
                    const inquiryItemQuery = `
                        UPDATE InquiryItem SET 
                            HebrewDescription = ?,
                            EnglishDescription = ?,
                            ImportMarkup = ?,
                            HSCode = ?,
                            QtyInStock = ?,
                            RetailPrice = ?,
                            SoldThisYear = ?,
                            SoldLastYear = ?
                        WHERE ItemID = ?
                    `;
                    const inquiryItemParams = [
                        data.hebrewDescription,
                        data.englishDescription || '',
                        data.importMarkup || 1.30,
                        data.hsCode || '',
                        data.qtyInStock || 0,
                        data.retailPrice,  // Removed || 0 to prevent defaulting to zero
                        data.soldThisYear || 0,
                        data.soldLastYear || 0,
                        itemId
                    ];

                    db.run(inquiryItemQuery, inquiryItemParams, (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }

                        const updateImage = () => {
                            if (image) {
                                db.run(
                                    `UPDATE Item SET Image = ? WHERE ItemID = ?`,
                                    [image.filename, itemId],
                                    (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }
                                        updateItemHistory();
                                    }
                                );
                            } else {
                                updateItemHistory();
                            }
                        };

                        const updateItemHistory = () => {
                            // Only insert history if retail price is provided
                            if (data.retailPrice !== undefined && data.retailPrice !== null) {
                                db.run(
                                    `INSERT INTO ItemHistory (
                                        ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date
                                    ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                                    [
                                        itemId,
                                        data.retailPrice,
                                        data.qtyInStock || 0,
                                        data.soldThisYear || 0,
                                        data.soldLastYear || 0
                                    ],
                                    (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }

                                        db.run('COMMIT', (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                reject(err);
                                                return;
                                            }
                                            resolve();
                                        });
                                    }
                                );
                            } else {
                                // If no retail price, just commit the transaction
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }
                                    resolve();
                                });
                            }
                        };

                        updateImage();
                    });
                });
            });
        });
    }

    deleteItem(itemId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                const deleteQueries = [
                    'DELETE FROM InquiryItem WHERE ItemID = ?',
                    'DELETE FROM SupplierResponse WHERE ItemID = ?',
                    'DELETE FROM Promotion WHERE ItemID = ?',
                    'DELETE FROM ItemReferenceChange WHERE OriginalItemID = ? OR NewReferenceID = ?',
                    'DELETE FROM ItemHistory WHERE ItemID = ?',
                    'DELETE FROM Item WHERE ItemID = ?'
                ];

                let currentQuery = 0;
                const executeNextQuery = () => {
                    if (currentQuery >= deleteQueries.length) {
                        this.db.run('COMMIT', (err) => {
                            if (err) {
                                this.db.run('ROLLBACK');
                                reject(err);
                                return;
                            }
                            resolve();
                        });
                        return;
                    }

                    const params = deleteQueries[currentQuery].includes('OR NewReferenceID') ? 
                        [itemId, itemId] : [itemId];

                    this.db.run(deleteQueries[currentQuery], params, (err) => {
                        if (err) {
                            this.db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        currentQuery++;
                        executeNextQuery();
                    });
                };

                executeNextQuery();
            });
        });
    }

    addReferenceChange(itemId, newReferenceId, supplierId, notes) {
        return new Promise((resolve, reject) => {
            // Don't add reference if it's self-referencing
            if (itemId === newReferenceId) {
                resolve();
                return;
            }

            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                const createReferenceItem = () => {
                    this.db.run(
                        `INSERT INTO Item (ItemID, HebrewDescription, EnglishDescription, ImportMarkup)
                         VALUES (?, 'New reference item', 'New reference item', 1.30)`,
                        [newReferenceId],
                        (err) => {
                            if (err) {
                                this.db.run('ROLLBACK');
                                reject(err);
                                return;
                            }

                            this.db.run(
                                `INSERT INTO ItemHistory (ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
                                 VALUES (?, NULL, 0, 0, 0, datetime('now'))`,  // Changed 0 to NULL for ILSRetailPrice
                                [newReferenceId],
                                (err) => {
                                    if (err) {
                                        this.db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }
                                    addReference();
                                }
                            );
                        }
                    );
                };

                const addReference = () => {
                    // First delete any existing self-references
                    this.db.run(
                        `DELETE FROM ItemReferenceChange 
                         WHERE OriginalItemID = NewReferenceID`,
                        (err) => {
                            if (err) {
                                this.db.run('ROLLBACK');
                                reject(err);
                                return;
                            }

                            // Then add the new reference
                            this.db.run(
                                `INSERT INTO ItemReferenceChange (
                                    OriginalItemID,
                                    NewReferenceID,
                                    ChangedByUser,
                                    SupplierID,
                                    Notes,
                                    ChangeDate
                                ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                                [itemId, newReferenceId, !supplierId, supplierId, notes],
                                (err) => {
                                    if (err) {
                                        this.db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }

                                    this.db.run('COMMIT', (err) => {
                                        if (err) {
                                            this.db.run('ROLLBACK');
                                            reject(err);
                                            return;
                                        }
                                        resolve();
                                    });
                                }
                            );
                        }
                    );
                };

                // Check if reference item exists
                this.db.get('SELECT ItemID FROM Item WHERE ItemID = ?', [newReferenceId], (err, row) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }

                    if (!row) {
                        createReferenceItem();
                    } else {
                        addReference();
                    }
                });
            });
        });
    }
}

module.exports = ItemModel;
