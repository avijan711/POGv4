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
        supplierId,   // For supplier filter
      ];

      debug.log('Executing count query with params:', countParams);
      const countResult = await this.executeQuerySingle(
        getSupplierPricesCountQuery,
        countParams,
      );
      const total = countResult ? countResult.total : 0;

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
        offset,
      ];

      debug.log('Executing prices query with params:', queryParams);
      const rows = await this.executeQuery(
        getSupplierPricesQuery,
        queryParams,
      );

      debug.log('Price query returned:', {
        rowCount: rows ? rows.length : 0,
        firstRow: rows ? rows[0] : null,
        params: {
          itemId: itemId,
          fromDate: fromDate,
          supplierId: supplierId,
          limit: limit,
          offset: offset,
        },
      });

      // Validate and normalize rows
      const validatedRows = (rows || []).map(function(row) {
        return {
          item_id: row.item_id,
          supplier_id: row.supplier_id,
          // Supplier prices (EUR)
          supplier_price_eur: row.supplier_price_eur || 0,
          // Supplier prices (ILS)
          supplier_price_ils: row.supplier_price_ils || 0,
          // Retail price (ILS)
          ils_retail_price: row.ils_retail_price || 0,
          // Other fields
          date: row.date || row.response_date || new Date().toISOString(),
          supplier_name: row.supplier_name || 'Unknown Supplier',
          is_promotion: Boolean(row.is_promotion),
          promotion_name: row.promotion_name || null,
          notes: row.notes || null,
          status: row.status || 'active',
          import_markup: row.import_markup,
        };
      });

      const hasMore = total > offset + validatedRows.length;

      debug.log('Returning supplier prices result:', {
        total: total,
        hasMore: hasMore,
        rowCount: validatedRows.length,
        firstPrice: validatedRows[0],
      });

      return {
        prices: validatedRows,
        hasMore: hasMore,
        total: total,
      };
    } catch (err) {
      debug.error('Error in getSupplierPrices:', {
        error: err,
        stack: err.stack,
        params: { itemId: itemId, limit: limit, offset: offset, fromDate: fromDate, supplierId: supplierId },
      });
      throw err;
    }
  }

  async addPriceHistory(itemId, supplierId, supplierPriceEur, retailPriceIls, effectiveDate, sourceType, sourceId, notes) {
    debug.log('Adding price history:', {
      itemId: itemId,
      supplierId: supplierId,
      supplierPriceEur: supplierPriceEur,
      retailPriceIls: retailPriceIls,
      effectiveDate: effectiveDate,
      sourceType: sourceType,
      sourceId: sourceId,
      notes: notes,
    });

    return await this.executeTransaction(async () => {
      // Validate inputs
      if (!itemId || !supplierId || typeof supplierPriceEur !== 'number') {
        throw new Error('Invalid price history parameters');
      }

      // Get exchange rate
      const exchangeRate = await this.executeQuerySingle(
        'SELECT CAST(value AS DECIMAL(10,2)) as rate FROM settings WHERE key = ?',
        ['eur_ils_rate'],
      );
      const eurIlsRate = exchangeRate ? exchangeRate.rate : 3.75; // Default rate if not found

      // Calculate supplier price in ILS
      const supplierPriceIls = supplierPriceEur * eurIlsRate;

      // Add to price history if retail price is provided
      if (retailPriceIls != null) {
        await this.executeRun(`
          INSERT INTO price_history (
            item_id,
            supplier_id,
            supplier_price,
            ils_retail_price,
            source_type,
            source_id,
            notes,
            date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          itemId,
          supplierId,
          supplierPriceIls,
          retailPriceIls,
          sourceType,
          sourceId,
          notes,
          effectiveDate || new Date().toISOString(),
        ]);
      }

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
        supplierPriceEur,
        sourceType === 'promotion' ? 1 : 0,
        sourceType === 'promotion' ? sourceId : null,
        notes,
      ]);

      debug.log('Price history added successfully:', {
        itemId: itemId,
        supplierId: supplierId,
        supplierPriceEur: supplierPriceEur,
        supplierPriceIls: supplierPriceIls,
        retailPriceIls: retailPriceIls,
      });

      return {
        success: true,
        message: 'Price history updated successfully',
      };
    });
  }

  async updateSupplierPriceList(itemId, supplierId, supplierPriceEur, isPromotion, promotionId, notes) {
    debug.log('Updating supplier price list:', {
      itemId: itemId,
      supplierId: supplierId,
      supplierPriceEur: supplierPriceEur,
      isPromotion: isPromotion,
      promotionId: promotionId,
      notes: notes,
    });

    return await this.executeTransaction(async () => {
      // Validate inputs
      if (!itemId || !supplierId || typeof supplierPriceEur !== 'number') {
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
        supplierPriceEur,
        isPromotion ? 1 : 0,
        promotionId,
        notes,
      ]);

      debug.log('Supplier price list updated successfully:', {
        changes: result.changes,
        itemId: itemId,
        supplierId: supplierId,
      });

      return {
        success: true,
        changes: result.changes,
        message: 'Supplier price list updated successfully',
      };
    });
  }
}

module.exports = SupplierPricesService;
