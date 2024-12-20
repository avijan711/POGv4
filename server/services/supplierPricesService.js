const BaseModel = require('../models/BaseModel');
const SupplierModel = require('../models/supplier');
const { getSupplierPricesQuery, getSupplierPricesCountQuery } = require('../models/queries/supplier-prices');
const debug = require('../utils/debug');

class SupplierPricesService extends BaseModel {
    constructor(dal) {
        super(dal);
        this.supplierModel = new SupplierModel(dal);
    }

    async getSuppliers() {
        try {
            return await this.supplierModel.getAllSuppliers();
        } catch (err) {
            debug.error('Error fetching suppliers:', err);
            throw err;
        }
    }

    async getSupplierPrices(itemId, { limit = 10, offset = 0, fromDate = null, supplierId = null }) {
        debug.log('Getting supplier prices with params:', { itemId, limit, offset, fromDate, supplierId });
        
        try {
            // First verify the item exists
            const itemCheckSql = 'SELECT item_id FROM item WHERE item_id = ?';
            const item = await this.executeQuerySingle(itemCheckSql, [itemId]);
            
            if (!item) {
                debug.error('Item not found:', itemId);
                throw new Error(`Item not found: ${itemId}`);
            }

            // Get total count
            const countParams = [
                itemId,  // For supplier_price_list
                itemId,  // For supplier_response
                fromDate,  // For date filter
                fromDate,  // For date filter
                supplierId,  // For supplier filter
                supplierId   // For supplier filter
            ];

            debug.log('Executing count query with params:', countParams);
            const countResult = await this.executeQuerySingle(
                getSupplierPricesCountQuery,
                countParams
            );
            const total = countResult?.total || 0;

            debug.log('Count query returned:', { total });

            // Get prices
            const queryParams = [
                itemId,  // For supplier_price_list
                itemId,  // For supplier_response
                fromDate,  // For date filter
                fromDate,  // For date filter
                supplierId,  // For supplier filter
                supplierId,  // For supplier filter
                limit,
                offset
            ];

            debug.log('Executing prices query with params:', queryParams);
            const rows = await this.executeQuery(
                getSupplierPricesQuery,
                queryParams
            );

            debug.log('Price query returned:', {
                rowCount: rows?.length || 0,
                firstRow: rows?.[0],
                params: {
                    itemId,
                    fromDate,
                    supplierId,
                    limit,
                    offset
                }
            });

            // Validate and normalize rows
            const validatedRows = (rows || []).map(row => ({
                ...row,
                price_eur: row.price_eur || row.price_quoted || 0,
                date: row.date || row.response_date || new Date().toISOString(),
                supplier_name: row.supplier_name || 'Unknown Supplier',
                is_promotion: !!row.is_promotion,
                promotion_name: row.promotion_name || null,
                cost_ils: row.cost_ils || 0,
                discount_percentage: row.discount_percentage || 0,
                status: row.status || 'active'
            }));

            const hasMore = total > offset + validatedRows.length;

            debug.log('Returning supplier prices result:', {
                total,
                hasMore,
                rowCount: validatedRows.length,
                firstPrice: validatedRows[0]
            });

            return {
                prices: validatedRows,
                hasMore,
                total
            };
        } catch (err) {
            debug.error('Error in getSupplierPrices:', {
                error: err,
                stack: err.stack,
                params: { itemId, limit, offset, fromDate, supplierId }
            });
            throw err;
        }
    }

    async addPriceHistory(itemId, supplierId, price, effectiveDate, sourceType, sourceId = null, notes = null) {
        debug.log('Adding price history:', {
            itemId,
            supplierId,
            price,
            effectiveDate,
            sourceType,
            sourceId,
            notes
        });

        return await this.executeTransaction(async () => {
            // Validate inputs
            if (!itemId || !supplierId || typeof price !== 'number') {
                throw new Error('Invalid price history parameters');
            }

            // Add to price history
            const historyResult = await this.executeRun(`
                INSERT INTO price_history (
                    item_id,
                    ils_retail_price,
                    date
                ) VALUES (?, ?, ?);
            `, [
                itemId,
                price,
                effectiveDate || new Date().toISOString()
            ]);

            // Update supplier price list
            await this.executeRun(`
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

            debug.log('Price history added successfully:', {
                historyId: historyResult.lastID,
                itemId,
                supplierId
            });

            return {
                success: true,
                historyId: historyResult.lastID,
                message: 'Price history updated successfully'
            };
        });
    }

    async updateSupplierPriceList(itemId, supplierId, currentPrice, isPromotion = false, promotionId = null, notes = null) {
        debug.log('Updating supplier price list:', {
            itemId,
            supplierId,
            currentPrice,
            isPromotion,
            promotionId,
            notes
        });

        return await this.executeTransaction(async () => {
            // Validate inputs
            if (!itemId || !supplierId || typeof currentPrice !== 'number') {
                throw new Error('Invalid supplier price list parameters');
            }

            const result = await this.executeRun(`
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
                currentPrice,
                isPromotion ? 1 : 0,
                promotionId,
                notes
            ]);

            // Also record in price history
            await this.executeRun(`
                INSERT INTO price_history (
                    item_id,
                    ils_retail_price,
                    date
                ) VALUES (?, ?, date('now'));
            `, [
                itemId,
                currentPrice
            ]);

            debug.log('Supplier price list updated successfully:', {
                changes: result.changes,
                itemId,
                supplierId
            });

            return {
                success: true,
                changes: result.changes,
                message: 'Supplier price list updated successfully'
            };
        });
    }
}

module.exports = SupplierPricesService;
