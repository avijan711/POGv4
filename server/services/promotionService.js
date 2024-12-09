const debug = require('../utils/debug');
const { cleanItemId } = require('../utils/itemIdCleaner');
const ExcelProcessor = require('../utils/excelProcessor');
const PromotionProcessor = require('../utils/excelProcessor/promotionProcessor');
const BaseModel = require('../models/BaseModel');
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

        try {
            // Start transaction
            await this.db.run('BEGIN IMMEDIATE TRANSACTION');

            try {
                // First create the promotion record
                promotionId = await this.insertPromotion(name, supplierId, startDate, endDate);
                debug.log('Created promotion:', promotionId);

                // Create staging table
                await this.db.run(`
                    CREATE TEMP TABLE IF NOT EXISTS promotion_staging (
                        item_id TEXT NOT NULL,
                        price REAL NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_staging_item_id ON promotion_staging(item_id);
                `);

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

                    await this.db.run(`
                        INSERT INTO promotion_staging (item_id, price)
                        VALUES ${stagingValues};
                    `);
                }

                debug.log('Total rows:', totalCount);

                // Insert into supplier_response
                await this.db.run(`
                    INSERT INTO supplier_response (
                        inquiry_id,
                        supplier_id,
                        item_id,
                        price_quoted,
                        status,
                        is_promotion,
                        promotion_name
                    )
                    SELECT 
                        NULL,
                        ?,
                        s.item_id,
                        s.price,
                        'active',
                        1,
                        ?
                    FROM promotion_staging s;
                `, [supplierId, name]);

                // Insert into supplier_response_item
                await this.db.run(`
                    INSERT INTO supplier_response_item (
                        supplier_response_id,
                        item_id,
                        price,
                        new_reference_id
                    )
                    SELECT 
                        sr.supplier_response_id,
                        s.item_id,
                        s.price,
                        CASE 
                            WHEN EXISTS (SELECT 1 FROM item i WHERE i.item_id = s.item_id) 
                            THEN NULL 
                            ELSE s.item_id 
                        END
                    FROM promotion_staging s
                    JOIN supplier_response sr ON sr.item_id = s.item_id
                    WHERE sr.is_promotion = 1 
                    AND sr.promotion_name = ?;
                `, [name]);

                // Insert matched items into promotion_item
                const result = await this.db.run(`
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

                // Update price history for matched items
                await this.db.run(`
                    INSERT INTO price_history (
                        item_id,
                        ils_retail_price,
                        date
                    )
                    SELECT 
                        s.item_id,
                        s.price,
                        CURRENT_TIMESTAMP
                    FROM promotion_staging s
                    WHERE EXISTS (
                        SELECT 1 FROM item i WHERE i.item_id = s.item_id
                    );
                `);

                debug.log(`Processing completed:`, { total: totalCount, matchedCount });

                // Commit transaction
                await this.db.run('COMMIT');

                return {
                    promotionId,
                    totalCount,
                    matchedCount,
                    message: `Promotion uploaded successfully. ${matchedCount} items matched out of ${totalCount} total items.`
                };

            } catch (err) {
                // Rollback transaction on error
                await this.db.run('ROLLBACK');
                throw err;
            } finally {
                // Drop temporary table
                await this.db.run('DROP TABLE IF EXISTS promotion_staging');
            }
        } catch (err) {
            debug.error('Transaction error:', err);
            throw err;
        }
    }

    async getLatestPrice(itemId) {
        try {
            const sql = `
                WITH LatestPrices AS (
                    SELECT 
                        item_id,
                        price_quoted,
                        supplier_id,
                        promotion_name,
                        response_date,
                        ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY response_date DESC) as rn
                    FROM supplier_response
                    WHERE is_promotion = 1
                    AND item_id = ?
                )
                SELECT 
                    lp.item_id,
                    lp.price_quoted as price,
                    lp.promotion_name,
                    lp.supplier_id,
                    s.name as supplier_name,
                    lp.response_date as created_at
                FROM LatestPrices lp
                JOIN supplier s ON s.supplier_id = lp.supplier_id
                WHERE lp.rn = 1
            `;
            return await this.db.querySingle(sql, [itemId]);
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
                    sr.item_id,
                    sr.price_quoted as price,
                    sr.promotion_name,
                    sr.supplier_id,
                    s.name as supplier_name,
                    sr.response_date as created_at
                FROM supplier_response sr
                JOIN supplier s ON s.supplier_id = sr.supplier_id
                WHERE sr.is_promotion = 1
                AND sr.item_id = ?
                ORDER BY sr.response_date DESC
            `;
            return await this.db.query(sql, [itemId]);
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
            const sql = `
                -- Update supplier_response_item for newly matched items
                UPDATE supplier_response_item
                SET new_reference_id = NULL
                WHERE new_reference_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM item i 
                    WHERE i.item_id = supplier_response_item.item_id
                );

                -- Insert newly matched items into promotion_item
                INSERT INTO promotion_item (promotion_id, item_id, promotion_price)
                SELECT 
                    p.promotion_id,
                    sri.item_id,
                    sri.price
                FROM supplier_response_item sri
                JOIN supplier_response sr ON sr.supplier_response_id = sri.supplier_response_id
                JOIN promotion p ON p.name = sr.promotion_name
                WHERE sr.is_promotion = 1
                AND sri.new_reference_id IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM promotion_item pi 
                    WHERE pi.promotion_id = p.promotion_id 
                    AND pi.item_id = sri.item_id
                );

                -- Update price history for newly matched items
                INSERT INTO price_history (
                    item_id,
                    ils_retail_price,
                    date
                )
                SELECT 
                    sri.item_id,
                    sri.price,
                    CURRENT_TIMESTAMP
                FROM supplier_response_item sri
                JOIN supplier_response sr ON sr.supplier_response_id = sri.supplier_response_id
                WHERE sr.is_promotion = 1
                AND sri.new_reference_id IS NULL
                AND EXISTS (
                    SELECT 1 FROM item i WHERE i.item_id = sri.item_id
                );
            `;
            await this.db.run(sql);
            return { success: true };
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
            const supplierExists = await this.db.querySingle(
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
            
            const result = await this.db.run(sql, [name, supplierId, startDate, endDate]);
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
                        SELECT COUNT(DISTINCT sr.item_id)
                        FROM supplier_response sr
                        WHERE sr.is_promotion = 1
                        AND sr.promotion_name = p.name
                    ) as total_count
                FROM promotion p
                LEFT JOIN supplier s ON p.supplier_id = s.supplier_id
                LEFT JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
                WHERE p.is_active = 1
                GROUP BY p.promotion_id
                ORDER BY p.created_at DESC
            `;

            return await this.db.query(sql);
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
                        sr.item_id,
                        sr.price_quoted as promotion_price,
                        CASE WHEN sri.new_reference_id IS NULL THEN 1 ELSE 0 END as is_matched,
                        i.hebrew_description,
                        i.english_description
                    FROM supplier_response sr
                    JOIN supplier_response_item sri ON sri.supplier_response_id = sr.supplier_response_id
                    LEFT JOIN item i ON i.item_id = sr.item_id
                    WHERE sr.is_promotion = 1
                    AND sr.promotion_name = (
                        SELECT name FROM promotion WHERE promotion_id = ?
                    )
                    ORDER BY sr.item_id
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

            return await this.db.query(sql, [promotionId]);
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

            const result = await this.db.run(sql, [promotionId]);
            
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
