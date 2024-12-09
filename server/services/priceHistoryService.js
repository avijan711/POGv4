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

        try {
            await this.beginTransaction();

            // Add to price history
            const historyResult = await this.executeRun(`
                INSERT INTO price_history (
                    item_id,
                    supplier_id,
                    price,
                    effective_date,
                    source_type,
                    source_id,
                    notes
                ) VALUES (?, ?, ?, date('now'), ?, ?, ?)
            `, [itemId, supplierId, price, sourceType, sourceId, notes]);

            // Update supplier price list
            const priceListResult = await this.executeRun(`
                INSERT INTO supplier_price_list (
                    item_id,
                    supplier_id,
                    current_price,
                    is_promotion,
                    promotion_id,
                    notes
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(item_id, supplier_id) DO UPDATE SET
                    current_price = excluded.current_price,
                    is_promotion = excluded.is_promotion,
                    promotion_id = excluded.promotion_id,
                    last_updated = CURRENT_TIMESTAMP,
                    notes = excluded.notes
            `, [
                itemId,
                supplierId,
                price,
                sourceType === 'promotion' ? 1 : 0,
                sourceType === 'promotion' ? sourceId : null,
                notes
            ]);

            await this.commitTransaction();

            return {
                success: true,
                historyId: historyResult.lastID,
                message: 'Price recorded successfully'
            };
        } catch (error) {
            await this.rollbackTransaction();
            debug.error('Error recording price:', error);
            throw error;
        }
    }

    async getPriceHistory(itemId, supplierId, dateRange = null) {
        let sql = `
            SELECT 
                ph.*,
                CASE 
                    WHEN ph.source_type = 'inquiry' THEN i.name
                    WHEN ph.source_type = 'promotion' THEN p.name
                    ELSE NULL
                END as source_name
            FROM price_history ph
            LEFT JOIN inquiry i ON ph.source_type = 'inquiry' AND ph.source_id = i.inquiry_id
            LEFT JOIN promotion p ON ph.source_type = 'promotion' AND ph.source_id = p.promotion_id
            WHERE ph.item_id = ? AND ph.supplier_id = ?
        `;
        const params = [itemId, supplierId];

        if (dateRange) {
            sql += ` AND ph.effective_date BETWEEN ? AND ?`;
            params.push(dateRange.start, dateRange.end);
        }

        sql += ` ORDER BY ph.effective_date DESC, ph.created_at DESC`;

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

        try {
            await this.beginTransaction();

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

            await this.commitTransaction();

            return {
                success: true,
                message: `Updated ${items.length} prices successfully`
            };
        } catch (error) {
            await this.rollbackTransaction();
            debug.error('Error updating price list:', error);
            throw error;
        }
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
