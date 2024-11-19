const BaseModel = require('./BaseModel');
const ExcelProcessor = require('../utils/excelProcessor/index');
const debug = require('../utils/debug');

class Promotion extends BaseModel {
    constructor(db) {
        super(db);
        this.tableName = 'promotions';
    }

    async createPromotion(data) {
        try {
            const result = await this.db.run(
                'INSERT INTO promotions (title, description, start_date, end_date) VALUES (?, ?, ?, ?)',
                [data.title, data.description, data.startDate, data.endDate]
            );
            return this.getPromotionById(result.lastID);
        } catch (error) {
            debug.error('Error creating promotion:', error);
            throw error;
        }
    }

    async getPromotionById(id) {
        try {
            return await this.db.get('SELECT * FROM promotions WHERE id = ?', id);
        } catch (error) {
            debug.error('Error getting promotion:', error);
            throw error;
        }
    }

    async getAllPromotions() {
        try {
            return await this.db.all('SELECT * FROM promotions ORDER BY created_at DESC');
        } catch (error) {
            debug.error('Error getting all promotions:', error);
            throw error;
        }
    }

    async updatePromotion(id, data) {
        try {
            await this.db.run(
                'UPDATE promotions SET title = ?, description = ?, start_date = ?, end_date = ? WHERE id = ?',
                [data.title, data.description, data.startDate, data.endDate, id]
            );
            return this.getPromotionById(id);
        } catch (error) {
            debug.error('Error updating promotion:', error);
            throw error;
        }
    }

    async deletePromotion(id) {
        try {
            const result = await this.db.run('DELETE FROM promotions WHERE id = ?', id);
            return result.changes > 0;
        } catch (error) {
            debug.error('Error deleting promotion:', error);
            throw error;
        }
    }

    async processPromotionUpload(file) {
        try {
            const { data } = await ExcelProcessor.readExcelFile(file.path);
            
            // Process and validate data
            const processedData = data
                .map(row => ({
                    itemId: row.itemId?.toString(),
                    promotionPrice: parseFloat(row.promotionPrice),
                    startDate: row.startDate,
                    endDate: row.endDate
                }))
                .filter(item => 
                    item.itemId && 
                    !isNaN(item.promotionPrice) && 
                    item.promotionPrice > 0
                );

            if (processedData.length === 0) {
                throw new Error('No valid promotion items found in file');
            }

            // Insert promotion items
            const insertPromises = processedData.map(item =>
                this.db.run(
                    'INSERT INTO promotion_items (item_id, promotion_price, start_date, end_date) VALUES (?, ?, ?, ?)',
                    [item.itemId, item.promotionPrice, item.startDate, item.endDate]
                )
            );

            await Promise.all(insertPromises);

            return {
                message: 'Promotion items uploaded successfully',
                itemCount: processedData.length
            };
        } catch (error) {
            debug.error('Error processing promotion upload:', error);
            throw error;
        }
    }
}

module.exports = Promotion;
