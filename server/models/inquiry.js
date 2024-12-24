const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');
const { getInquiriesQuery, getInquiryByIdQuery } = require('./queries/inquiries');
const InquiryItemModel = require('./inquiry/item');

class InquiryModel extends BaseModel {
  constructor(db) {
    super(db);
    this.inquiryItemModel = new InquiryItemModel(db);
  }

  async createInquiry({ inquiryNumber, items }) {
    return await this.executeTransaction(async () => {
      debug.log('Starting inquiry creation:', { inquiryNumber, itemCount: items.length });

      // Insert inquiry
      const inquirySql = 'INSERT INTO inquiry (inquiry_number) VALUES (?)';
      const inquiryResult = await this.executeRun(inquirySql, [inquiryNumber]);
      const inquiryId = inquiryResult.lastID;

      // First pass: Create all items and referenced items
      for (const item of items) {
        // Skip if no item_id
        if (!item.item_id) {
          debug.log('Skipping item with no item_id');
          continue;
        }

        // Check and create the main item if it doesn't exist
        const existingItem = await this.executeQuerySingle(
          'SELECT item_id FROM item WHERE item_id = ?',
          [item.item_id],
        );

        if (!existingItem) {
          debug.log('Creating new item:', item.item_id);
          // Create the item first
          const itemSql = `
                        INSERT INTO item (
                            item_id, hebrew_description, english_description,
                            import_markup, hs_code, origin
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `;
          await this.executeRun(itemSql, [
            item.item_id,
            item.hebrew_description,
            item.english_description || '',
            item.import_markup || 1.30,
            item.hs_code || '',
            item.origin || '',
          ]);
        }

        // If there's a new_reference_id, check and create that item too
        if (item.new_reference_id && item.new_reference_id !== item.item_id) {
          const existingRefItem = await this.executeQuerySingle(
            'SELECT item_id FROM item WHERE item_id = ?',
            [item.new_reference_id],
          );

          if (!existingRefItem) {
            debug.log('Creating referenced item:', item.new_reference_id);
            // Create the referenced item with minimal information
            const refItemSql = `
                            INSERT INTO item (
                                item_id, hebrew_description, english_description,
                                import_markup
                            ) VALUES (?, ?, ?, ?)
                        `;
            await this.executeRun(refItemSql, [
              item.new_reference_id,
              `Referenced item for ${item.item_id}`, // Temporary description
              '',
              1.30, // Default markup
            ]);
          }

          // Create reference change entry
          const existingRefChange = await this.executeQuerySingle(
            'SELECT change_id FROM item_reference_change WHERE original_item_id = ? AND new_reference_id = ?',
            [item.item_id, item.new_reference_id],
          );

          if (!existingRefChange) {
            debug.log('Creating reference change:', {
              from: item.item_id,
              to: item.new_reference_id,
            });
            const refChangeSql = `
                            INSERT INTO item_reference_change (
                                original_item_id, new_reference_id,
                                changed_by_user, notes
                            ) VALUES (?, ?, ?, ?)
                        `;
            await this.executeRun(refChangeSql, [
              item.item_id,
              item.new_reference_id,
              1, // changed_by_user = true
              item.reference_notes || 'Created from inquiry upload',
            ]);
          }
        }
      }

      // Second pass: Insert inquiry items now that all referenced items exist
      for (const item of items) {
        // Skip if no item_id
        if (!item.item_id) {
          debug.log('Skipping inquiry item with no item_id');
          continue;
        }

        const inquiryItemSql = `
                    INSERT INTO inquiry_item (
                        inquiry_id, item_id, requested_qty,
                        hebrew_description, english_description,
                        hs_code, import_markup, qty_in_stock,
                        retail_price, sold_this_year, sold_last_year,
                        original_item_id, new_reference_id, reference_notes,
                        origin
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

        // Ensure numeric fields are non-negative
        const ensureNonNegative = (value, defaultValue = 0) => {
          if (value === null || value === undefined) return defaultValue;
          const num = typeof value === 'number' ? value : Number(value);
          return !isNaN(num) ? Math.max(0, num) : defaultValue;
        };

        const requestedQty = ensureNonNegative(item.requested_qty);
        const qtyInStock = ensureNonNegative(item.qty_in_stock);
        const soldThisYear = ensureNonNegative(item.sold_this_year);
        const soldLastYear = ensureNonNegative(item.sold_last_year);

        await this.executeRun(inquiryItemSql, [
          inquiryId,
          item.item_id,
          requestedQty,
          item.hebrew_description,
          item.english_description || null,
          item.hs_code || null,
          item.import_markup || 1.30,
          qtyInStock,
          item.retail_price || null,
          soldThisYear,
          soldLastYear,
          item.original_item_id || item.item_id,
          item.new_reference_id || null,
          item.reference_notes || null,
          item.origin || '',
        ]);
      }

      debug.log('Inquiry creation completed:', { inquiryId });
      return { id: inquiryId };
    });
  }

  async getAllInquiries() {
    const sql = `
            SELECT 
                i.inquiry_id,
                i.inquiry_number as custom_number,
                i.status,
                i.date,
                COUNT(ii.inquiry_item_id) as item_count,
                COUNT(DISTINCT sr.supplier_id) as responded_suppliers_count,
                SUM(CASE WHEN sr.supplier_id IS NULL THEN 1 ELSE 0 END) as not_responded_items_count,
                SUM(CASE WHEN ii.new_reference_id IS NOT NULL THEN 1 ELSE 0 END) as total_replacements_count
            FROM inquiry i
            LEFT JOIN inquiry_item ii ON i.inquiry_id = ii.inquiry_id
            LEFT JOIN supplier_response sr ON i.inquiry_id = sr.inquiry_id AND ii.item_id = sr.item_id
            GROUP BY i.inquiry_id, i.inquiry_number, i.status, i.date
            ORDER BY i.date DESC
        `;
    return await this.executeQuery(sql);
  }

  async getInquiryById(inquiryId) {
    const sql = getInquiryByIdQuery();
    const result = await this.executeQuerySingle(sql, [inquiryId, inquiryId, inquiryId, inquiryId]);
        
    if (!result) return null;

    // Parse the JSON strings
    try {
      const inquiry = JSON.parse(result.inquiry);
      const items = JSON.parse(result.items);
      return { inquiry, items };
    } catch (error) {
      debug.error('Error parsing inquiry result:', error);
      throw new Error('Failed to parse inquiry data');
    }
  }

  async getInquiryItems(inquiryId) {
    const sql = `
            WITH ReferenceInfo AS (
                SELECT 
                    rc.original_item_id,
                    rc.new_reference_id,
                    rc.change_date,
                    rc.notes,
                    s.name as supplier_name,
                    rc.changed_by_user,
                    JSON_OBJECT(
                        'new_reference_id', rc.new_reference_id,
                        'change_date', rc.change_date,
                        'notes', rc.notes,
                        'supplier_name', s.name,
                        'source', CASE WHEN rc.supplier_id IS NOT NULL THEN 'supplier' ELSE 'user' END
                    ) as reference_change
                FROM item_reference_change rc
                LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
                WHERE (rc.original_item_id, rc.change_date) IN (
                    SELECT original_item_id, MAX(change_date)
                    FROM item_reference_change
                    GROUP BY original_item_id
                )
            ),
            ReferencedBy AS (
                SELECT 
                    new_reference_id as item_id,
                    COUNT(*) as referenced_by_count,
                    GROUP_CONCAT(original_item_id) as referencing_items
                FROM item_reference_change
                GROUP BY new_reference_id
            )
            SELECT 
                ii.*,
                i.hebrew_description as current_hebrew_description,
                i.english_description as current_english_description,
                i.import_markup as current_import_markup,
                i.hs_code as current_hs_code,
                ph.ils_retail_price as current_retail_price,
                ph.qty_in_stock as current_qty_in_stock,
                ph.sold_this_year as current_sold_this_year,
                ph.sold_last_year as current_sold_last_year,
                ri.reference_change,
                CASE 
                    WHEN ri.new_reference_id IS NOT NULL THEN 1 
                    ELSE 0 
                END as has_reference_change,
                CASE 
                    WHEN rb.referenced_by_count > 0 THEN 1 
                    ELSE 0 
                END as is_referenced_by,
                rb.referencing_items
            FROM inquiry_item ii
            LEFT JOIN item i ON ii.item_id = i.item_id
            LEFT JOIN ReferenceInfo ri ON ii.item_id = ri.original_item_id
            LEFT JOIN ReferencedBy rb ON ii.item_id = rb.item_id
            LEFT JOIN (
                SELECT *
                FROM price_history
                WHERE (item_id, date) IN (
                    SELECT item_id, MAX(date)
                    FROM price_history
                    GROUP BY item_id
                )
            ) ph ON i.item_id = ph.item_id
            WHERE ii.inquiry_id = ?
            ORDER BY ii.inquiry_item_id
        `;
    return await this.executeQuery(sql, [inquiryId]);
  }

  async updateInquiry(inquiryId, updateData) {
    const { status } = updateData;
    const sql = `
            UPDATE inquiry 
            SET status = ?
            WHERE inquiry_id = ?
        `;
    await this.executeRun(sql, [status, inquiryId]);
    return await this.getInquiryById(inquiryId);
  }

  async deleteInquiry(inquiryId) {
    return await this.executeTransaction(async () => {
      debug.log('Starting inquiry deletion transaction:', { inquiryId });

      // First delete all supplier responses (which will cascade delete supplier_response_items)
      const deleteResponsesSql = 'DELETE FROM supplier_response WHERE inquiry_id = ?';
      await this.executeRun(deleteResponsesSql, [inquiryId]);
      debug.log('Deleted supplier responses');

      // Then delete the inquiry (which will cascade delete inquiry_items)
      const deleteInquirySql = 'DELETE FROM inquiry WHERE inquiry_id = ?';
      const result = await this.executeRun(deleteInquirySql, [inquiryId]);
            
      if (result.changes === 0) {
        throw new Error('Inquiry not found');
      }

      debug.log('Inquiry deletion completed');
      return result;
    });
  }
}

module.exports = InquiryModel;
