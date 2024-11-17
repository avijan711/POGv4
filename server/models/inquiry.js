class InquiryModel {
    constructor(db) {
        this.db = db;
    }

    createInquiry(inquiryNumber, items) {
        return new Promise((resolve, reject) => {
            const db = this.db;
            console.log('Starting createInquiry with:', { inquiryNumber, itemCount: items.length });

            db.serialize(() => {
                db.run('BEGIN TRANSACTION', async (err) => {
                    if (err) {
                        console.error('Error starting transaction:', err);
                        reject(new Error('Failed to start transaction'));
                        return;
                    }

                    console.log('Transaction started successfully');

                    try {
                        // First, ensure all items exist in the Item table
                        const uniqueItems = [...new Set(items.map(item => item.itemId))];
                        for (const itemId of uniqueItems) {
                            const item = items.find(i => i.itemId === itemId);
                            await new Promise((resolve, reject) => {
                                db.run(
                                    `INSERT OR REPLACE INTO Item (
                                        ItemID,
                                        HebrewDescription,
                                        EnglishDescription,
                                        ImportMarkup,
                                        HSCode
                                    ) VALUES (?, ?, ?, ?, ?)`,
                                    [
                                        itemId,
                                        item.hebrewDescription,
                                        item.englishDescription || '',
                                        item.importMarkup || 1.3,
                                        item.hsCode || ''
                                    ],
                                    (err) => {
                                        if (err) {
                                            reject(err);
                                        } else {
                                            resolve();
                                        }
                                    }
                                );
                            });

                            // Add price history if provided
                            if (item.retailPrice !== undefined && item.retailPrice !== null) {
                                await new Promise((resolve, reject) => {
                                    db.run(
                                        `INSERT INTO ItemHistory (
                                            ItemID,
                                            ILSRetailPrice,
                                            QtyInStock,
                                            QtySoldThisYear,
                                            QtySoldLastYear,
                                            Date
                                        ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                                        [
                                            itemId,
                                            item.retailPrice,
                                            item.qtyInStock || 0,
                                            item.soldThisYear || 0,
                                            item.soldLastYear || 0
                                        ],
                                        (err) => {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                resolve();
                                            }
                                        }
                                    );
                                });
                            }
                        }

                        // Create the inquiry
                        const inquiryId = await new Promise((resolve, reject) => {
                            db.run(
                                'INSERT INTO Inquiry (InquiryNumber, Status) VALUES (?, ?)',
                                [inquiryNumber, 'new'],
                                function(err) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(this.lastID);
                                    }
                                }
                            );
                        });

                        console.log('Created inquiry with ID:', inquiryId);

                        // Now insert all inquiry items
                        for (const item of items) {
                            await new Promise((resolve, reject) => {
                                db.run(
                                    `INSERT INTO InquiryItem (
                                        InquiryID,
                                        ItemID,
                                        HebrewDescription,
                                        EnglishDescription,
                                        ImportMarkup,
                                        HSCode,
                                        QtyInStock,
                                        RetailPrice,
                                        SoldThisYear,
                                        SoldLastYear,
                                        RequestedQty,
                                        NewReferenceID,
                                        ReferenceNotes
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [
                                        inquiryId,
                                        item.itemId,
                                        item.hebrewDescription,
                                        item.englishDescription || '',
                                        item.importMarkup || 1.3,
                                        item.hsCode || '',
                                        item.qtyInStock || 0,
                                        item.retailPrice,
                                        item.soldThisYear || 0,
                                        item.soldLastYear || 0,
                                        item.requestedQty || 0,
                                        item.newReferenceId || null,
                                        item.referenceNotes || null
                                    ],
                                    (err) => {
                                        if (err) {
                                            reject(err);
                                        } else {
                                            resolve();
                                        }
                                    }
                                );
                            });
                        }

                        // Commit transaction after all items are processed
                        await new Promise((resolve, reject) => {
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });

                        console.log('Transaction committed successfully');
                        resolve(inquiryId);

                    } catch (error) {
                        console.error('Error in transaction:', error);
                        db.run('ROLLBACK', () => {
                            reject(error);
                        });
                    }
                });
            });
        });
    }

    getAllInquiries(status) {
        return new Promise((resolve, reject) => {
            let query = `
                WITH ResponseStats AS (
                    SELECT 
                        ii.InquiryID,
                        sr.SupplierID,
                        COUNT(DISTINCT sr.SupplierResponseID) as ResponseCount,
                        COUNT(DISTINCT CASE WHEN irc.NewReferenceID IS NOT NULL THEN irc.ChangeID END) as ReplacementCount
                    FROM InquiryItem ii
                    LEFT JOIN SupplierResponse sr ON ii.ItemID = sr.ItemID AND sr.Status = 'Active'
                    LEFT JOIN ItemReferenceChange irc ON sr.ItemID = irc.OriginalItemID 
                        AND sr.SupplierID = irc.SupplierID
                    GROUP BY ii.InquiryID, sr.SupplierID
                )
                SELECT 
                    i.InquiryID as inquiryID,
                    i.InquiryNumber as customNumber,
                    i.Date as date,
                    i.Status as status,
                    COUNT(DISTINCT ii.InquiryItemID) as itemCount,
                    COUNT(DISTINCT rs.SupplierID) as respondedSuppliersCount,
                    SUM(CASE WHEN rs.ResponseCount IS NULL THEN 1 ELSE 0 END) as notRespondedItemsCount,
                    SUM(COALESCE(rs.ReplacementCount, 0)) as totalReplacementsCount
                FROM Inquiry i
                LEFT JOIN InquiryItem ii ON i.InquiryID = ii.InquiryID
                LEFT JOIN ResponseStats rs ON i.InquiryID = rs.InquiryID
            `;

            const params = [];
            if (status) {
                query += ' WHERE i.Status = ?';
                params.push(status);
            }

            query += `
                GROUP BY i.InquiryID
                ORDER BY i.Date DESC
            `;

            this.db.all(query, params, (err, inquiries) => {
                if (err) {
                    console.error('Database error in getAllInquiries:', err);
                    reject(new Error('Failed to fetch inquiries'));
                    return;
                }
                resolve(inquiries);
            });
        });
    }

    getInquiryById(inquiryId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Get inquiry details
                this.db.get(
                    `SELECT 
                        InquiryID as inquiryID,
                        InquiryNumber as customNumber,
                        Date as date,
                        Status as status
                    FROM Inquiry
                    WHERE InquiryID = ?`,
                    [inquiryId],
                    (err, inquiry) => {
                        if (err) {
                            console.error('Database error in getInquiryById:', err);
                            reject(new Error('Failed to fetch inquiry details'));
                            return;
                        }

                        if (!inquiry) {
                            reject(new Error('Inquiry not found'));
                            return;
                        }

                        // Get inquiry items with reference data
                        const itemsQuery = `
                            WITH AllReferenceChanges AS (
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
                            ),
                            LatestReferenceChanges AS (
                                SELECT *
                                FROM AllReferenceChanges
                                WHERE rn = 1
                            )
                            SELECT 
                                ii.InquiryItemID as inquiryItemID,
                                ii.ItemID as itemID,
                                ii.HebrewDescription as hebrewDescription,
                                COALESCE(ii.EnglishDescription, '') as englishDescription,
                                COALESCE(ii.ImportMarkup, 1.30) as importMarkup,
                                COALESCE(ii.HSCode, '') as hsCode,
                                COALESCE(ii.QtyInStock, 0) as qtyInStock,
                                COALESCE(ii.SoldThisYear, 0) as soldThisYear,
                                COALESCE(ii.SoldLastYear, 0) as soldLastYear,
                                ii.RetailPrice as retailPrice,
                                COALESCE(ii.RequestedQty, 0) as requestedQty,
                                CASE 
                                    WHEN rc1.NewReferenceID IS NOT NULL THEN json_object(
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
                                    WHEN rc2.OriginalItemID IS NOT NULL THEN json_object(
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
                            FROM InquiryItem ii
                            LEFT JOIN LatestReferenceChanges rc1 ON ii.ItemID = rc1.OriginalItemID
                            LEFT JOIN LatestReferenceChanges rc2 ON ii.ItemID = rc2.NewReferenceID
                            LEFT JOIN Supplier s1 ON rc1.SupplierID = s1.SupplierID
                            LEFT JOIN Supplier s2 ON rc2.SupplierID = s2.SupplierID
                            WHERE ii.InquiryID = ?
                        `;

                        this.db.all(itemsQuery, [inquiryId], (err, items) => {
                            if (err) {
                                console.error('Database error fetching inquiry items:', err);
                                reject(new Error('Failed to fetch inquiry items'));
                                return;
                            }

                            // Parse reference JSON for each item
                            items = items.map(item => {
                                if (item.referenceChange) {
                                    try {
                                        item.referenceChange = JSON.parse(item.referenceChange);
                                    } catch (e) {
                                        console.error('Error parsing reference change:', e);
                                        item.referenceChange = null;
                                    }
                                }
                                if (item.referencedBy) {
                                    try {
                                        item.referencedBy = JSON.parse(item.referencedBy);
                                    } catch (e) {
                                        console.error('Error parsing referencedBy:', e);
                                        item.referencedBy = null;
                                    }
                                }
                                return item;
                            });

                            resolve({
                                inquiry,
                                items
                            });
                        });
                    }
                );
            });
        });
    }

    updateInquiryStatus(inquiryId, status) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE Inquiry SET Status = ? WHERE InquiryID = ?',
                [status, inquiryId],
                function(err) {
                    if (err) {
                        console.error('Database error updating status:', err);
                        reject(new Error('Failed to update status'));
                        return;
                    }
                    
                    if (this.changes === 0) {
                        reject(new Error('Inquiry not found'));
                        return;
                    }
                    
                    resolve();
                }
            );
        });
    }

    updateInquiryItemQuantity(inquiryItemId, requestedQty) {
        return new Promise((resolve, reject) => {
            if (requestedQty < 0) {
                reject(new Error('Requested quantity cannot be negative'));
                return;
            }

            this.db.run(
                'UPDATE InquiryItem SET RequestedQty = ? WHERE InquiryItemID = ?',
                [requestedQty, inquiryItemId],
                function(err) {
                    if (err) {
                        console.error('Database error updating quantity:', err);
                        reject(new Error('Failed to update quantity'));
                        return;
                    }
                    
                    if (this.changes === 0) {
                        reject(new Error('Inquiry item not found'));
                        return;
                    }
                    
                    resolve();
                }
            );
        });
    }

    deleteInquiry(inquiryId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Start a transaction
                this.db.run('BEGIN TRANSACTION', (err) => {
                    if (err) {
                        console.error('Error starting transaction:', err);
                        reject(new Error('Failed to start delete transaction'));
                        return;
                    }

                    // First delete related inquiry items
                    this.db.run(
                        'DELETE FROM InquiryItem WHERE InquiryID = ?',
                        [inquiryId],
                        (err) => {
                            if (err) {
                                console.error('Error deleting inquiry items:', err);
                                this.db.run('ROLLBACK');
                                reject(new Error('Failed to delete inquiry items'));
                                return;
                            }

                            // Then delete the inquiry itself
                            this.db.run(
                                'DELETE FROM Inquiry WHERE InquiryID = ?',
                                [inquiryId],
                                (err) => {
                                    if (err) {
                                        console.error('Error deleting inquiry:', err);
                                        this.db.run('ROLLBACK');
                                        reject(new Error('Failed to delete inquiry'));
                                        return;
                                    }

                                    // Commit the transaction
                                    this.db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Error committing transaction:', err);
                                            this.db.run('ROLLBACK');
                                            reject(new Error('Failed to commit delete transaction'));
                                            return;
                                        }
                                        resolve();
                                    });
                                }
                            );
                        }
                    );
                });
            });
        });
    }
}

module.exports = InquiryModel;
