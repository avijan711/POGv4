const debug = require('../utils/debug');
const { cleanItemId } = require('../utils/itemIdCleaner');
const ExcelProcessor = require('../utils/excelProcessor');
const PromotionProcessor = require('../utils/excelProcessor/promotionProcessor');

class PromotionService {
    constructor(db) {
        if (!db) {
            throw new Error('Database instance is required');
        }
        this.db = db;
    }

    async processPromotionUpload(file, name, supplierId, startDate, endDate, columnMapping) {
        try {
            debug.log('Processing promotion upload:', {
                name,
                supplierId,
                startDate,
                endDate,
                columnMapping
            });

            // Process Excel file with column mapping
            const items = await PromotionProcessor.processFile(file.path, JSON.parse(columnMapping));
            if (!items || items.length === 0) {
                throw new Error('No valid items found in Excel file');
            }

            debug.log('Processed items from Excel:', items.length);

            // Start transaction
            await new Promise((resolve, reject) => {
                this.db.run('BEGIN TRANSACTION', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            try {
                // Insert promotion record
                const promotionId = await this.insertPromotion(name, supplierId, startDate, endDate);
                debug.log('Created promotion:', promotionId);

                // Insert promotion items
                const processedItems = await this.insertPromotionItems(promotionId, items);
                debug.log('Inserted items:', processedItems.length);

                // Commit transaction
                await new Promise((resolve, reject) => {
                    this.db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                return {
                    promotionId,
                    itemCount: processedItems.length,
                    message: 'Promotion uploaded successfully'
                };
            } catch (err) {
                await new Promise((resolve, reject) => {
                    this.db.run('ROLLBACK', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                throw err;
            }
        } catch (err) {
            debug.error('Error processing promotion upload:', err);
            throw err;
        }
    }

    async getExcelColumns(file) {
        try {
            return await PromotionProcessor.getColumns(file.path);
        } catch (err) {
            debug.error('Error getting Excel columns:', err);
            throw err;
        }
    }

    async insertPromotionItems(promotionId, items) {
        const processedItems = [];
        const errors = [];

        for (const item of items) {
            try {
                await this.insertPromotionItem(promotionId, item.item_id, item.price);
                processedItems.push(item);
            } catch (err) {
                errors.push(`Error inserting item ${item.item_id}: ${err.message}`);
            }
        }

        if (errors.length > 0) {
            debug.error('Errors during item insertion:', errors);
            throw new Error(`Failed to insert some items: ${errors.join('; ')}`);
        }

        return processedItems;
    }

    async insertPromotion(name, supplierId, startDate, endDate) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO promotion (
                    name, supplier_id, start_date, end_date, is_active
                ) VALUES (?, ?, ?, ?, 1)
            `;
            
            this.db.run(sql, [name, supplierId, startDate, endDate], function(err) {
                if (err) {
                    debug.error('Error inserting promotion:', err);
                    reject(err);
                    return;
                }
                resolve(this.lastID);
            });
        });
    }

    async insertPromotionItem(promotionId, itemId, price) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO promotion_item (
                    promotion_id, item_id, promotion_price
                ) VALUES (?, ?, ?)
            `;
            
            this.db.run(sql, [promotionId, itemId, price], function(err) {
                if (err) {
                    debug.error('Error inserting promotion item:', err);
                    reject(err);
                    return;
                }
                resolve(this.lastID);
            });
        });
    }

    async getPromotions() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    p.*,
                    s.name as supplier_name,
                    COUNT(pi.item_id) as item_count
                FROM promotion p
                LEFT JOIN supplier s ON p.supplier_id = s.supplier_id
                LEFT JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
                WHERE p.is_active = 1
                GROUP BY p.promotion_id
                ORDER BY p.created_at DESC
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    debug.error('Error fetching promotions:', err);
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    async getPromotionItems(promotionId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    pi.*,
                    i.hebrew_description,
                    i.english_description
                FROM promotion_item pi
                LEFT JOIN item i ON pi.item_id = i.item_id
                WHERE pi.promotion_id = ?
                ORDER BY pi.item_id
            `;

            this.db.all(sql, [promotionId], (err, rows) => {
                if (err) {
                    debug.error('Error fetching promotion items:', err);
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    async deletePromotion(promotionId) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE promotion 
                SET is_active = 0 
                WHERE promotion_id = ?
            `;

            this.db.run(sql, [promotionId], function(err) {
                if (err) {
                    debug.error('Error deleting promotion:', err);
                    reject(err);
                    return;
                }
                resolve({ deleted: this.changes > 0 });
            });
        });
    }
}

module.exports = PromotionService;
