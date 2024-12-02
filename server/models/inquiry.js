const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');

class InquiryModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async createInquiry({ inquiryNumber, items }) {
        return await this.executeTransaction(async () => {
            debug.log('Starting inquiry creation:', { inquiryNumber, itemCount: items.length });

            // Insert inquiry
            const inquirySql = `INSERT INTO inquiry (inquiry_number) VALUES (?)`;
            const inquiryResult = await this.executeRun(inquirySql, [inquiryNumber]);
            const inquiryId = inquiryResult.lastID;

            // First pass: Create all items and referenced items
            for (const item of items) {
                // Check and create the main item if it doesn't exist
                const existingItem = await this.executeQuerySingle(
                    'SELECT item_id FROM item WHERE item_id = ?',
                    [item.item_id]
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
                        item.origin || ''
                    ]);
                }

                // If there's a new_reference_id, check and create that item too
                if (item.new_reference_id) {
                    const existingRefItem = await this.executeQuerySingle(
                        'SELECT item_id FROM item WHERE item_id = ?',
                        [item.new_reference_id]
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
                            1.30 // Default markup
                        ]);
                    }
                }
            }

            // Second pass: Insert inquiry items now that all referenced items exist
            for (const item of items) {
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

                await this.executeRun(inquiryItemSql, [
                    inquiryId,
                    item.item_id,
                    item.requested_qty,
                    item.hebrew_description,
                    item.english_description || null,
                    item.hs_code || null,
                    item.import_markup || 1.30,
                    item.qty_in_stock || 0,
                    item.retail_price || null,
                    item.sold_this_year || 0,
                    item.sold_last_year || 0,
                    item.original_item_id || item.item_id,
                    item.new_reference_id || null,
                    item.reference_notes || null,
                    item.origin || ''
                ]);
            }

            debug.log('Inquiry creation completed:', { inquiryId });
            return { id: inquiryId };
        });
    }

    async getAllInquiries() {
        const sql = `
            SELECT i.*, 
                   COUNT(ii.inquiry_item_id) as item_count,
                   GROUP_CONCAT(DISTINCT s.name) as suppliers
            FROM inquiry i
            LEFT JOIN inquiry_item ii ON i.inquiry_id = ii.inquiry_id
            LEFT JOIN supplier_response sr ON i.inquiry_id = sr.inquiry_id
            LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
            GROUP BY i.inquiry_id
            ORDER BY i.date DESC
        `;
        return await this.executeQuery(sql);
    }

    async getInquiryById(inquiryId) {
        const sql = `
            SELECT i.*,
                   COUNT(DISTINCT ii.item_id) as total_items,
                   COUNT(DISTINCT sr.supplier_id) as total_suppliers,
                   GROUP_CONCAT(DISTINCT s.name) as supplier_names
            FROM inquiry i
            LEFT JOIN inquiry_item ii ON i.inquiry_id = ii.inquiry_id
            LEFT JOIN supplier_response sr ON i.inquiry_id = sr.inquiry_id
            LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
            WHERE i.inquiry_id = ?
            GROUP BY i.inquiry_id
        `;
        return await this.executeQuerySingle(sql, [inquiryId]);
    }

    async getInquiryItems(inquiryId) {
        const sql = `
            SELECT ii.*,
                   i.hebrew_description as current_hebrew_description,
                   i.english_description as current_english_description,
                   i.import_markup as current_import_markup,
                   i.hs_code as current_hs_code,
                   ph.ils_retail_price as current_retail_price,
                   ph.qty_in_stock as current_qty_in_stock,
                   ph.sold_this_year as current_sold_this_year,
                   ph.sold_last_year as current_sold_last_year
            FROM inquiry_item ii
            LEFT JOIN item i ON ii.item_id = i.item_id
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
        const sql = 'DELETE FROM inquiry WHERE inquiry_id = ?';
        return await this.executeRun(sql, [inquiryId]);
    }
}

module.exports = InquiryModel;
