class InquiryModel {
    constructor(db) {
        this.db = db;
    }

    getAllInquiries(status) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    i.InquiryID as inquiryID,
                    i.InquiryNumber as customNumber,
                    i.Date as date,
                    i.Status as status,
                    COUNT(ii.InquiryItemID) as itemCount,
                    SUM(ii.RequestedQty) as totalRequestedQty
                FROM Inquiry i
                LEFT JOIN InquiryItem ii ON i.InquiryID = ii.InquiryID
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

    getInquiryById(inquiryId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

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
                            this.db.run('ROLLBACK');
                            reject(new Error('Failed to fetch inquiry details'));
                            return;
                        }

                        if (!inquiry) {
                            this.db.run('ROLLBACK');
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
                                this.db.run('ROLLBACK');
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

                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('Error committing transaction:', err);
                                    this.db.run('ROLLBACK');
                                    reject(new Error('Failed to complete inquiry fetch'));
                                    return;
                                }

                                resolve({
                                    inquiry,
                                    items
                                });
                            });
                        });
                    }
                );
            });
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

    createInquiry(inquiryNumber, items) {
        return new Promise((resolve, reject) => {
            const db = this.db;
            let isRolledBack = false;
            let isCommitted = false;

            const safeRollback = () => {
                if (!isRolledBack && !isCommitted) {
                    isRolledBack = true;
                    db.run('ROLLBACK');
                }
            };

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Validate inquiry number
                if (!inquiryNumber) {
                    safeRollback();
                    reject(new Error('Inquiry number is required'));
                    return;
                }

                // Validate items array
                if (!Array.isArray(items) || items.length === 0) {
                    safeRollback();
                    reject(new Error('At least one item is required'));
                    return;
                }

                // Validate each item has required fields
                for (const item of items) {
                    if (!item.itemId || !item.hebrewDescription) {
                        safeRollback();
                        reject(new Error(`Item ${item.itemId || 'unknown'} is missing required fields`));
                        return;
                    }
                }

                // Check if inquiry number already exists
                db.get('SELECT InquiryID FROM Inquiry WHERE InquiryNumber = ?', [inquiryNumber], (err, existing) => {
                    if (err) {
                        console.error('Database error checking inquiry number:', err);
                        safeRollback();
                        reject(new Error('Failed to check inquiry number'));
                        return;
                    }

                    if (existing) {
                        safeRollback();
                        reject(new Error(`Inquiry number ${inquiryNumber} already exists`));
                        return;
                    }

                    // Create the inquiry first
                    db.run(
                        `INSERT INTO Inquiry (InquiryNumber, Date, Status) VALUES (?, datetime('now'), 'New')`,
                        [inquiryNumber],
                        function(err) {
                            if (err) {
                                console.error('Database error creating inquiry:', err);
                                safeRollback();
                                reject(new Error('Failed to create inquiry'));
                                return;
                            }

                            const inquiryId = this.lastID;

                            // Process items sequentially
                            const processNextItem = (index) => {
                                if (index >= items.length) {
                                    // All items processed successfully
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Error committing transaction:', err);
                                            safeRollback();
                                            reject(new Error('Failed to complete inquiry creation'));
                                            return;
                                        }
                                        isCommitted = true;
                                        resolve(inquiryId);
                                    });
                                    return;
                                }

                                const item = items[index];

                                // First check if item exists
                                db.get('SELECT ItemID FROM Item WHERE ItemID = ?', [item.itemId], (err, existingItem) => {
                                    if (err) {
                                        console.error(`Error checking item ${item.itemId}:`, err);
                                        safeRollback();
                                        reject(new Error(`Failed to check item ${item.itemId}`));
                                        return;
                                    }

                                    const createOrUpdateItem = () => {
                                        const query = existingItem ? 
                                            `UPDATE Item SET 
                                                HebrewDescription = ?,
                                                EnglishDescription = ?,
                                                ImportMarkup = ?,
                                                HSCode = ?
                                            WHERE ItemID = ?` :
                                            `INSERT INTO Item (
                                                HebrewDescription,
                                                EnglishDescription,
                                                ImportMarkup,
                                                HSCode,
                                                ItemID
                                            ) VALUES (?, ?, ?, ?, ?)`;

                                        const params = [
                                            item.hebrewDescription,
                                            item.englishDescription || '',
                                            item.importMarkup || 1.30,
                                            item.hsCode || '',
                                            item.itemId
                                        ];

                                        db.run(query, params, (err) => {
                                            if (err) {
                                                console.error(`Error ${existingItem ? 'updating' : 'creating'} item ${item.itemId}:`, err);
                                                safeRollback();
                                                reject(new Error(`Failed to ${existingItem ? 'update' : 'create'} item ${item.itemId}`));
                                                return;
                                            }

                                            // Create inquiry item
                                            db.run(
                                                `INSERT INTO InquiryItem (
                                                    InquiryID,
                                                    ItemID,
                                                    OriginalItemID,
                                                    HebrewDescription,
                                                    EnglishDescription,
                                                    ImportMarkup,
                                                    HSCode,
                                                    QtyInStock,
                                                    RetailPrice,
                                                    SoldThisYear,
                                                    SoldLastYear,
                                                    RequestedQty,
                                                    ReferenceNotes
                                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                                [
                                                    inquiryId,
                                                    item.itemId,
                                                    item.itemId,
                                                    item.hebrewDescription,
                                                    item.englishDescription || '',
                                                    item.importMarkup || 1.30,
                                                    item.hsCode || '',
                                                    item.qtyInStock || 0,
                                                    item.retailPrice,  // Removed || 0 to allow null
                                                    item.soldThisYear || 0,
                                                    item.soldLastYear || 0,
                                                    item.requestedQty || 0,
                                                    item.referenceNotes || null
                                                ],
                                                (err) => {
                                                    if (err) {
                                                        console.error(`Error creating inquiry item ${item.itemId}:`, err);
                                                        safeRollback();
                                                        reject(new Error(`Failed to create inquiry item ${item.itemId}`));
                                                        return;
                                                    }

                                                    // Create item history
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
                                                            item.itemId,
                                                            item.retailPrice,  // Removed || 0 to allow null
                                                            item.qtyInStock || 0,
                                                            item.soldThisYear || 0,
                                                            item.soldLastYear || 0
                                                        ],
                                                        (err) => {
                                                            if (err) {
                                                                console.error(`Error creating history for item ${item.itemId}:`, err);
                                                                safeRollback();
                                                                reject(new Error(`Failed to create history for item ${item.itemId}`));
                                                                return;
                                                            }

                                                            // Create reference change if newReferenceId exists
                                                            if (item.newReferenceId) {
                                                                // First ensure the new reference item exists
                                                                db.get('SELECT ItemID FROM Item WHERE ItemID = ?', [item.newReferenceId], (err, existingRef) => {
                                                                    if (err) {
                                                                        console.error(`Error checking reference item ${item.newReferenceId}:`, err);
                                                                        safeRollback();
                                                                        reject(new Error(`Failed to check reference item ${item.newReferenceId}`));
                                                                        return;
                                                                    }

                                                                    // Create new reference item if it doesn't exist
                                                                    const createRefItem = () => {
                                                                        if (!existingRef) {
                                                                            db.run(
                                                                                `INSERT INTO Item (
                                                                                    ItemID,
                                                                                    HebrewDescription,
                                                                                    EnglishDescription,
                                                                                    ImportMarkup
                                                                                ) VALUES (?, ?, ?, ?)`,
                                                                                [
                                                                                    item.newReferenceId,
                                                                                    'חלק חדש לא ידוע', // "New unknown part" in Hebrew
                                                                                    'New unknown part',
                                                                                    1.30
                                                                                ],
                                                                                (err) => {
                                                                                    if (err) {
                                                                                        console.error(`Error creating reference item ${item.newReferenceId}:`, err);
                                                                                        safeRollback();
                                                                                        reject(new Error(`Failed to create reference item ${item.newReferenceId}`));
                                                                                        return;
                                                                                    }
                                                                                    createReferenceChange();
                                                                                }
                                                                            );
                                                                        } else {
                                                                            createReferenceChange();
                                                                        }
                                                                    };

                                                                    const createReferenceChange = () => {
                                                                        db.run(
                                                                            `INSERT INTO ItemReferenceChange (
                                                                                OriginalItemID,
                                                                                NewReferenceID,
                                                                                ChangedByUser,
                                                                                Notes,
                                                                                ChangeDate
                                                                            ) VALUES (?, ?, 1, ?, datetime('now'))`,
                                                                            [
                                                                                item.itemId,
                                                                                item.newReferenceId,
                                                                                item.referenceNotes || null
                                                                            ],
                                                                            (err) => {
                                                                                if (err) {
                                                                                    console.error(`Error creating reference change for item ${item.itemId}:`, err);
                                                                                    safeRollback();
                                                                                    reject(new Error(`Failed to create reference change for item ${item.itemId}`));
                                                                                    return;
                                                                                }

                                                                                // Process next item
                                                                                processNextItem(index + 1);
                                                                            }
                                                                        );
                                                                    };

                                                                    createRefItem();
                                                                });
                                                            } else {
                                                                // Process next item if no reference change needed
                                                                processNextItem(index + 1);
                                                            }
                                                        }
                                                    );
                                                }
                                            );
                                        });
                                    };

                                    createOrUpdateItem();
                                });
                            };

                            // Start processing items
                            processNextItem(0);
                        }
                    );
                });
            });
        });
    }

    deleteInquiry(inquiryId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                // Delete inquiry items first (due to foreign key constraint)
                this.db.run('DELETE FROM InquiryItem WHERE InquiryID = ?', [inquiryId], (err) => {
                    if (err) {
                        console.error('Database error deleting inquiry items:', err);
                        this.db.run('ROLLBACK');
                        reject(new Error('Failed to delete inquiry items'));
                        return;
                    }

                    // Then delete the inquiry
                    this.db.run('DELETE FROM Inquiry WHERE InquiryID = ?', [inquiryId], (err) => {
                        if (err) {
                            console.error('Database error deleting inquiry:', err);
                            this.db.run('ROLLBACK');
                            reject(new Error('Failed to delete inquiry'));
                            return;
                        }

                        this.db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('Error committing transaction:', err);
                                this.db.run('ROLLBACK');
                                reject(new Error('Failed to complete inquiry deletion'));
                                return;
                            }
                            resolve();
                        });
                    });
                });
            });
        });
    }
}

module.exports = InquiryModel;
