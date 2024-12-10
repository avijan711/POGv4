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

            // Only update retail price history if it's not a promotion
            if (sourceType !== 'promotion') {
                await this.executeRun(`
                    INSERT INTO price_history (
                        item_id,
                        ils_retail_price,
                        date
                    ) VALUES (?, ?, CURRENT_TIMESTAMP)
                `, [
                    itemId,
                    price
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
        let sql = `
            SELECT 
                spl.*,
                CASE 
                    WHEN spl.is_promotion = 1 THEN p.name
                    ELSE NULL
                END as source_name
            FROM supplier_price_list spl
            LEFT JOIN promotion p ON spl.is_promotion = 1 AND spl.promotion_id = p.promotion_id
            WHERE spl.item_id = ? AND spl.supplier_id = ?
        `;
        const params = [itemId, supplierId];

        if (dateRange) {
            sql += ` AND spl.last_updated BETWEEN ? AND ?`;
            params.push(dateRange.start, dateRange.end);
        }

        sql += ` ORDER BY spl.last_updated DESC`;

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
