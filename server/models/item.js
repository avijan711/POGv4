const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');
const { cleanItemId } = require('../utils/itemIdCleaner');

class ItemModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async getAllItems() {
        const sql = `
            WITH LatestPrices AS (
                SELECT 
                    item_id,
                    ils_retail_price,
                    qty_in_stock,
                    sold_this_year,
                    sold_last_year,
                    date,
                    ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY date DESC, history_id DESC) as rn
                FROM price_history
            ),
            ReferenceChanges AS (
                SELECT 
                    rc.original_item_id,
                    rc.new_reference_id,
                    s.name as supplier_name,
                    rc.changed_by_user,
                    rc.change_date,
                    rc.notes,
                    i2.hebrew_description as new_description,
                    i2.english_description as new_english_description,
                    ROW_NUMBER() OVER (PARTITION BY rc.original_item_id ORDER BY rc.change_date DESC) as rn
                FROM item_reference_change rc
                LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
                LEFT JOIN item i2 ON rc.new_reference_id = i2.item_id
            ),
            ReferencingItems AS (
                SELECT 
                    rc.new_reference_id as item_id,
                    GROUP_CONCAT(rc.original_item_id) as referencing_items
                FROM item_reference_change rc
                GROUP BY rc.new_reference_id
            )
            SELECT 
                i.*,
                p.ils_retail_price as retail_price,
                p.qty_in_stock,
                p.sold_this_year,
                p.sold_last_year,
                p.date as last_price_update,
                CASE 
                    WHEN rc.original_item_id IS NOT NULL THEN json_object(
                        'original_item_id', rc.original_item_id,
                        'new_reference_id', rc.new_reference_id,
                        'supplier_name', rc.supplier_name,
                        'changed_by_user', rc.changed_by_user,
                        'change_date', rc.change_date,
                        'notes', rc.notes,
                        'new_description', rc.new_description,
                        'new_english_description', rc.new_english_description,
                        'source', CASE 
                            WHEN rc.changed_by_user = 1 THEN 'user'
                            ELSE 'supplier'
                        END
                    )
                    ELSE NULL
                END as reference_change,
                CASE 
                    WHEN rc.original_item_id IS NOT NULL THEN 1
                    ELSE 0
                END as has_reference_change,
                CASE 
                    WHEN ri.referencing_items IS NOT NULL THEN 1
                    ELSE 0
                END as is_referenced_by,
                ri.referencing_items
            FROM item i
            LEFT JOIN LatestPrices p ON i.item_id = p.item_id AND p.rn = 1
            LEFT JOIN ReferenceChanges rc ON i.item_id = rc.original_item_id AND rc.rn = 1
            LEFT JOIN ReferencingItems ri ON i.item_id = ri.item_id
            WHERE trim(i.item_id) != '' AND i.item_id IS NOT NULL
            ORDER BY i.item_id
        `;
        return await this.executeQuery(sql);
    }

    async getItemById(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            WITH LatestPrices AS (
                SELECT 
                    item_id,
                    ils_retail_price,
                    qty_in_stock,
                    sold_this_year,
                    sold_last_year,
                    date,
                    ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY date DESC, history_id DESC) as rn
                FROM price_history
            ),
            ReferenceChanges AS (
                SELECT 
                    rc.original_item_id,
                    rc.new_reference_id,
                    s.name as supplier_name,
                    rc.changed_by_user,
                    rc.change_date,
                    rc.notes,
                    i2.hebrew_description as new_description,
                    i2.english_description as new_english_description,
                    ROW_NUMBER() OVER (PARTITION BY rc.original_item_id ORDER BY rc.change_date DESC) as rn
                FROM item_reference_change rc
                LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
                LEFT JOIN item i2 ON rc.new_reference_id = i2.item_id
            ),
            ReferencingItems AS (
                SELECT 
                    rc.new_reference_id as item_id,
                    GROUP_CONCAT(rc.original_item_id) as referencing_items
                FROM item_reference_change rc
                GROUP BY rc.new_reference_id
            )
            SELECT 
                i.*,
                p.ils_retail_price as retail_price,
                p.qty_in_stock,
                p.sold_this_year,
                p.sold_last_year,
                p.date as last_price_update,
                CASE 
                    WHEN rc.original_item_id IS NOT NULL THEN json_object(
                        'original_item_id', rc.original_item_id,
                        'new_reference_id', rc.new_reference_id,
                        'supplier_name', rc.supplier_name,
                        'changed_by_user', rc.changed_by_user,
                        'change_date', rc.change_date,
                        'notes', rc.notes,
                        'new_description', rc.new_description,
                        'new_english_description', rc.new_english_description,
                        'source', CASE 
                            WHEN rc.changed_by_user = 1 THEN 'user'
                            ELSE 'supplier'
                        END
                    )
                    ELSE NULL
                END as reference_change,
                CASE 
                    WHEN rc.original_item_id IS NOT NULL THEN 1
                    ELSE 0
                END as has_reference_change,
                CASE 
                    WHEN ri.referencing_items IS NOT NULL THEN 1
                    ELSE 0
                END as is_referenced_by,
                ri.referencing_items
            FROM item i
            LEFT JOIN LatestPrices p ON i.item_id = p.item_id AND p.rn = 1
            LEFT JOIN ReferenceChanges rc ON i.item_id = rc.original_item_id AND rc.rn = 1
            LEFT JOIN ReferencingItems ri ON i.item_id = ri.item_id
            WHERE i.item_id = ? AND trim(i.item_id) != '' AND i.item_id IS NOT NULL
        `;
        return await this.executeQuerySingle(sql, [cleanedId]);
    }

    async getPriceHistory(itemId) {
        const cleanedId = cleanItemId(itemId);
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
        return await this.executeQuery(sql, [cleanedId]);
    }

    async getSupplierPrices(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            SELECT 
                s.name as supplier_name,
                sr.price_quoted,
                sr.response_date,
                sr.status,
                sr.is_promotion,
                sr.promotion_name
            FROM supplier_response sr
            JOIN supplier s ON sr.supplier_id = s.supplier_id
            WHERE sr.item_id = ?
            ORDER BY sr.response_date DESC
        `;
        return await this.executeQuery(sql, [cleanedId]);
    }

    async getReferenceChanges(itemId) {
        const cleanedId = cleanItemId(itemId);
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
        return await this.executeQuery(sql, [cleanedId, cleanedId]);
    }

    async getItemFiles(itemId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            SELECT id, file_path, file_type, upload_date, description
            FROM item_files
            WHERE item_id = ?
            ORDER BY upload_date DESC
        `;
        return await this.executeQuery(sql, [cleanedId]);
    }

    async addItemFiles(itemId, files) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            INSERT INTO item_files (item_id, file_path, file_type, description)
            VALUES (?, ?, ?, ?)
        `;
        
        return await this.executeTransaction(async () => {
            const results = [];
            for (const file of files) {
                const result = await this.executeRun(sql, [
                    cleanedId,
                    file.filename,
                    file.mimetype,
                    file.originalname
                ]);
                results.push(result);
            }
            return results;
        });
    }

    async deleteItemFile(itemId, fileId) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            DELETE FROM item_files
            WHERE id = ? AND item_id = ?
        `;
        return await this.executeRun(sql, [fileId, cleanedId]);
    }

    async createItem(itemData) {
        try {
            debug.log('Creating item with data:', itemData);

            // Clean and validate item ID
            const cleanedId = cleanItemId(itemData.item_id);
            if (!cleanedId || cleanedId.trim() === '') {
                const error = new Error('Invalid item ID');
                error.code = 'INVALID_ITEM_ID';
                throw error;
            }
            
            // Check if item already exists
            const existingItem = await this.executeQuerySingle(
                'SELECT item_id FROM item WHERE item_id = ?',
                [cleanedId]
            );

            if (existingItem) {
                const error = new Error('Item already exists');
                error.code = 'DUPLICATE_ITEM';
                throw error;
            }

            return await this.executeTransaction(async () => {
                const {
                    hebrew_description,
                    english_description,
                    import_markup,
                    hs_code,
                    image,
                    qty_in_stock,
                    sold_this_year,
                    sold_last_year,
                    retail_price,
                    notes
                } = itemData;

                // Insert into item table
                const itemSql = `
                    INSERT INTO item (
                        item_id, hebrew_description, english_description, 
                        import_markup, hs_code, image, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                await this.executeRun(itemSql, [
                    cleanedId, hebrew_description, english_description,
                    import_markup, hs_code, image, notes
                ]);

                // Insert initial price history
                if (retail_price !== null || qty_in_stock !== null || 
                    sold_this_year !== null || sold_last_year !== null) {
                    const priceSql = `
                        INSERT INTO price_history (
                            item_id, ils_retail_price, qty_in_stock,
                            sold_this_year, sold_last_year
                        ) VALUES (?, ?, ?, ?, ?)
                    `;
                    await this.executeRun(priceSql, [
                        cleanedId, retail_price, qty_in_stock,
                        sold_this_year, sold_last_year
                    ]);
                }

                // Return the created item
                return await this.getItemById(cleanedId);
            });
        } catch (error) {
            if (error.code === 'DUPLICATE_ITEM' || error.code === 'INVALID_ITEM_ID') {
                throw error;
            }
            if (error.message.includes('UNIQUE constraint failed')) {
                const duplicateError = new Error('Item already exists');
                duplicateError.code = 'DUPLICATE_ITEM';
                throw duplicateError;
            }
            throw error;
        }
    }

    async updateItem(itemId, updateData) {
        const cleanedId = cleanItemId(itemId);
        return await this.executeTransaction(async () => {
            const {
                hebrew_description,
                english_description,
                import_markup,
                hs_code,
                image,
                qty_in_stock,
                sold_this_year,
                sold_last_year,
                retail_price,
                notes
            } = updateData;

            // Update item table
            const itemSql = `
                UPDATE item 
                SET hebrew_description = ?,
                    english_description = ?,
                    import_markup = ?,
                    hs_code = ?,
                    notes = ?
                    ${image ? ', image = ?' : ''}
                WHERE item_id = ?
            `;
            const itemParams = [
                hebrew_description,
                english_description,
                import_markup,
                hs_code,
                notes
            ];
            if (image) itemParams.push(image);
            itemParams.push(cleanedId);
            
            await this.executeRun(itemSql, itemParams);

            // Insert new price history if any price-related fields changed
            if (retail_price !== null || qty_in_stock !== null || 
                sold_this_year !== null || sold_last_year !== null) {
                const priceSql = `
                    INSERT INTO price_history (
                        item_id, ils_retail_price, qty_in_stock,
                        sold_this_year, sold_last_year
                    ) VALUES (?, ?, ?, ?, ?)
                `;
                await this.executeRun(priceSql, [
                    cleanedId, retail_price, qty_in_stock,
                    sold_this_year, sold_last_year
                ]);
            }
        });
    }

    async updateNotes(itemId, notes) {
        const cleanedId = cleanItemId(itemId);
        const sql = `
            UPDATE item 
            SET notes = ?
            WHERE item_id = ?
        `;
        await this.executeRun(sql, [notes, cleanedId]);
        return await this.getItemById(cleanedId);
    }

    /**
     * Delete an item and all its related records
     * @param {string} itemId - ID of the item to delete
     * @returns {Promise} - Resolves when deletion is complete
     */
    async deleteItem(itemId) {
        const cleanedId = cleanItemId(itemId);
        
        return await this.executeTransaction(async () => {
            try {
                debug.log('Starting deletion of item:', cleanedId);

                // First verify the item exists
                const item = await this.executeQuerySingle(
                    'SELECT item_id FROM item WHERE item_id = ?',
                    [cleanedId]
                );
                if (!item) {
                    throw new Error(`Item ${cleanedId} not found`);
                }

                // Delete records in order of dependency
                const deletionSteps = [
                    {
                        name: 'order_fulfillment',
                        sql: `
                            DELETE FROM order_fulfillment 
                            WHERE order_item_id IN (
                                SELECT order_item_id 
                                FROM order_item 
                                WHERE item_id = ?
                            )
                        `
                    },
                    {
                        name: 'order_items',
                        sql: 'DELETE FROM order_item WHERE item_id = ?'
                    },
                    {
                        name: 'supplier_response_items',
                        sql: `
                            DELETE FROM supplier_response_item 
                            WHERE item_id = ? OR new_reference_id = ?
                        `,
                        params: (id) => [id, id]
                    },
                    {
                        name: 'supplier_responses',
                        sql: 'DELETE FROM supplier_response WHERE item_id = ?'
                    },
                    {
                        name: 'inquiry_items',
                        sql: `
                            DELETE FROM inquiry_item 
                            WHERE item_id = ? OR original_item_id = ? OR new_reference_id = ?
                        `,
                        params: (id) => [id, id, id]
                    },
                    {
                        name: 'promotion_items',
                        sql: 'DELETE FROM promotion_item WHERE item_id = ?'
                    },
                    {
                        name: 'supplier_price_list',
                        sql: 'DELETE FROM supplier_price_list WHERE item_id = ?'
                    },
                    {
                        name: 'item_reference_changes',
                        sql: `
                            DELETE FROM item_reference_change 
                            WHERE original_item_id = ? OR new_reference_id = ?
                        `,
                        params: (id) => [id, id]
                    },
                    {
                        name: 'price_history',
                        sql: 'DELETE FROM price_history WHERE item_id = ?'
                    },
                    {
                        name: 'item_files',
                        sql: 'DELETE FROM item_files WHERE item_id = ?'
                    },
                    {
                        name: 'item',
                        sql: 'DELETE FROM item WHERE item_id = ?'
                    }
                ];

                // Execute each deletion step
                for (const step of deletionSteps) {
                    debug.log(`Deleting ${step.name}...`);
                    const params = step.params ? step.params(cleanedId) : [cleanedId];
                    await this.executeRun(step.sql, params);
                    debug.log(`Deleted ${step.name}`);
                }

                debug.log('Successfully deleted item and all related records');

            } catch (error) {
                debug.error('Error during item deletion:', error);
                debug.error('Error stack:', error.stack);
                throw error;
            }
        });
    }

    async addReferenceChange(originalItemId, newReferenceId, supplierId, notes) {
        const cleanedOriginalId = cleanItemId(originalItemId);
        const cleanedRefId = cleanItemId(newReferenceId);
        const sql = `
            INSERT INTO item_reference_change (
                original_item_id, new_reference_id, supplier_id,
                changed_by_user, notes, change_date
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        await this.executeRun(sql, [
            cleanedOriginalId,
            cleanedRefId,
            supplierId || null,
            supplierId ? 0 : 1,
            notes
        ]);
    }
}

module.exports = ItemModel;
