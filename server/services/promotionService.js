const debug = require('../utils/debug');
const { cleanItemId } = require('../utils/itemIdCleaner');
const ExcelProcessor = require('../utils/excelProcessor');
const PromotionProcessor = require('../utils/excelProcessor/promotionProcessor');
const BaseModel = require('../models/BaseModel');
const PriceHistoryService = require('./priceHistoryService');
const path = require('path');
const fs = require('fs');

// SQL Query Constants
const SQL = {
    CREATE_INDEXES: `
        CREATE INDEX IF NOT EXISTS idx_spl_promotion ON supplier_price_list(promotion_id);
        CREATE INDEX IF NOT EXISTS idx_spl_item ON supplier_price_list(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_desc ON item(hebrew_description, english_description);
    `,
    GET_PROMOTIONS: `
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
    `,
    COUNT_PROMOTION_ITEMS: `
        SELECT COUNT(*) as total
        FROM supplier_price_list spl
        LEFT JOIN item i ON spl.item_id = i.item_id
        WHERE spl.is_promotion = 1
        AND spl.promotion_id = ?
    `,
    GET_PROMOTION_ITEMS: `
        SELECT 
            spl.item_id,
            spl.current_price as promotion_price,
            i.hebrew_description,
            i.english_description,
            p.name as promotion_name,
            p.start_date as response_date,
            1 as is_promotion,
            '' as notes,
            CASE WHEN pi.item_id IS NOT NULL THEN 1 ELSE 0 END as is_matched
        FROM supplier_price_list spl
        JOIN promotion p ON spl.promotion_id = p.promotion_id
        LEFT JOIN item i ON spl.item_id = i.item_id
        LEFT JOIN promotion_item pi ON spl.item_id = pi.item_id 
            AND spl.promotion_id = pi.promotion_id
        WHERE spl.is_promotion = 1
        AND spl.promotion_id = ?
    `,
    SEARCH_CONDITION: `
        AND (
            spl.item_id LIKE ? 
            OR i.hebrew_description LIKE ? 
            OR i.english_description LIKE ?
        )
    `
};

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
        this.tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // Helper Methods
    async ensureIndexes() {
        try {
            await this.executeRun(SQL.CREATE_INDEXES);
        } catch (err) {
            debug.error('Error creating indexes:', err);
            // Non-critical error, continue execution
        }
    }

    buildSearchParams(promotionId, search) {
        if (!search) {
            return {
                sql: '',
                params: [promotionId]
            };
        }

        return {
            sql: SQL.SEARCH_CONDITION,
            params: [promotionId, `%${search}%`, `%${search}%`, `%${search}%`]
        };
    }

    // Main Methods
    async getPromotions() {
        try {
            debug.log('Getting all promotions');
            return await this.executeQuery(SQL.GET_PROMOTIONS);
        } catch (err) {
            debug.error('Error fetching promotions:', err);
            throw new PromotionError(
                'Failed to fetch promotions',
                'PROMOTION_FETCH_ERROR',
                { originalError: err.message }
            );
        }
    }

    async getPromotionItems(promotionId, { page = 1, pageSize = 5000, search = '' } = {}) {
        try {
            debug.log('Getting promotion items:', { promotionId, page, pageSize, search });

            // Ensure indexes exist for better performance
            await this.ensureIndexes();

            // Build search parameters
            const searchParams = this.buildSearchParams(promotionId, search);

            // Get total count
            const countSql = SQL.COUNT_PROMOTION_ITEMS + searchParams.sql;
            const totalResult = await this.executeQuerySingle(countSql, searchParams.params);
            const total = totalResult.total;

            debug.log('Total items:', total);

            // Get paginated items
            const offset = (page - 1) * pageSize;
            const itemsSql = SQL.GET_PROMOTION_ITEMS + 
                searchParams.sql + 
                ' ORDER BY spl.item_id LIMIT ? OFFSET ?';

            const itemsParams = [...searchParams.params, pageSize, offset];
            const items = await this.executeQuery(itemsSql, itemsParams);

            debug.log(`Found ${items.length} items for promotion ${promotionId} (page ${page})`);

            return {
                items,
                pagination: {
                    total,
                    page,
                    pageSize,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (err) {
            debug.error('Error fetching promotion items:', err);
            throw new PromotionError(
                'Failed to fetch promotion items',
                'PROMOTION_ITEMS_FETCH_ERROR',
                { originalError: err.message }
            );
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

                // Debug: Check staging table contents
                const stagingItems = await this.executeQuery(`
                    SELECT COUNT(*) as count FROM promotion_staging
                `);
                debug.log('Staging table count:', stagingItems[0].count);

                // Insert matched items into promotion_item (only for existing items)
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
                debug.log('Inserted into promotion_item:', matchedCount);

                // Debug: Check existing supplier prices
                const existingPrices = await this.executeQuery(`
                    SELECT COUNT(*) as count FROM supplier_price_list 
                    WHERE supplier_id = ? AND is_promotion = 1
                `, [supplierId]);
                debug.log('Existing supplier prices:', existingPrices[0].count);

                // Insert ALL items into supplier_price_list, even if they don't exist in item table yet
                const priceListResult = await this.executeRun(`
                    INSERT OR REPLACE INTO supplier_price_list (
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
                    FROM promotion_staging s;
                `, [supplierId, promotionId]);

                debug.log('Updated supplier_price_list:', priceListResult.changes);

                // Debug: Check final counts
                const finalPrices = await this.executeQuery(`
                    SELECT COUNT(*) as count FROM supplier_price_list 
                    WHERE supplier_id = ? AND promotion_id = ?
                `, [supplierId, promotionId]);
                debug.log('Final supplier prices for this promotion:', finalPrices[0].count);

                debug.log(`Processing completed:`, { 
                    total: totalCount, 
                    matchedCount,
                    priceListUpdates: priceListResult.changes,
                    finalPriceCount: finalPrices[0].count
                });

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
