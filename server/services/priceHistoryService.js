const debug = require('../utils/debug');
const BaseModel = require('../models/BaseModel');

class PriceHistoryService extends BaseModel {
    constructor(db) {
        super(db);
    }

    async recordPrice(itemId, supplierId, price, sourceType, sourceId, notes = null) {
        debug.log('Recording price:', {
            itemId,
            supplierId,
            price,
            sourceType,
            sourceId
        });

        return await this.executeTransaction(async () => {
            // Update supplier price list
            const priceListResult = await this.executeRun(`
                INSERT INTO supplier_price_list (
                    item_id,
                    supplier_id,
                    current_price,
                    is_promotion,
                    promotion_id,
                    notes,
                    last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(item_id, supplier_id) DO UPDATE SET
                    current_price = excluded.current_price,
                    is_promotion = excluded.is_promotion,
                    promotion_id = excluded.promotion_id,
                    notes = excluded.notes,
                    last_updated = excluded.last_updated;
            `, [
                itemId,
                supplierId,
                price,
                sourceType === 'promotion' ? 1 : 0,
                sourceType === 'promotion' ? sourceId : null,
                notes
            ]);

            // For promotions, get the latest non-promotion price history
            if (sourceType === 'promotion') {
                const latestHistory = await this.executeQuerySingle(`
                    SELECT ils_retail_price, qty_in_stock, qty_sold_this_year, qty_sold_last_year
                    FROM price_history
                    WHERE item_id = ?
                    ORDER BY date DESC
                    LIMIT 1
                `, [itemId]);

                await this.executeRun(`
                    INSERT INTO price_history (
                        item_id,
                        ils_retail_price,
                        qty_in_stock,
                        qty_sold_this_year,
                        qty_sold_last_year,
                        supplier_id,
                        source_type,
                        source_id,
                        date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    itemId,
                    latestHistory?.ils_retail_price || price,
                    latestHistory?.qty_in_stock || 0,
                    latestHistory?.qty_sold_this_year || 0,
                    latestHistory?.qty_sold_last_year || 0,
                    supplierId,
                    sourceType,
                    sourceId
                ]);
            } else {
                // For non-promotions, record new price history
                await this.executeRun(`
                    INSERT INTO price_history (
                        item_id,
                        ils_retail_price,
                        supplier_id,
                        source_type,
                        source_id,
                        date
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    itemId,
                    price,
                    supplierId,
                    sourceType,
                    sourceId
                ]);
            }

            return {
                success: true,
                changes: priceListResult.changes,
                message: 'Price recorded successfully'
            };
        });
    }

    async getPriceHistory(itemId, supplierId, dateRange = null) {
        // First get price history from supplier_price_list
        let sql = `
            WITH latest_price_history AS (
                SELECT 
                    item_id,
                    ils_retail_price,
                    qty_in_stock,
                    qty_sold_this_year as sold_this_year,
                    qty_sold_last_year as sold_last_year,
                    date,
                    ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY date DESC) as rn
                FROM price_history
            ),
            price_list_history AS (
                SELECT 
                    spl.item_id,
                    spl.supplier_id,
                    spl.current_price as price,
                    spl.last_updated as date,
                    CASE 
                        WHEN spl.is_promotion = 1 THEN p.name
                        ELSE NULL
                    END as source_name,
                    'price_list' as source_type,
                    s.name as supplier_name,
                    COALESCE(ph.qty_in_stock, 0) as qty_in_stock,
                    COALESCE(ph.qty_sold_this_year, 0) as sold_this_year,
                    COALESCE(ph.qty_sold_last_year, 0) as sold_last_year
                FROM supplier_price_list spl
                LEFT JOIN promotion p ON spl.is_promotion = 1 AND spl.promotion_id = p.promotion_id
                LEFT JOIN supplier s ON spl.supplier_id = s.supplier_id
                LEFT JOIN latest_price_history ph ON spl.item_id = ph.item_id AND ph.rn = 1
                WHERE spl.item_id = ? AND spl.supplier_id = ?
            ),
            supplier_response_history AS (
                SELECT 
                    sr.item_id,
                    sr.supplier_id,
                    sr.price_quoted as price,
                    sr.response_date as date,
                    sr.promotion_name as source_name,
                    'response' as source_type,
                    s.name as supplier_name,
                    COALESCE(ph.qty_in_stock, 0) as qty_in_stock,
                    COALESCE(ph.qty_sold_this_year, 0) as sold_this_year,
                    COALESCE(ph.qty_sold_last_year, 0) as sold_last_year
                FROM supplier_response sr
                LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
                LEFT JOIN latest_price_history ph ON sr.item_id = ph.item_id AND ph.rn = 1
                WHERE sr.item_id = ? 
                AND sr.supplier_id = ?
                AND sr.status = 'active'
            )
            SELECT * FROM price_list_history
            UNION ALL
            SELECT * FROM supplier_response_history
        `;
        const params = [itemId, supplierId, itemId, supplierId];

        if (dateRange) {
            sql += ` WHERE date BETWEEN ? AND ?`;
            params.push(dateRange.start, dateRange.end);
        }

        sql += ` ORDER BY date DESC`;

        return await this.executeQuery(sql, params);
    }

    async getCurrentPrice(itemId, supplierId) {
        const sql = `
            SELECT 
                spl.*,
                CASE 
                    WHEN spl.is_promotion = 1 THEN p.name
                    ELSE NULL
                END as promotion_name,
                CASE 
                    WHEN spl.is_promotion = 1 THEN p.end_date
                    ELSE NULL
                END as promotion_end_date
            FROM supplier_price_list spl
            LEFT JOIN promotion p ON spl.promotion_id = p.promotion_id
            WHERE spl.item_id = ? AND spl.supplier_id = ?
        `;
        return await this.executeQuerySingle(sql, [itemId, supplierId]);
    }

    async getSupplierPriceList(supplierId, includePromotions = true) {
        let sql = `
            SELECT 
                spl.*,
                i.hebrew_description,
                i.english_description,
                CASE 
                    WHEN spl.is_promotion = 1 THEN p.name
                    ELSE NULL
                END as promotion_name,
                CASE 
                    WHEN spl.is_promotion = 1 THEN p.end_date
                    ELSE NULL
                END as promotion_end_date
            FROM supplier_price_list spl
            LEFT JOIN item i ON spl.item_id = i.item_id
            LEFT JOIN promotion p ON spl.promotion_id = p.promotion_id
            WHERE spl.supplier_id = ?
        `;

        if (!includePromotions) {
            sql += ` AND spl.is_promotion = 0`;
        }

        sql += ` ORDER BY spl.item_id`;

        return await this.executeQuery(sql, [supplierId]);
    }

    async updatePriceList(items, supplierId, sourceType, sourceId) {
        debug.log('Updating price list:', {
            itemCount: items.length,
            supplierId,
            sourceType,
            sourceId
        });

        return await this.executeTransaction(async () => {
            for (const item of items) {
                await this.recordPrice(
                    item.item_id,
                    supplierId,
                    item.price,
                    sourceType,
                    sourceId,
                    item.notes
                );
            }

            return {
                success: true,
                message: `Updated ${items.length} prices successfully`
            };
        });
    }

    async cleanupExpiredPromotions() {
        const sql = `
            UPDATE supplier_price_list spl
            SET 
                is_promotion = 0,
                promotion_id = NULL,
                notes = 'Promotion expired'
            WHERE EXISTS (
                SELECT 1 FROM promotion p 
                WHERE spl.promotion_id = p.promotion_id 
                AND date('now') > date(p.end_date)
            )
        `;
        return await this.executeRun(sql);
    }
}

module.exports = PriceHistoryService;
