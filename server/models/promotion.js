const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const ExcelProcessor = require('../utils/excelProcessor');

// Use absolute path for database
const dbPath = path.join(__dirname, '..', 'inventory.db');

class Promotion {
    static getDb() {
        console.log('Opening database connection...');
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Database connection opened successfully');
                    resolve(db);
                }
            });
        });
    }

    static async getActivePromotions() {
        console.log('Getting active promotions...');
        let db;
        try {
            db = await this.getDb();
            const now = new Date().toISOString();
            console.log('Current timestamp:', now);

            return new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        pg.PromotionGroupID,
                        pg.Name,
                        pg.StartDate,
                        pg.EndDate,
                        pg.IsActive,
                        pg.ExcelFilePath,
                        pg.CreatedAt,
                        pg.UpdatedAt,
                        pg.SupplierID,
                        s.Name as SupplierName,
                        COUNT(p.PromotionID) as ItemCount
                    FROM PromotionGroup pg
                    INNER JOIN Supplier s ON pg.SupplierID = s.SupplierID
                    LEFT JOIN Promotion p ON pg.PromotionGroupID = p.PromotionGroupID
                    WHERE pg.IsActive = 1
                    AND pg.StartDate <= ?
                    AND pg.EndDate >= ?
                    GROUP BY 
                        pg.PromotionGroupID,
                        pg.Name,
                        pg.StartDate,
                        pg.EndDate,
                        pg.IsActive,
                        pg.ExcelFilePath,
                        pg.CreatedAt,
                        pg.UpdatedAt,
                        pg.SupplierID,
                        s.Name
                `;

                console.log('Executing query:', query.replace(/\s+/g, ' ').trim());
                console.log('Query parameters:', [now, now]);

                db.all(query, [now, now], (err, rows) => {
                    db.close();
                    if (err) {
                        console.error('Error getting active promotions:', err);
                        reject(err);
                    } else {
                        console.log('Found active promotions:', rows?.length || 0);
                        resolve(rows || []);
                    }
                });
            });
        } catch (error) {
            console.error('Error in getActivePromotions:', error);
            if (db) db.close();
            throw error;
        }
    }

    static async getPromotionGroupDetails(groupId, page = 1, pageSize = 100) {
        console.log('Getting promotion group details for ID:', groupId);
        let db;
        try {
            db = await this.getDb();

            return new Promise((resolve, reject) => {
                console.log('Getting promotion group...');
                const groupQuery = `
                    SELECT 
                        pg.*,
                        s.Name as SupplierName
                    FROM PromotionGroup pg
                    LEFT JOIN Supplier s ON pg.SupplierID = s.SupplierID
                    WHERE pg.PromotionGroupID = ?
                `;
                
                db.get(groupQuery, [groupId], (err, group) => {
                    if (err) {
                        console.error('Error getting promotion group:', err);
                        db.close();
                        return reject(err);
                    }
                    
                    if (!group) {
                        console.log('Promotion group not found');
                        db.close();
                        return reject(new Error('Promotion group not found'));
                    }

                    console.log('Found promotion group:', group);
                    
                    // First get total count
                    const countQuery = 'SELECT COUNT(*) as total FROM Promotion WHERE PromotionGroupID = ?';
                    
                    db.get(countQuery, [groupId], (err, countResult) => {
                        if (err) {
                            console.error('Error getting promotion items count:', err);
                            db.close();
                            return reject(err);
                        }

                        const total = countResult.total;
                        console.log('Total promotion items:', total);

                        // Calculate offset
                        const offset = (page - 1) * pageSize;

                        // Get paginated items with supplier info and dates
                        const itemsQuery = `
                            SELECT 
                                p.*,
                                pg.SupplierID,
                                pg.StartDate,
                                pg.EndDate,
                                s.Name as SupplierName
                            FROM Promotion p
                            JOIN PromotionGroup pg ON p.PromotionGroupID = pg.PromotionGroupID
                            LEFT JOIN Supplier s ON pg.SupplierID = s.SupplierID
                            WHERE p.PromotionGroupID = ?
                            LIMIT ? OFFSET ?
                        `;

                        db.all(itemsQuery, [groupId, pageSize, offset], (err, items) => {
                            db.close();
                            if (err) {
                                console.error('Error getting promotion items:', err);
                                return reject(err);
                            }
                            
                            console.log(`Found promotion items (page ${page}):`, items?.length || 0);
                            resolve({
                                ...group,
                                totalItems: total,
                                currentPage: page,
                                pageSize: pageSize,
                                totalPages: Math.ceil(total / pageSize),
                                items: items || []
                            });
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Error in getPromotionGroupDetails:', error);
            if (db) db.close();
            throw error;
        }
    }

    static async createPromotionGroup(name, startDate, endDate, supplierId, excelFilePath, items) {
        console.log('Creating promotion group:', { name, startDate, endDate, supplierId, items: items.length });
        let db;
        try {
            db = await this.getDb();
            
            return new Promise((resolve, reject) => {
                db.serialize(() => {
                    console.log('Starting transaction...');
                    db.run('BEGIN TRANSACTION');

                    // Insert promotion group
                    db.run(
                        `INSERT INTO PromotionGroup (Name, StartDate, EndDate, SupplierID, ExcelFilePath, IsActive) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [name, startDate, endDate, supplierId, excelFilePath, 1],
                        function(err) {
                            if (err) {
                                console.error('Error inserting promotion group:', err);
                                db.run('ROLLBACK');
                                db.close();
                                return reject(err);
                            }

                            const groupId = this.lastID;
                            console.log('Created promotion group with ID:', groupId);

                            // Insert promotions for each item
                            const promoStmt = db.prepare(
                                `INSERT INTO Promotion (PromotionGroupID, ItemID, PromoPrice, IsActive) 
                                 VALUES (?, ?, ?, ?)`
                            );

                            // Prepare statement for supplier responses
                            const supplierStmt = db.prepare(
                                `INSERT OR REPLACE INTO SupplierResponse 
                                 (ItemID, SupplierID, PriceQuoted, Status, IsPromotion, PromotionName) 
                                 VALUES (?, ?, ?, ?, ?, ?)`
                            );

                            let hasError = false;
                            items.forEach((item, index) => {
                                if (hasError) return;
                                console.log(`Inserting promotion item ${index + 1}/${items.length}:`, item);

                                promoStmt.run(
                                    [groupId, item.itemId, item.price, 1],
                                    function(err) {
                                        if (err) {
                                            console.error('Error inserting promotion:', err);
                                            hasError = true;
                                            db.run('ROLLBACK');
                                            db.close();
                                            reject(err);
                                        }
                                    }
                                );

                                // Add to supplier responses with the specified supplier ID
                                supplierStmt.run(
                                    [item.itemId, supplierId, item.price, 'Active', 1, `${name} (Promotion)`],
                                    function(err) {
                                        if (err) {
                                            console.error('Error inserting supplier response:', err);
                                            hasError = true;
                                            db.run('ROLLBACK');
                                            db.close();
                                            reject(err);
                                        }
                                    }
                                );
                            });

                            if (!hasError) {
                                promoStmt.finalize(err => {
                                    if (err) {
                                        console.error('Error finalizing promotion statement:', err);
                                        db.run('ROLLBACK');
                                        db.close();
                                        return reject(err);
                                    }

                                    supplierStmt.finalize(err => {
                                        if (err) {
                                            console.error('Error finalizing supplier response statement:', err);
                                            db.run('ROLLBACK');
                                            db.close();
                                            return reject(err);
                                        }

                                        console.log('Committing transaction...');
                                        db.run('COMMIT', err => {
                                            db.close();
                                            if (err) {
                                                console.error('Error committing transaction:', err);
                                                return reject(err);
                                            }
                                            console.log('Transaction committed successfully');
                                            resolve(groupId);
                                        });
                                    });
                                });
                            }
                        }
                    );
                });
            });
        } catch (error) {
            console.error('Error in createPromotionGroup:', error);
            if (db) db.close();
            throw error;
        }
    }

    static async updatePromotionGroup(groupId, { name, startDate, endDate, isActive }) {
        console.log('Updating promotion group:', { groupId, name, startDate, endDate, isActive });
        let db;
        try {
            db = await this.getDb();

            return new Promise((resolve, reject) => {
                console.log('Checking if promotion group exists...');
                db.get('SELECT * FROM PromotionGroup WHERE PromotionGroupID = ?', [groupId], (err, group) => {
                    if (err) {
                        console.error('Error checking promotion group:', err);
                        db.close();
                        return reject(err);
                    }
                    if (!group) {
                        console.log('Promotion group not found');
                        db.close();
                        return reject(new Error('Promotion group not found'));
                    }

                    console.log('Found promotion group, updating...');
                    const query = `
                        UPDATE PromotionGroup 
                        SET Name = ?,
                            StartDate = ?,
                            EndDate = ?,
                            IsActive = ?,
                            UpdatedAt = CURRENT_TIMESTAMP
                        WHERE PromotionGroupID = ?
                    `;

                    db.run(query, [name, startDate, endDate, isActive ? 1 : 0, groupId], function(err) {
                        db.close();
                        if (err) {
                            console.error('Error updating promotion group:', err);
                            reject(err);
                        } else {
                            console.log('Promotion group updated successfully');
                            resolve(this.changes);
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Error in updatePromotionGroup:', error);
            if (db) db.close();
            throw error;
        }
    }

    static async deletePromotionGroup(groupId) {
        console.log('Deleting promotion group:', groupId);
        let db;
        try {
            db = await this.getDb();

            return new Promise((resolve, reject) => {
                console.log('Checking if promotion group exists...');
                db.get('SELECT * FROM PromotionGroup WHERE PromotionGroupID = ?', [groupId], (err, group) => {
                    if (err) {
                        console.error('Error checking promotion group:', err);
                        db.close();
                        return reject(err);
                    }
                    if (!group) {
                        console.log('Promotion group not found');
                        db.close();
                        return reject(new Error('Promotion group not found'));
                    }

                    console.log('Found promotion group, deleting...');
                    if (group.ExcelFilePath && fs.existsSync(group.ExcelFilePath)) {
                        try {
                            fs.unlinkSync(group.ExcelFilePath);
                            console.log('Deleted Excel file:', group.ExcelFilePath);
                        } catch (unlinkError) {
                            console.error('Error deleting Excel file:', unlinkError);
                        }
                    }

                    const query = 'DELETE FROM PromotionGroup WHERE PromotionGroupID = ?';
                    
                    db.run(query, [groupId], function(err) {
                        db.close();
                        if (err) {
                            console.error('Error deleting promotion group:', err);
                            reject(err);
                        } else {
                            console.log('Promotion group deleted successfully');
                            resolve(this.changes);
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Error in deletePromotionGroup:', error);
            if (db) db.close();
            throw error;
        }
    }
}

module.exports = Promotion;
