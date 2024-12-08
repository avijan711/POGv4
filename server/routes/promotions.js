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

    // Get promotion items
    router.get('/:promotion_id/items', async function(req, res, next) {
        try {
            debug.log('Fetching items for promotion:', req.params.promotion_id);
            const items = await promotionService.getPromotionItems(req.params.promotion_id);
            res.json({
                success: true,
                data: items
            });
        } catch (err) {
            next(err);
        }
    });

    // Get columns from Excel file
    router.post('/columns', upload.single('file'), validateUpload, async function(req, res, next) {
        try {
            debug.log('Processing Excel columns request:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                fieldname: req.file.fieldname
            });

            const columns = await promotionService.getExcelColumns(req.file);
            res.json({
                success: true,
                data: {
                    columns,
                    tempFile: req.file.filename
                }
            });
        } catch (error) {
            if (req.file?.path) {
                cleanupFile(req.file.path);
            }
            next(error);
        }
    });

    // Upload new promotion
    router.post('/upload', upload.single('file'), validateUpload, async function(req, res, next) {
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

            // Cleanup uploaded file
            if (req.file?.path) {
                cleanupFile(req.file.path);
            }

            res.json({
                success: true,
                data: result,
                message: 'Promotion uploaded successfully'
            });
        } catch (error) {
            if (req.file?.path) {
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
