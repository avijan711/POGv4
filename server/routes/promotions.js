const express = require('express');
const multer = require('multer');
const debug = require('../utils/debug');
const { uploadConfig, cleanupFile } = require('../middleware/upload');
const { validateUpload, handleErrors } = require('../middleware/promotionMiddleware');
const PromotionService = require('../services/promotionService');
const { DatabaseAccessLayer } = require('../config/database');

function createRouter({ db, promotionModel }) {
    if (!db) {
        throw new Error('Database instance is required');
    }

    if (!promotionModel) {
        throw new Error('Promotion model instance is required');
    }

    const router = express.Router();
    const upload = multer(uploadConfig);
    
    // Create DatabaseAccessLayer instance for the service
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    const promotionService = new PromotionService(dal);

    // Get all promotions
    router.get('/', async function(req, res, next) {
        try {
            debug.log('Fetching all promotions');
            const promotions = await promotionService.getPromotions();
            res.json({
                success: true,
                data: promotions
            });
        } catch (err) {
            next(err);
        }
    });

    // Get active promotions
    router.get('/active', async function(req, res, next) {
        try {
            debug.log('Fetching active promotions');
            const currentDate = new Date().toISOString().split('T')[0];
            const promotions = await promotionModel.getActivePromotions(currentDate);
            res.json({
                success: true,
                data: promotions
            });
        } catch (err) {
            next(err);
        }
    });

    // Get promotion items with pagination and search
    router.get('/:promotion_id/items', async function(req, res, next) {
        try {
            // Parse query parameters, ensuring numbers are properly converted
            const page = req.query.page ? parseInt(req.query.page, 10) : 1;
            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize, 10) : 1000;
            const search = (req.query.search || '').trim();

            debug.log('Fetching items for promotion:', {
                promotionId: req.params.promotion_id,
                page,
                pageSize,
                search,
                rawQuery: req.query // Log raw query for debugging
            });

            const result = await promotionService.getPromotionItems(req.params.promotion_id, {
                page,
                pageSize,
                search
            });

            res.json({
                success: true,
                data: result.items,
                pagination: result.pagination
            });
        } catch (err) {
            next(err);
        }
    });

    // Get columns from Excel file
    router.post('/columns', upload.single('file'), validateUpload, async function(req, res, next) {
        let processingComplete = false;
        try {
            debug.log('Processing Excel columns request:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                fieldname: req.file.fieldname
            });

            const columns = await promotionService.getExcelColumns(req.file);
            processingComplete = true;

            res.json({
                success: true,
                data: {
                    columns,
                    tempFile: req.file.filename
                }
            });

            // Clean up file after successful response
            if (req.file?.path) {
                cleanupFile(req.file.path);
            }
        } catch (error) {
            debug.error('Error processing columns:', error);
            
            // Clean up file if processing failed
            if (!processingComplete && req.file?.path) {
                cleanupFile(req.file.path);
            }

            // Send error response
            res.status(400).json({
                error: 'Failed to process Excel file',
                message: error.message,
                code: 'EXCEL_PROCESSING_ERROR'
            });
        }
    });

    // Upload new promotion
    router.post('/upload', upload.single('file'), validateUpload, async function(req, res, next) {
        let processingComplete = false;

        try {
            debug.log('Processing promotion upload request:', {
                name: req.body.name,
                supplier_id: req.body.supplier_id,
                start_date: req.body.start_date,
                end_date: req.body.end_date
            });

            const result = await promotionService.processPromotionUpload(
                req.file,
                req.body.name,
                req.body.supplier_id,
                req.body.start_date,
                req.body.end_date,
                req.body.column_mapping
            );

            processingComplete = true;

            res.json({
                success: true,
                data: result,
                message: 'Promotion uploaded successfully'
            });

            // Clean up file after response is sent and processing is complete
            if (req.file?.path) {
                cleanupFile(req.file.path);
            }
        } catch (error) {
            // Only clean up if processing failed
            if (!processingComplete && req.file?.path) {
                cleanupFile(req.file.path);
            }
            next(error);
        }
    });

    // Delete promotion
    router.delete('/:promotion_id', async function(req, res, next) {
        try {
            debug.log('Processing promotion delete request:', req.params.promotion_id);
            const result = await promotionService.deletePromotion(req.params.promotion_id);
            
            if (result.deleted) {
                res.json({
                    success: true,
                    message: 'Promotion deleted successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Promotion not found',
                    code: 'PROMOTION_NOT_FOUND'
                });
            }
        } catch (err) {
            next(err);
        }
    });

    // Error handling middleware
    router.use(handleErrors);

    return router;
}

module.exports = createRouter;
