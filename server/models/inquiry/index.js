const BaseModel = require('../BaseModel');
const InquiryItemModel = require('./item');
const { getInquiriesQuery, getInquiryByIdQuery } = require('../queries/inquiries');
const debug = require('../../utils/debug');

class InquiryModel extends BaseModel {
  constructor(db) {
    super(db);
    this.itemModel = new InquiryItemModel(db);
  }

  async createInquiry(data) {
    const { inquiryNumber, items } = data;
    return await this.executeTransaction(async () => {
      try {
        // Create the inquiry
        const result = await this.executeRun(
          'INSERT INTO inquiry (inquiry_number, status) VALUES (?, ?)',
          [inquiryNumber, 'new'],
        );

        const inquiryId = result.lastID;

        // Create each item
        for (const item of items) {
          await this.itemModel.createInquiryItem(inquiryId, item);
        }

        return {
          id: inquiryId,
          inquiryNumber,
          status: 'new',
        };
      } catch (error) {
        debug.error('Error creating inquiry:', error);
        throw error;
      }
    });
  }

  async getAllInquiries(status) {
    console.debug('[DEBUG]', new Date().toISOString(), 'Getting all inquiries with status:', status);
    const startTime = process.hrtime();

    const query = getInquiriesQuery(status);
    const params = status ? [status] : [];

    try {
      const inquiries = await this.executeQuery(query, params);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      console.debug('[DEBUG] getAllInquiries results:', {
        count: inquiries.length,
        status,
        queryDuration: duration,
      });

      return inquiries;
    } catch (error) {
      console.error('Database error in getAllInquiries:', error);
      throw new Error('Failed to fetch inquiries');
    }
  }

  async getInquiryById(inquiryId) {
    console.debug('[DEBUG]', new Date().toISOString(), 'Getting inquiry by ID:', inquiryId);
    const startTime = process.hrtime();

    try {
      const query = getInquiryByIdQuery();
      const params = [inquiryId, inquiryId, inquiryId];

      const rows = await this.executeQuery(query, params);

      if (!rows || rows.length === 0) {
        throw new Error('Inquiry not found');
      }

      // Parse the row with JSON fields
      const parsedRow = this.parseJsonFields(rows[0], ['inquiry', 'items']);
            
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const queryDuration = seconds * 1000 + nanoseconds / 1000000;

      console.debug('[DEBUG] getInquiryById results:', {
        inquiryId,
        itemCount: parsedRow.items ? parsedRow.items.length : 0,
        queryDuration,
      });

      return {
        inquiry: parsedRow.inquiry,
        items: parsedRow.items.map(item => ({
          item_id: item.item_id,
          hebrew_description: item.hebrew_description,
          english_description: item.english_description,
          requested_qty: item.requested_qty,
          import_markup: item.import_markup,
          hs_code: item.hs_code,
          origin: item.origin,
          retail_price: item.retail_price,
          qty_in_stock: item.qty_in_stock,
          qty_sold_this_year: item.qty_sold_this_year,
          qty_sold_last_year: item.qty_sold_last_year,
          notes: item.notes,
          referenceChange: item.referenceChange === 'null' ? null : item.referenceChange,
          referencingItems: item.referencingItems || [],
        })),
      };
    } catch (error) {
      console.error('Database error in getInquiryById:', error);
      throw error;
    }
  }

  async updateInquiryStatus(inquiryId, status) {
    try {
      const result = await this.executeRun(
        'UPDATE Inquiry SET Status = ? WHERE InquiryID = ?',
        [status, inquiryId],
      );

      if (result.changes === 0) {
        throw new Error('Inquiry not found');
      }
    } catch (error) {
      console.error('Database error updating status:', error);
      throw new Error('Failed to update status');
    }
  }

  async deleteInquiry(inquiryId) {
    return new Promise((resolve, reject) => {
      this.db.serialize(async () => {
        try {
          await this.beginTransaction();
          await this.itemModel.deleteByInquiryId(inquiryId);
          await new Promise((resolve, reject) => {
            this.db.run(
              'DELETE FROM Inquiry WHERE InquiryID = ?',
              [inquiryId],
              function(err) {
                if (err) reject(err);
                else if (this.changes === 0) reject(new Error('Inquiry not found'));
                else resolve();
              },
            );
          });
          await this.commit();
          resolve();
        } catch (error) {
          await this.rollback();
          reject(error);
        }
      });
    });
  }

  async updateInquiryItemQuantity(inquiryItemId, requestedQty) {
    return this.itemModel.updateQuantity(inquiryItemId, requestedQty);
  }

  async updateInquiryItemReference(inquiryItemId, newReferenceId, referenceNotes) {
    return this.itemModel.updateReference(inquiryItemId, newReferenceId, referenceNotes);
  }
}

module.exports = InquiryModel;
