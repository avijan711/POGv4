const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');

class ItemModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async getAllItems() {
        const sql = `
            WITH LatestPrices AS (
                SELECT *
                FROM price_history
                WHERE (item_id, date) IN (
                    SELECT item_id, MAX(date)
                    FROM price_history
                    GROUP BY item_id
                )
            ),
            ReferenceInfo AS (
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
                i.*,
                p.ils_retail_price as retail_price,
                p.qty_in_stock,
                p.sold_this_year,
                p.sold_last_year,
                p.date as last_price_update,
                ri.reference_change,
                CASE 
                    WHEN ri.new_reference_id IS NOT NULL THEN 1 
                    ELSE 0 
                END as has_reference_change,
                CASE 
                    WHEN rb.referenced_by_count > 0 THEN 1 
                    ELSE 0 
                END as is_referenced_by,
                rb.referenced_by_count,
                rb.referencing_items
            FROM item i
            LEFT JOIN LatestPrices p ON i.item_id = p.item_id
            LEFT JOIN ReferenceInfo ri ON i.item_id = ri.original_item_id
            LEFT JOIN ReferencedBy rb ON i.item_id = rb.item_id
            ORDER BY i.item_id
        `;
        return await this.executeQuery(sql);
    }

    async getItemById(itemId) {
        const sql = `
            WITH LatestPrices AS (
                SELECT *
                FROM price_history
                WHERE (item_id, date) IN (
                    SELECT item_id, MAX(date)
                    FROM price_history
                    GROUP BY item_id
                )
            ),
            ReferenceInfo AS (
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
                i.*,
                p.ils_retail_price as retail_price,
                p.qty_in_stock,
                p.sold_this_year,
                p.sold_last_year,
                p.date as last_price_update,
                ri.reference_change,
                CASE 
                    WHEN ri.new_reference_id IS NOT NULL THEN 1 
                    ELSE 0 
                END as has_reference_change,
                CASE 
                    WHEN rb.referenced_by_count > 0 THEN 1 
                    ELSE 0 
                END as is_referenced_by,
                rb.referenced_by_count,
                rb.referencing_items
            FROM item i
            LEFT JOIN LatestPrices p ON i.item_id = p.item_id
            LEFT JOIN ReferenceInfo ri ON i.item_id = ri.original_item_id
            LEFT JOIN ReferencedBy rb ON i.item_id = rb.item_id
            WHERE i.item_id = ?
        `;
        return await this.executeQuerySingle(sql, [itemId]);
    }

    async getPriceHistory(itemId) {
        const sql = `
            SELECT 
                date,
                ils_retail_price,
                qty_in_stock,
                sold_this_year,
                sold_last_year
            FROM price_history
            WHERE item_id = ?
            ORDER BY date DESC
        `;
        return await this.executeQuery(sql, [itemId]);
    }

    async getSupplierPrices(itemId) {
        const sql = `
            WITH PriceChanges AS (
                SELECT 
                    sr1.supplier_id,
                    sr1.item_id,
                    sr1.price_quoted as current_price,
                    sr1.response_date as current_date,
                    sr2.price_quoted as previous_price,
                    sr2.response_date as previous_date,
                    CASE 
                        WHEN sr2.price_quoted IS NOT NULL 
                        THEN ((sr1.price_quoted - sr2.price_quoted) / sr2.price_quoted * 100)
                        ELSE 0 
                    END as price_change
                FROM supplier_response sr1
                LEFT JOIN supplier_response sr2 ON 
                    sr1.supplier_id = sr2.supplier_id AND
                    sr1.item_id = sr2.item_id AND
                    sr2.response_date = (
                        SELECT MAX(response_date)
                        FROM supplier_response sr3
                        WHERE sr3.supplier_id = sr1.supplier_id
                        AND sr3.item_id = sr1.item_id
                        AND sr3.response_date < sr1.response_date
                    )
                WHERE sr1.item_id = ?
            )
            SELECT 
                s.name as supplier_name,
                pc.current_price as price_quoted,
                pc.current_date as response_date,
                sr.status,
                sr.is_promotion,
                sr.promotion_name,
                pc.price_change
            FROM PriceChanges pc
            JOIN supplier s ON pc.supplier_id = s.supplier_id
            JOIN supplier_response sr ON 
                sr.supplier_id = pc.supplier_id AND
                sr.item_id = pc.item_id AND
                sr.response_date = pc.current_date
            ORDER BY pc.current_date DESC
        `;
        return await this.executeQuery(sql, [itemId]);
    }

    async getReferenceChanges(itemId) {
        const sql = `
            SELECT 
                rc.original_item_id,
                rc.new_reference_id,
                s.name as supplier_name,
                rc.changed_by_user,
                rc.change_date,
                rc.notes,
                i1.hebrew_description as original_description,
                i2.hebrew_description as new_description
            FROM item_reference_change rc
            LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
            LEFT JOIN item i1 ON rc.original_item_id = i1.item_id
            LEFT JOIN item i2 ON rc.new_reference_id = i2.item_id
            WHERE rc.original_item_id = ? OR rc.new_reference_id = ?
            ORDER BY rc.change_date DESC
        `;
        return await this.executeQuery(sql, [itemId, itemId]);
    }

    async createItem(itemData) {
        return await this.executeTransaction(async () => {
            const {
                itemID,
                hebrewDescription,
                englishDescription,
                importMarkup,
                hsCode,
                image,
                qtyInStock,
                soldThisYear,
                soldLastYear,
                retailPrice
            } = itemData;

            // Insert into item table
            const itemSql = `
                INSERT INTO item (
                    item_id, hebrew_description, english_description, 
                    import_markup, hs_code, image
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;
            await this.executeRun(itemSql, [
                itemID, hebrewDescription, englishDescription,
                importMarkup, hsCode, image
            ]);

            // Insert initial price history
            if (retailPrice !== null || qtyInStock !== null || 
                soldThisYear !== null || soldLastYear !== null) {
                const priceSql = `
                    INSERT INTO price_history (
                        item_id, ils_retail_price, qty_in_stock,
                        sold_this_year, sold_last_year
                    ) VALUES (?, ?, ?, ?, ?)
                `;
                await this.executeRun(priceSql, [
                    itemID, retailPrice, qtyInStock,
                    soldThisYear, soldLastYear
                ]);
            }

            // Return the created item
            return await this.getItemById(itemID);
        });
    }

    async updateItem(itemId, updateData) {
        return await this.executeTransaction(async () => {
            const {
                hebrewDescription,
                englishDescription,
                importMarkup,
                hsCode,
                image,
                qtyInStock,
                soldThisYear,
                soldLastYear,
                retailPrice
            } = updateData;

            // Update item table
            const itemSql = `
                UPDATE item 
                SET hebrew_description = ?,
                    english_description = ?,
                    import_markup = ?,
                    hs_code = ?
                    ${image ? ', image = ?' : ''}
                WHERE item_id = ?
            `;
            const itemParams = [
                hebrewDescription,
                englishDescription,
                importMarkup,
                hsCode
            ];
            if (image) itemParams.push(image);
            itemParams.push(itemId);
            
            await this.executeRun(itemSql, itemParams);

            // Insert new price history if any price-related fields changed
            if (retailPrice !== null || qtyInStock !== null || 
                soldThisYear !== null || soldLastYear !== null) {
                const priceSql = `
                    INSERT INTO price_history (
                        item_id, ils_retail_price, qty_in_stock,
                        sold_this_year, sold_last_year
                    ) VALUES (?, ?, ?, ?, ?)
                `;
                await this.executeRun(priceSql, [
                    itemId, retailPrice, qtyInStock,
                    soldThisYear, soldLastYear
                ]);
            }
        });
    }

    async deleteItem(itemId) {
        const sql = 'DELETE FROM item WHERE item_id = ?';
        await this.executeRun(sql, [itemId]);
    }

    async addReferenceChange(originalItemId, newReferenceId, supplierId, notes) {
        const sql = `
            INSERT INTO item_reference_change (
                original_item_id, new_reference_id, supplier_id,
                changed_by_user, notes, change_date
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        await this.executeRun(sql, [
            originalItemId,
            newReferenceId,
            supplierId || null,
            supplierId ? 0 : 1,
            notes
        ]);
    }
}

module.exports = ItemModel;
