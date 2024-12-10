const debug = require('../utils/debug');
const { cleanItemId } = require('../utils/itemIdCleaner');
const ExcelProcessor = require('../utils/excelProcessor');
const PromotionProcessor = require('../utils/excelProcessor/promotionProcessor');
const BaseModel = require('../models/BaseModel');
const PriceHistoryService = require('./priceHistoryService');
const path = require('path');
const fs = require('fs');

class PromotionError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.name = 'PromotionError';
        this.code = code;
        this.details = details;
    }
}

class PromotionService extends BaseModel {
    constructor(db) {
        super(db);
        this.priceHistoryService = new PriceHistoryService(db);
        // Ensure temp directory exists
        this.tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async processPromotionUpload(file, name, supplierId, startDate, endDate, columnMapping) {
        debug.log('Processing promotion upload:', {
            name,
            supplierId,
            startDate,
            endDate
        });

        let promotionId;
        let totalCount = 0;
        let matchedCount = 0;
        let stagingCreated = false;

        try {
            return await this.executeTransaction(async () => {
                // First create the promotion record
                promotionId = await this.insertPromotion(name, supplierId, startDate, endDate);
                debug.log('Created promotion:', promotionId);

                // Create staging table
                await this.executeRun(`
                    CREATE TEMP TABLE IF NOT EXISTS promotion_staging (
                        item_id TEXT NOT NULL,
                        price REAL NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_staging_item_id ON promotion_staging(item_id);
                `);
                stagingCreated = true;

                // Process Excel file and insert data directly
                const processor = PromotionProcessor.processFileInChunks(file.path, JSON.parse(columnMapping));
                
                for await (const chunk of processor) {
                    const { items } = chunk;
                    if (items.length === 0) continue;

                    totalCount += items.length;

                    // Insert items into staging table
                    const stagingValues = items.map(item => {
                        const cleanedId = cleanItemId(item.item_id);
                        return `('${cleanedId}', ${item.price})`;
                    }).join(',');

                    await this.executeRun(`
                        INSERT INTO promotion_staging (item_id, price)
                        VALUES ${stagingValues};
                    `);
                }

                debug.log('Total rows:', totalCount);

                // Insert matched items into promotion_item
                const result = await this.executeRun(`
                    INSERT INTO promotion_item (promotion_id, item_id, promotion_price)
                    SELECT 
                        ?,
                        s.item_id,
                        s.price
                    FROM promotion_staging s
                    WHERE EXISTS (
                        SELECT 1 FROM item i WHERE i.item_id = s.item_id
                    );
                `, [promotionId]);

                matchedCount = result.changes;

                // Update supplier_price_list for matched items
                await this.executeRun(`
                    INSERT INTO supplier_price_list (
                        item_id,
                        supplier_id,
                        current_price,
                        is_promotion,
                        promotion_id,
                        last_updated
                    )
                    SELECT 
                        s.item_id,
                        ?,
                        s.price,
                        1,
                        ?,
                        CURRENT_TIMESTAMP
                    FROM promotion_staging s
                    WHERE EXISTS (
                        SELECT 1 FROM item i WHERE i.item_id = s.item_id
                    )
                    ON CONFLICT(item_id, supplier_id) DO UPDATE SET
                        current_price = excluded.current_price,
                        is_promotion = excluded.is_promotion,
                        promotion_id = excluded.promotion_id,
                        last_updated = excluded.last_updated;
                `, [supplierId, promotionId]);

                // Update price history for matched items
                const matchedItems = await this.executeQuery(`
                    SELECT item_id, price
                    FROM promotion_staging s
                    WHERE EXISTS (
                        SELECT 1 FROM item i WHERE i.item_id = s.item_id
                    );
                `);

                for (const item of matchedItems) {
                    await this.executeRun(`
                        INSERT INTO price_history (
                            item_id,
                            price,
                            effective_date,
                            source_type,
                            source_id,
                            notes
                        ) VALUES (?, ?, ?, 'promotion', ?, ?)
                    `, [
                        item.item_id,
                        item.price,
                        startDate,
                        promotionId,
                        `Promotion: ${name}`
                    ]);
                }

                debug.log(`Processing completed:`, { total: totalCount, matchedCount });

                return {
                    promotionId,
                    totalCount,
                    matchedCount,
                    message: `Promotion uploaded successfully. ${matchedCount} items matched out of ${totalCount} total items.`
                };
            });
        } catch (err) {
            debug.error('Transaction error:', err);
            throw err;
        } finally {
            // Clean up staging table if it was created
            if (stagingCreated) {
                try {
                    await this.executeRun('DROP TABLE IF EXISTS promotion_staging');
                } catch (err) {
                    debug.error('Error dropping staging table:', err);
                }
            }
        }
    }

    async getLatestPrice(itemId) {
        try {
            const sql = `
                WITH LatestPrices AS (
                    SELECT 
                        item_id,
                        current_price as price,
                        supplier_id,
                        promotion_id,
                        last_updated,
                        ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY last_updated DESC) as rn
                    FROM supplier_price_list
                    WHERE is_promotion = 1
                    AND item_id = ?
                )
                SELECT 
                    lp.item_id,
                    lp.price,
                    p.name as promotion_name,
                    lp.supplier_id,
                    s.name as supplier_name,
                    lp.last_updated as created_at
                FROM LatestPrices lp
                JOIN supplier s ON s.supplier_id = lp.supplier_id
                JOIN promotion p ON p.promotion_id = lp.promotion_id
                WHERE lp.rn = 1
            `;
            return await this.executeQuerySingle(sql, [itemId]);
        } catch (err) {
            debug.error('Error getting latest price:', err);
            throw new PromotionError(
                'Failed to get latest price',
                'PRICE_FETCH_ERROR',
                { originalError: err.message }
            );
        }
    }

    async getPriceHistory(itemId) {
        try {
            const sql = `
                SELECT 
                    ph.item_id,
                    ph.price,
                    p.name as promotion_name,
                    ph.supplier_id,
                    s.name as supplier_name,
                    ph.effective_date as created_at
                FROM price_history ph
                JOIN supplier s ON s.supplier_id = ph.supplier_id
                LEFT JOIN promotion p ON p.promotion_id = ph.source_id
                WHERE ph.source_type = 'promotion'
                AND ph.item_id = ?
                ORDER BY ph.effective_date DESC
            `;
            return await this.executeQuery(sql, [itemId]);
        } catch (err) {
            debug.error('Error getting price history:', err);
            throw new PromotionError(
                'Failed to get price history',
                'HISTORY_FETCH_ERROR',
                { originalError: err.message }
            );
        }
    }

    async syncUnmatchedItems() {
        try {
            return await this.executeTransaction(async () => {
                // Insert newly matched items into promotion_item
                await this.executeRun(`
                    INSERT INTO promotion_item (promotion_id, item_id, promotion_price)
                    SELECT 
                        spl.promotion_id,
                        spl.item_id,
                        spl.current_price
                    FROM supplier_price_list spl
                    WHERE spl.is_promotion = 1
                    AND EXISTS (
                        SELECT 1 FROM item i WHERE i.item_id = spl.item_id
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM promotion_item pi 
                        WHERE pi.promotion_id = spl.promotion_id 
                        AND pi.item_id = spl.item_id
                    );
                `);

                // Update price history for newly matched items
                await this.executeRun(`
                    INSERT INTO price_history (
                        item_id,
                        price,
                        effective_date,
                        source_type,
                        source_id,
                        notes
                    )
                    SELECT 
                        spl.item_id,
                        spl.current_price,
                        p.start_date,
                        'promotion',
                        p.promotion_id,
                        'Synced from promotion: ' || p.name
                    FROM supplier_price_list spl
                    JOIN promotion p ON p.promotion_id = spl.promotion_id
                    WHERE spl.is_promotion = 1
                    AND EXISTS (
                        SELECT 1 FROM item i WHERE i.item_id = spl.item_id
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM price_history ph
                        WHERE ph.item_id = spl.item_id
                        AND ph.source_type = 'promotion'
                        AND ph.source_id = p.promotion_id
                    );
                `);

                return { success: true };
            });
        } catch (err) {
            debug.error('Error syncing unmatched items:', err);
            throw new PromotionError(
                'Failed to sync unmatched items',
                'SYNC_ERROR',
                { originalError: err.message }
            );
        }
    }

    async insertPromotion(name, supplierId, startDate, endDate) {
        try {
            // Validate supplier exists
            const supplierExists = await this.executeQuerySingle(
                'SELECT supplier_id FROM supplier WHERE supplier_id = ?',
                [supplierId]
            );

            if (!supplierExists) {
                throw new PromotionError(
                    'Supplier does not exist',
                    'INVALID_SUPPLIER_ERROR',
                    { supplierId }
                );
            }

            const sql = `
                INSERT INTO promotion (
                    name, supplier_id, start_date, end_date, is_active
                ) VALUES (?, ?, ?, ?, 1)
            `;
            
            const result = await this.executeRun(sql, [name, supplierId, startDate, endDate]);
            return result.lastID;
        } catch (err) {
            debug.error('Error inserting promotion:', err);
            
            if (err.message && err.message.includes('SQLITE_CONSTRAINT')) {
                if (err.message.includes('UNIQUE')) {
                    throw new PromotionError(
                        'Promotion with this name already exists',
                        'UNIQUE_CONSTRAINT_ERROR',
                        { originalError: err.message }
                    );
                }
                if (err.message.includes('FOREIGN KEY')) {
                    throw new PromotionError(
                        'Invalid supplier reference',
                        'FOREIGN_KEY_ERROR',
                        { originalError: err.message }
                    );
                }
                throw new PromotionError(
                    'Database constraint violation',
                    'CONSTRAINT_ERROR',
                    { originalError: err.message }
                );
            }

            if (err instanceof PromotionError) {
                throw err;
            }

            throw new PromotionError(
                'Failed to create promotion record',
                'PROMOTION_CREATION_ERROR',
                { originalError: err.message }
            );
        }
    }

    async getExcelColumns(file) {
        try {
            return await PromotionProcessor.getColumns(file.path);
        } catch (err) {
            debug.error('Error getting Excel columns:', err);
            throw new PromotionError(
                'Failed to read Excel columns',
                'EXCEL_COLUMN_ERROR',
                { originalError: err.message }
            );
        }
    }

    async getPromotions() {
        try {
            const sql = `
                SELECT 
                    p.*,
                    s.name as supplier_name,
                    COUNT(DISTINCT pi.item_id) as matched_count,
                    (
                        SELECT COUNT(DISTINCT spl.item_id)
                        FROM supplier_price_list spl
                        WHERE spl.is_promotion = 1
                        AND spl.promotion_id = p.promotion_id
                    ) as total_count
                FROM promotion p
                LEFT JOIN supplier s ON p.supplier_id = s.supplier_id
                LEFT JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
                WHERE p.is_active = 1
                GROUP BY p.promotion_id
                ORDER BY p.created_at DESC
            `;

            return await this.executeQuery(sql);
        } catch (err) {
            debug.error('Error fetching promotions:', err);
            throw new PromotionError(
                'Failed to fetch promotions',
                'PROMOTION_FETCH_ERROR',
                { originalError: err.message }
            );
        }
    }

    async getPromotionItems(promotionId, includeUnmatched = false) {
        try {
            let sql;
            if (includeUnmatched) {
                sql = `
                    SELECT 
                        spl.item_id,
                        spl.current_price as promotion_price,
                        CASE WHEN i.item_id IS NOT NULL THEN 1 ELSE 0 END as is_matched,
                        i.hebrew_description,
                        i.english_description
                    FROM supplier_price_list spl
                    LEFT JOIN item i ON i.item_id = spl.item_id
                    WHERE spl.is_promotion = 1
                    AND spl.promotion_id = ?
                    ORDER BY spl.item_id
                `;
            } else {
                sql = `
                    SELECT 
                        pi.*,
                        i.hebrew_description,
                        i.english_description
                    FROM promotion_item pi
                    LEFT JOIN item i ON pi.item_id = i.item_id
                    WHERE pi.promotion_id = ?
                    ORDER BY pi.item_id
                `;
            }

            return await this.executeQuery(sql, [promotionId]);
        } catch (err) {
            debug.error('Error fetching promotion items:', err);
            throw new PromotionError(
                'Failed to fetch promotion items',
                'PROMOTION_ITEMS_FETCH_ERROR',
                { originalError: err.message }
            );
        }
    }

    async deletePromotion(promotionId) {
        try {
            const sql = `
                UPDATE promotion 
                SET is_active = 0 
                WHERE promotion_id = ?
            `;

            const result = await this.executeRun(sql, [promotionId]);
            
            if (result.changes === 0) {
                throw new PromotionError(
                    'Promotion not found',
                    'PROMOTION_NOT_FOUND_ERROR',
                    { promotionId }
                );
            }

            return { success: true };
        } catch (err) {
            debug.error('Error deleting promotion:', err);
            throw new PromotionError(
                'Failed to delete promotion',
                'PROMOTION_DELETE_ERROR',
                { originalError: err.message }
            );
        }
    }
}

module.exports = PromotionService;
