const debug = require('../debug');

class BatchProcessingError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BatchProcessingError';
    this.details = details;
  }
}

class BatchProcessor {
  constructor(model) {
    this.model = model;
  }

  /**
   * Create multiple items in a single transaction
   * @param {Map} itemsMap - Map of items to create
   * @param {Object} columnMapping - Column mapping configuration
   * @returns {Promise<Object>} Processing results
   */
  async createItems(itemsMap, columnMapping) {
    debug.log('Starting batch item creation');

    return await this.model.executeTransaction(async () => {
      const results = {
        created: [],
        updated: [],
        referenced: [],
        errors: [],
      };

      try {
        // First pass: Create or update all items
        for (const [itemId, itemData] of itemsMap) {
          try {
            const row = itemData.row || {};
            
            // Prepare item data
            const itemFields = {
              item_id: itemId,
              hebrew_description: row[columnMapping.hebrewDescription]?.toString().trim() || `Item ${itemId}`,
              english_description: row[columnMapping.englishDescription]?.toString().trim() || '',
              import_markup: row[columnMapping.importMarkup] || 1.3,
              hs_code: row[columnMapping.hsCode]?.toString().trim() || '',
              notes: row[columnMapping.notes]?.toString().trim() || '',
            };

            // Check if item exists
            const exists = await this.model.executeQuerySingle(
              'SELECT item_id FROM item WHERE item_id = ?',
              [itemId],
            );

            if (exists) {
              // Update existing item
              await this.model.executeRun(
                `UPDATE item SET 
                  hebrew_description = ?,
                  english_description = ?,
                  import_markup = ?,
                  hs_code = ?,
                  notes = ?
                WHERE item_id = ?`,
                [
                  itemFields.hebrew_description,
                  itemFields.english_description,
                  itemFields.import_markup,
                  itemFields.hs_code,
                  itemFields.notes,
                  itemId,
                ],
              );
              results.updated.push(itemId);
            } else {
              // Create new item
              await this.model.executeRun(
                `INSERT INTO item (
                  item_id, hebrew_description, english_description,
                  import_markup, hs_code, notes
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  itemId,
                  itemFields.hebrew_description,
                  itemFields.english_description,
                  itemFields.import_markup,
                  itemFields.hs_code,
                  itemFields.notes,
                ],
              );
              results.created.push(itemId);
            }

            // Create price history if available
            if (row[columnMapping.retailPrice] || row[columnMapping.qtyInStock] ||
                row[columnMapping.soldThisYear] || row[columnMapping.soldLastYear]) {
              await this.model.executeRun(
                `INSERT INTO price_history (
                  item_id, ils_retail_price, qty_in_stock,
                  qty_sold_this_year, qty_sold_last_year
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                  itemId,
                  row[columnMapping.retailPrice] || 0,
                  row[columnMapping.qtyInStock] || 0,
                  row[columnMapping.soldThisYear] || 0,
                  row[columnMapping.soldLastYear] || 0,
                ],
              );
            }
          } catch (error) {
            debug.error(`Error processing item ${itemId}:`, error);
            results.errors.push({
              itemId,
              error: error.message,
              details: error.details || {},
            });
          }
        }

        // Second pass: Process references
        for (const [itemId, itemData] of itemsMap) {
          if (itemData.references.size > 0) {
            try {
              for (const refId of itemData.references) {
                await this.model.executeRun(
                  `INSERT INTO item_reference_change (
                    original_item_id, new_reference_id,
                    changed_by_user, notes
                  ) VALUES (?, ?, 1, ?)`,
                  [
                    itemId,
                    refId,
                    'Reference from Excel upload',
                  ],
                );
              }
              results.referenced.push(itemId);
            } catch (error) {
              debug.error(`Error processing references for item ${itemId}:`, error);
              results.errors.push({
                itemId,
                error: error.message,
                type: 'reference',
                details: error.details || {},
              });
            }
          }
        }

        return results;
      } catch (error) {
        throw new BatchProcessingError('Batch processing failed', {
          error: error.message,
          results,
        });
      }
    }, { isolationLevel: 'READ_COMMITTED' });
  }
}

module.exports = {
  BatchProcessor,
  BatchProcessingError,
};