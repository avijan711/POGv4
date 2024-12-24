const debug = require('../../utils/debug');
const { getSupplierResponsesQueries } = require('../../models/queries/supplier-responses');
const { DatabaseAccessLayer } = require('../../config/database');

class ResponseQueries {
  constructor(db) {
    this.db = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    this.queries = getSupplierResponsesQueries();
  }

  async beginTransaction() {
    try {
      await this.db.run('BEGIN TRANSACTION');
      debug.log('Transaction started');
    } catch (err) {
      debug.error('Error starting transaction:', err);
      throw err;
    }
  }

  async commitTransaction() {
    try {
      await this.db.run('COMMIT');
      debug.log('Transaction committed');
    } catch (err) {
      debug.error('Error committing transaction:', err);
      throw err;
    }
  }

  async rollbackTransaction() {
    try {
      await this.db.run('ROLLBACK');
      debug.log('Transaction rolled back');
    } catch (err) {
      debug.error('Error rolling back transaction:', err);
      throw err;
    }
  }

  async getSupplierResponses(inquiryId, page = 1, pageSize = 50) {
    debug.log('Getting supplier responses for inquiry:', inquiryId);
        
    if (!inquiryId) {
      debug.error('Invalid inquiry ID provided');
      throw new Error('Invalid inquiry ID');
    }

    try {
      // Get supplier stats first
      const statsRows = await this.db.query(
        this.queries.stats.query,
        this.queries.stats.params(inquiryId),
      );
      debug.log('Stats query results:', statsRows);

      const transformedData = {};
      let globalStats = {
        totalResponses: 0,
        totalItems: 0,
        totalSuppliers: 0,
        respondedItems: 0,
        missingResponses: 0,
      };

      // Process each supplier's data
      for (const statsRow of statsRows) {
        const supplierId = statsRow.supplier_id;
        const isPromotion = statsRow.is_promotion === 1;

        // Get detailed responses for this supplier
        const responses = await this.db.query(
          this.queries.responses.query,
          this.queries.responses.params(inquiryId, supplierId),
        );
        debug.log(`Response details for supplier ${supplierId}:`, {
          count: responses.length,
          sample: responses[0],
          isPromotion,
        });

        // Get missing items for this supplier
        const missingItems = await this.db.query(
          this.queries.missingItems.query,
          this.queries.missingItems.params(inquiryId, supplierId),
        );
        debug.log(`Missing items for supplier ${supplierId}:`, {
          count: missingItems.length,
          sample: missingItems[0],
          isPromotion,
        });

        // Update global stats from the first supplier (they're the same for all)
        if (statsRow) {
          globalStats = {
            totalResponses: statsRow.total_responses || 0,
            totalItems: statsRow.total_items || 0,
            totalSuppliers: statsRow.total_suppliers || 0,
            respondedItems: statsRow.responded_items || 0,
            missingResponses: statsRow.missing_count || 0,
          };
        }

        // Transform supplier data
        transformedData[supplierId] = {
          supplier_name: statsRow.supplier_name,
          supplier_id: supplierId,
          responses,
          total_items: statsRow.responded_count || 0,
          total_expected_items: statsRow.total_items || 0,
          promotion_items: statsRow.promotion_count || 0,
          average_price: statsRow.average_price || 0,
          latest_response: statsRow.latest_response,
          missing_items: missingItems,
          missing_count: statsRow.missing_count || 0,
          item_count: statsRow.responded_count || 0,
          is_promotion: isPromotion,
          promotion_name: statsRow.promotion_name || null,
        };

        debug.log(`Final transformed data for supplier ${supplierId}:`, transformedData[supplierId]);
      }

      return {
        data: transformedData,
        pagination: {
          page,
          pageSize,
          hasMore: false, // Pagination handled at the API level if needed
        },
        stats: globalStats,
      };
    } catch (err) {
      debug.error('Error fetching supplier responses:', err);
      throw err;
    }
  }

  async insertSupplierResponse(inquiryId, supplierId, itemId, price) {
    const sql = `INSERT INTO supplier_response (
            inquiry_id, supplier_id, item_id, price_quoted, response_date, status
        ) VALUES (?, ?, ?, ?, datetime('now'), 'active')`;
    const params = [inquiryId, supplierId, itemId, price];

    try {
      const result = await this.db.run(sql, params);
      debug.log('supplier_response inserted:', {
        responseId: result.lastID,
        itemId: itemId,
      });
      return result.lastID;
    } catch (err) {
      debug.error('Error inserting supplier_response:', err);
      throw err;
    }
  }

  async insertSupplierResponseItem(responseId, item) {
    const sql = `INSERT INTO supplier_response_item (
            supplier_response_id, item_id, price, notes,
            hs_code, english_description, origin, new_reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      responseId,
      item.item_id,
      item.price || null,
      item.notes || null,
      item.hs_code || null,
      item.english_description || null,
      item.origin || null,
      item.new_reference_id || null,
    ];

    try {
      const result = await this.db.run(sql, params);
      debug.log('supplier_response_item inserted:', {
        itemId: item.item_id,
        price: item.price,
      });
      return result;
    } catch (err) {
      debug.error('Error inserting supplier_response_item:', err);
      throw err;
    }
  }

  async insertReferenceChange(itemId, newReferenceId, supplierId, notes) {
    const sql = `INSERT INTO item_reference_change (
            original_item_id, new_reference_id, supplier_id,
            change_date, changed_by_user, notes
        ) VALUES (?, ?, ?, datetime('now'), 0, ?)`;
    const params = [itemId, newReferenceId, supplierId, notes || 'Replacement from supplier response'];

    try {
      const result = await this.db.run(sql, params);
      debug.log('item_reference_change inserted');
      return result;
    } catch (err) {
      debug.error('Error inserting item_reference_change:', err);
      throw err;
    }
  }

  async updateResponseStatus(inquiryId, supplierId) {
    const sql = `UPDATE supplier_response 
                   SET status = 'active' 
                   WHERE inquiry_id = ? AND supplier_id = ? AND status = 'pending'`;
        
    try {
      const result = await this.db.run(sql, [inquiryId, supplierId]);
      debug.log('Response status updated:', {
        changedRows: result.changes,
      });
      return result;
    } catch (err) {
      debug.error('Error updating response status:', err);
      throw err;
    }
  }

  async cleanupSelfReferences(inquiryId) {
    const sql = `UPDATE inquiry_item SET 
            new_reference_id = NULL,
            reference_notes = NULL
        WHERE item_id = new_reference_id AND inquiry_id = ?`;

    try {
      const result = await this.db.run(sql, [inquiryId]);
      debug.log('Self-references cleaned up');
      return result;
    } catch (err) {
      debug.error('Error cleaning up self-references:', err);
      throw err;
    }
  }

  async cleanupReferenceChanges() {
    const sql = 'DELETE FROM item_reference_change WHERE original_item_id = new_reference_id';

    try {
      const result = await this.db.run(sql, []);
      debug.log('Reference changes cleaned up');
      return result;
    } catch (err) {
      debug.error('Error cleaning up reference changes:', err);
      throw err;
    }
  }

  async deleteResponse(responseId) {
    try {
      const result = await this.db.run(
        'DELETE FROM supplier_response WHERE supplier_response_id = ?',
        [responseId],
      );
      const deleted = { deleted: result.changes > 0 };
      debug.log('Delete response result:', deleted);
      return deleted;
    } catch (err) {
      debug.error('Error deleting supplier response:', err);
      throw err;
    }
  }

  async deleteReferenceChange(changeId) {
    try {
      const result = await this.db.run(
        'DELETE FROM item_reference_change WHERE change_id = ?',
        [changeId],
      );
      const deleted = { deleted: result.changes > 0 };
      debug.log('Delete reference change result:', deleted);
      return deleted;
    } catch (err) {
      debug.error('Error deleting reference change:', err);
      throw err;
    }
  }

  async deleteBulkResponses(date, supplierId) {
    debug.log('Attempting bulk delete:', { date, supplierId });
        
    try {
      await this.beginTransaction();

      // Convert supplierId to integer if it's a string
      const supplierIdInt = parseInt(supplierId, 10);
      if (isNaN(supplierIdInt)) {
        throw new Error('Invalid supplier ID');
      }

      // Delete all responses for the supplier on the given date
      const result = await this.db.run(
        `DELETE FROM supplier_response 
                WHERE supplier_id = ? 
                AND date(response_date) >= date(?)
                AND date(response_date) < date(?, '+1 day')`,
        [supplierIdInt, date, date],
      );

      await this.commitTransaction();
            
      const deleted = { deleted: result.changes > 0 };
      debug.log('Bulk delete result:', {
        ...deleted,
        date,
        supplierId: supplierIdInt,
        rowsAffected: result.changes,
      });
            
      return deleted;
    } catch (err) {
      debug.error('Error in bulk delete:', err);
      await this.rollbackTransaction();
      throw err;
    }
  }
}

module.exports = ResponseQueries;
