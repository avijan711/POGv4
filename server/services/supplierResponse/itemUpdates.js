const debug = require('../../utils/debug');
const { getSQLDate, DateValidationError, isValidDate } = require('../../utils/dateUtils');
const { DatabaseAccessLayer } = require('../../config/database');

class ItemUpdates {
  constructor(db) {
    this.db = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
  }

  async verifyItemExists(itemId, inquiryId) {
    try {
      // First check if the item exists in inquiry_item table for this inquiry
      const inquiryRow = await this.db.querySingle(
        'SELECT 1 FROM inquiry_item WHERE item_id = ? AND inquiry_id = ?',
        [itemId, inquiryId],
      );

      if (!inquiryRow) {
        return {
          existsInInquiry: false,
          existsInItemTable: false,
        };
      }

      // If item exists in inquiry_item, check if it exists in main item table
      const itemRow = await this.db.querySingle(
        'SELECT 1 FROM item WHERE item_id = ?',
        [itemId],
      );

      return {
        existsInInquiry: true,
        existsInItemTable: !!itemRow,
      };
    } catch (err) {
      debug.error('Error verifying item existence:', err);
      throw err;
    }
  }

  // Add date validation method
  validateDate(date) {
    if (!isValidDate(date)) {
      throw new DateValidationError(`Invalid date format: ${date}`);
    }
    return true;
  }

  async createUnknownItem(itemId, inquiryId) {
    try {
      // First verify this item exists in inquiry_item table
      const inquiryItem = await this.db.querySingle(
        `SELECT hebrew_description, english_description, import_markup, hs_code, origin 
                 FROM inquiry_item WHERE item_id = ? AND inquiry_id = ?`,
        [itemId, inquiryId],
      );

      if (!inquiryItem) {
        throw new Error(`Item ${itemId} not found in inquiry ${inquiryId}`);
      }

      // Insert the item
      await this.db.run(
        `INSERT INTO item (
                    item_id, hebrew_description, english_description, import_markup, hs_code, origin
                ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          inquiryItem.hebrew_description || 'Unknown New Item',
          inquiryItem.english_description || 'Unknown New Item',
          inquiryItem.import_markup || 1.30,
          inquiryItem.hs_code || '',
          inquiryItem.origin || '',
        ],
      );
            
      // Insert initial history record with proper date handling
      await this.db.run(
        `INSERT INTO price_history (
                    item_id,
                    supplier_id,
                    price,
                    effective_date,
                    source_type,
                    source_id,
                    notes
                ) VALUES (?, NULL, NULL, date('now'), 'manual', NULL, 'Initial record for unknown item')`,
        [itemId],
      );

      return {
        success: true,
        message: `Created unknown item ${itemId}`,
      };
    } catch (err) {
      debug.error('Error creating unknown item:', err);
      throw err;
    }
  }

  async updateItemDetails(itemId, updates) {
    debug.log('Updating item details:', { itemId, updates });

    const fields = ['hs_code', 'english_description', 'origin'];
    const validUpdates = {};
    const params = [];
        
    // Build update fields and params
    fields.forEach(field => {
      if (field in updates) {
        validUpdates[field] = `${field} = ?`;
        params.push(updates[field] || '');
      }
    });

    if (Object.keys(validUpdates).length === 0) {
      debug.log('No valid updates provided');
      return;
    }

    params.push(itemId); // Add itemId as the last parameter
    const updateFields = Object.values(validUpdates).join(', ');
        
    try {
      // Update item table
      const itemSql = `UPDATE item SET ${updateFields} WHERE item_id = ?`;
      await this.db.run(itemSql, params);
      debug.log('Item details updated successfully');

      // Update inquiry_item table with the same updates
      const inquirySql = `UPDATE inquiry_item SET ${updateFields} WHERE item_id = ?`;
      await this.db.run(inquirySql, params);
      debug.log('Inquiry item details updated successfully');

      return {
        success: true,
        message: `Updated details for item ${itemId}`,
      };
    } catch (err) {
      debug.error('Error updating item details:', err);
      throw err;
    }
  }

  async updateInquiryItemReference(itemId, newReferenceId, notes, inquiryId) {
    try {
      const sql = `UPDATE inquiry_item SET 
                new_reference_id = ?,
                reference_notes = ?
            WHERE item_id = ? AND inquiry_id = ?`;
      const params = [
        newReferenceId,
        notes || 'Replacement from supplier response',
        itemId,
        inquiryId,
      ];

      await this.db.run(sql, params);
      debug.log('inquiry_item updated');

      return {
        success: true,
        message: `Updated reference for item ${itemId} to ${newReferenceId}`,
      };
    } catch (err) {
      debug.error('Error updating inquiry_item:', err);
      throw err;
    }
  }
}

module.exports = ItemUpdates;
