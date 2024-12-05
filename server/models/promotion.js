const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');

class PromotionModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    get schema() {
        return `
            CREATE TABLE IF NOT EXISTS promotion (
                promotion_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                supplier_id INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (supplier_id) REFERENCES supplier (supplier_id)
            );

            CREATE TABLE IF NOT EXISTS promotion_item (
                promotion_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                promotion_id INTEGER NOT NULL,
                item_id TEXT NOT NULL,
                promotion_price REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (promotion_id) REFERENCES promotion (promotion_id) ON DELETE CASCADE
            );

            -- Indexes for better query performance
            CREATE INDEX IF NOT EXISTS idx_promotion_supplier 
            ON promotion (supplier_id);

            CREATE INDEX IF NOT EXISTS idx_promotion_dates 
            ON promotion (start_date, end_date);

            CREATE INDEX IF NOT EXISTS idx_promotion_active 
            ON promotion (is_active);

            CREATE INDEX IF NOT EXISTS idx_promotion_item_promotion 
            ON promotion_item (promotion_id);

            CREATE INDEX IF NOT EXISTS idx_promotion_item_item 
            ON promotion_item (item_id);
        `;
    }

    async initialize() {
        debug.log('Initializing promotion tables...');
        
        return await this.executeTransaction(async () => {
            const statements = this.schema.split(';').filter(stmt => stmt.trim());
            for (const stmt of statements) {
                await this.executeRun(stmt);
            }
            debug.log('Promotion tables initialized successfully');
        });
    }

    async createPromotion({ name, supplier_id, start_date, end_date }) {
        return await this.executeTransaction(async () => {
            const sql = `
                INSERT INTO promotion (
                    name, supplier_id, start_date, end_date, is_active
                ) VALUES (?, ?, ?, ?, 1)
            `;
            const result = await this.executeRun(sql, [
                name,
                supplier_id,
                start_date,
                end_date
            ]);
            return {
                success: true,
                promotionId: result.lastID,
                message: 'Promotion created successfully'
            };
        });
    }

    async deletePromotion(promotionId) {
        const sql = `
            UPDATE promotion 
            SET is_active = 0 
            WHERE promotion_id = ?
        `;
        const result = await this.executeRun(sql, [promotionId]);
        return { deleted: result.changes > 0 };
    }

    async getActivePromotions(date = null) {
        const currentDate = date || new Date().toISOString().split('T')[0];
        const sql = `
            SELECT 
                p.*,
                s.name as supplier_name,
                COUNT(pi.item_id) as item_count
            FROM promotion p
            LEFT JOIN supplier s ON p.supplier_id = s.supplier_id
            LEFT JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
            WHERE date(p.start_date) <= date(?)
            AND date(p.end_date) >= date(?)
            AND p.is_active = 1
            GROUP BY p.promotion_id
            ORDER BY p.created_at DESC
        `;
        return await this.executeQuery(sql, [currentDate, currentDate]);
    }

    async getPromotionPrice(itemId, date = null) {
        const currentDate = date || new Date().toISOString().split('T')[0];
        const sql = `
            SELECT 
                pi.promotion_price as price,
                p.promotion_id,
                p.name as promotion_name,
                s.supplier_id,
                s.name as supplier_name
            FROM promotion_item pi
            INNER JOIN promotion p ON pi.promotion_id = p.promotion_id
            INNER JOIN supplier s ON p.supplier_id = s.supplier_id
            WHERE pi.item_id = ?
            AND date(p.start_date) <= date(?)
            AND date(p.end_date) >= date(?)
            AND p.is_active = 1
            ORDER BY p.created_at DESC
            LIMIT 1
        `;
        return await this.executeQuerySingle(sql, [itemId, currentDate, currentDate]);
    }

    async getPromotionItems(promotionId) {
        const sql = `
            SELECT 
                pi.*,
                i.hebrew_description,
                i.english_description,
                i.origin
            FROM promotion_item pi
            LEFT JOIN item i ON pi.item_id = i.item_id
            WHERE pi.promotion_id = ?
            ORDER BY pi.item_id
        `;
        return await this.executeQuery(sql, [promotionId]);
    }

    async getSupplierPromotions(supplierId) {
        const sql = `
            SELECT 
                p.*,
                COUNT(pi.item_id) as item_count
            FROM promotion p
            LEFT JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
            WHERE p.supplier_id = ?
            AND p.is_active = 1
            GROUP BY p.promotion_id
            ORDER BY p.created_at DESC
        `;
        return await this.executeQuery(sql, [supplierId]);
    }
}

module.exports = PromotionModel;
