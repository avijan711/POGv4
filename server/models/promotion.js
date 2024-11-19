const BaseModel = require('./BaseModel');
const ExcelProcessor = require('../utils/excelProcessor/index');
const debug = require('../utils/debug');

class Promotion extends BaseModel {
    constructor(db) {
        super(db);
        this.tableName = 'promotions';
        this.progressCallbacks = new Map();
    }

    setProgressCallback(uploadId, callback) {
        this.progressCallbacks.set(uploadId, callback);
    }

    removeProgressCallback(uploadId) {
        this.progressCallbacks.delete(uploadId);
    }

    updateProgress(uploadId, progress) {
        const callback = this.progressCallbacks.get(uploadId);
        if (callback) {
            callback(progress);
        }
    }

    async createPromotion(data) {
        try {
            const result = await this.executeRun(
                'INSERT INTO promotions (name, supplier_id, start_date, end_date) VALUES (?, ?, ?, ?)',
                [data.name, data.supplierId, data.startDate, data.endDate]
            );
            return this.getPromotionById(result.lastID);
        } catch (error) {
            debug.error('Error creating promotion:', error);
            throw error;
        }
    }

    async getPromotionById(id) {
        try {
            const promotion = await this.executeQuerySingle(`
                SELECT 
                    p.*,
                    s.Name as SupplierName,
                    (SELECT COUNT(*) FROM promotion_items WHERE promotion_id = p.id) as ItemCount
                FROM promotions p
                LEFT JOIN Supplier s ON p.supplier_id = s.SupplierID
                WHERE p.id = ?
            `, [id]);

            if (!promotion) {
                return null;
            }

            const items = await this.executeQuery(`
                SELECT item_id as ItemID, promotion_price as PromoPrice
                FROM promotion_items
                WHERE promotion_id = ?
            `, [id]);

            return {
                ...promotion,
                items: items || []
            };
        } catch (error) {
            debug.error('Error getting promotion:', error);
            throw error;
        }
    }

    async getAllPromotions() {
        try {
            return await this.executeQuery(`
                SELECT 
                    p.*,
                    s.Name as SupplierName,
                    (SELECT COUNT(*) FROM promotion_items WHERE promotion_id = p.id) as ItemCount
                FROM promotions p
                LEFT JOIN Supplier s ON p.supplier_id = s.SupplierID
                ORDER BY p.created_at DESC
            `);
        } catch (error) {
            debug.error('Error getting all promotions:', error);
            throw error;
        }
    }

    async updatePromotion(id, data) {
        try {
            await this.executeRun(
                'UPDATE promotions SET name = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?',
                [data.name, data.startDate, data.endDate, data.isActive, id]
            );
            return this.getPromotionById(id);
        } catch (error) {
            debug.error('Error updating promotion:', error);
            throw error;
        }
    }

    async deletePromotion(id) {
        try {
            const result = await this.executeRun('DELETE FROM promotions WHERE id = ?', [id]);
            return result.changes > 0;
        } catch (error) {
            debug.error('Error deleting promotion:', error);
            throw error;
        }
    }

    validatePromotionData(data) {
        const errors = [];

        // Validate dates
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const now = new Date();

        if (isNaN(startDate.getTime())) {
            errors.push('Invalid start date');
        }
        if (isNaN(endDate.getTime())) {
            errors.push('Invalid end date');
        }
        if (startDate > endDate) {
            errors.push('Start date must be before end date');
        }
        if (endDate < now) {
            errors.push('End date must be in the future');
        }

        // Validate other fields
        if (!data.name?.trim()) {
            errors.push('Name is required');
        }
        if (!data.supplierId) {
            errors.push('Supplier is required');
        }

        return errors;
    }

    validatePromotionItem(item) {
        if (!item.itemId?.toString().trim()) {
            return 'Invalid item ID';
        }
        if (isNaN(item.promotionPrice) || item.promotionPrice <= 0) {
            return 'Invalid price';
        }
        return null;
    }

    async processPromotionUpload(file, data) {
        try {
            debug.log('Starting promotion upload processing');
            
            // Validate promotion data
            const validationErrors = this.validatePromotionData(data);
            if (validationErrors.length > 0) {
                throw new Error('Validation failed: ' + validationErrors.join(', '));
            }

            this.updateProgress(data.uploadId, { 
                status: 'Reading Excel file...',
                progress: 0 
            });

            debug.log('Reading Excel file:', file.path);
            const { data: excelData } = await ExcelProcessor.readExcelFile(file.path);
            debug.log(`Found ${excelData.length} rows in Excel file`);
            
            this.updateProgress(data.uploadId, { 
                status: 'Processing data...',
                progress: 10 
            });

            // Process and validate data
            const processedData = [];
            const errors = [];
            const seenItems = new Set();

            excelData.forEach((row, index) => {
                const item = {
                    itemId: row[data.itemIdColumn]?.toString().trim(),
                    promotionPrice: parseFloat(row[data.priceColumn])
                };

                const error = this.validatePromotionItem(item);
                if (error) {
                    errors.push(`Row ${index + 1}: ${error}`);
                    return;
                }

                // Check for duplicates
                if (seenItems.has(item.itemId)) {
                    errors.push(`Row ${index + 1}: Duplicate item ID ${item.itemId}`);
                    return;
                }

                seenItems.add(item.itemId);
                processedData.push(item);
            });

            if (errors.length > 0) {
                throw new Error('Validation errors:\n' + errors.join('\n'));
            }

            if (processedData.length === 0) {
                throw new Error('No valid promotion items found in file');
            }

            this.updateProgress(data.uploadId, { 
                status: 'Creating promotion...',
                progress: 20 
            });

            return await this.executeTransaction(async () => {
                // Create promotion
                debug.log('Creating promotion record');
                const promotionResult = await this.executeRun(
                    'INSERT INTO promotions (name, supplier_id, start_date, end_date) VALUES (?, ?, ?, ?)',
                    [data.name, data.supplierId, data.startDate, data.endDate]
                );

                // Insert promotion items
                debug.log('Inserting promotion items');
                this.updateProgress(data.uploadId, { 
                    status: 'Inserting promotion items...',
                    progress: 60 
                });

                let processedCount = 0;
                const batchSize = 100;
                
                for (let i = 0; i < processedData.length; i += batchSize) {
                    const batch = processedData.slice(i, i + batchSize);
                    await Promise.all(batch.map(item =>
                        this.executeRun(
                            'INSERT INTO promotion_items (promotion_id, item_id, promotion_price) VALUES (?, ?, ?)',
                            [promotionResult.lastID, item.itemId, item.promotionPrice]
                        )
                    ));
                    processedCount += batch.length;
                    const progress = 60 + Math.floor((processedCount / processedData.length) * 40);
                    this.updateProgress(data.uploadId, { 
                        status: `Processing items (${processedCount}/${processedData.length})...`,
                        progress 
                    });
                    debug.log(`Processed ${processedCount}/${processedData.length} items`);
                }

                this.updateProgress(data.uploadId, { 
                    status: 'Complete',
                    progress: 100 
                });

                debug.log('Promotion upload completed successfully');
                return {
                    message: 'Promotion created successfully',
                    promotionId: promotionResult.lastID,
                    itemCount: processedData.length
                };
            });
        } catch (error) {
            debug.error('Error processing promotion upload:', error);
            this.updateProgress(data.uploadId, { 
                status: 'Error: ' + error.message,
                progress: 0 
            });
            throw error;
        }
    }

    async getPromotionItems(promotionId, page = 1, pageSize = 100) {
        try {
            const offset = (page - 1) * pageSize;

            const totalItems = await this.executeQuerySingle(
                'SELECT COUNT(*) as count FROM promotion_items WHERE promotion_id = ?',
                [promotionId]
            );

            const items = await this.executeQuery(`
                SELECT item_id as ItemID, promotion_price as PromoPrice
                FROM promotion_items
                WHERE promotion_id = ?
                LIMIT ? OFFSET ?
            `, [promotionId, pageSize, offset]);

            return {
                items: items || [],
                totalItems: totalItems.count,
                totalPages: Math.ceil(totalItems.count / pageSize),
                currentPage: page
            };
        } catch (error) {
            debug.error('Error getting promotion items:', error);
            throw error;
        }
    }
}

module.exports = Promotion;
