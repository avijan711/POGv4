const express = require('express');
const multer = require('multer');
const fs = require('fs');
const debug = require('../utils/debug');
const { uploadConfig } = require('../middleware/upload');

function createRouter(promotionModel) {
    const router = express.Router();
    const upload = multer(uploadConfig);

    // SSE endpoint for progress updates
    router.get('/progress/:uploadId', (req, res) => {
        const uploadId = req.params.uploadId;
        
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const sendProgress = (progress) => {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        };

        // Store the sendProgress function for this upload
        promotionModel.setProgressCallback(uploadId, sendProgress);

        // Clean up when client disconnects
        req.on('close', () => {
            promotionModel.removeProgressCallback(uploadId);
        });
    });

    // Get active promotions
    router.get('/active', async (req, res, next) => {
        try {
            const promotions = await promotionModel.getActivePromotions();
            res.json(promotions || []);
        } catch (err) {
            debug.error('Error getting active promotions:', err);
            next(err);
        }
    });

    // Get all promotions
    router.get('/', async (req, res, next) => {
        try {
            const promotions = await promotionModel.getAllPromotions();
            res.json(promotions || []);
        } catch (err) {
            debug.error('Error getting promotions:', err);
            next(err);
        }
    });

    // Get specific promotion with items
    router.get('/:id', async (req, res, next) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 100;

            const promotion = await promotionModel.getPromotionById(req.params.id);
            if (!promotion) {
                return res.status(404).json({ error: 'Promotion not found' });
            }

            const items = await promotionModel.getPromotionItems(req.params.id, page, pageSize);

            res.json({
                ...promotion,
                ...items
            });
        } catch (err) {
            debug.error('Error getting promotion details:', err);
            next(err);
        }
    });

    // Create new promotion
    router.post('/', async (req, res, next) => {
        try {
            const promotion = await promotionModel.createPromotion(req.body);
            res.status(201).json(promotion);
        } catch (err) {
            debug.error('Error creating promotion:', err);
            next(err);
        }
    });

    // Update promotion
    router.put('/:id', async (req, res, next) => {
        try {
            const promotion = await promotionModel.updatePromotion(req.params.id, req.body);
            if (!promotion) {
                return res.status(404).json({ error: 'Promotion not found' });
            }
            res.json(promotion);
        } catch (err) {
            debug.error('Error updating promotion:', err);
            next(err);
        }
    });

    // Delete promotion
    router.delete('/:id', async (req, res, next) => {
        try {
            const result = await promotionModel.deletePromotion(req.params.id);
            if (!result) {
                return res.status(404).json({ error: 'Promotion not found' });
            }
            res.json({ message: 'Promotion deleted successfully' });
        } catch (err) {
            debug.error('Error deleting promotion:', err);
            next(err);
        }
    });

    // Upload promotion items
    router.post('/upload', upload.single('excelFile'), async (req, res, next) => {
        try {
            debug.log('Starting promotion upload process');
            debug.log('Request body:', req.body);
            debug.log('File:', req.file ? {
                filename: req.file.filename,
                size: req.file.size,
                path: req.file.path
            } : 'No file');

            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded',
                    details: 'Please select a file to upload',
                    suggestion: 'Make sure you have selected an Excel file'
                });
            }

            const missingFields = {
                name: !req.body.name,
                supplierId: !req.body.supplierId,
                startDate: !req.body.startDate,
                endDate: !req.body.endDate
            };

            if (Object.values(missingFields).some(missing => missing)) {
                debug.error('Missing required fields:', missingFields);
                
                // Clean up the uploaded file
                if (req.file?.path) {
                    try {
                        fs.unlinkSync(req.file.path);
                        debug.log('Cleaned up file after validation error');
                    } catch (cleanupErr) {
                        debug.error('Error cleaning up file:', cleanupErr);
                    }
                }

                return res.status(400).json({
                    error: 'Missing required fields',
                    details: 'Please provide all required fields',
                    missingFields: Object.keys(missingFields).filter(field => missingFields[field]),
                    suggestion: 'Please fill in all required fields and try again'
                });
            }

            // Generate unique upload ID
            const uploadId = Date.now().toString();

            // Send initial response with upload ID
            res.json({ uploadId });

            // Process the upload asynchronously
            promotionModel.processPromotionUpload(req.file, {
                name: req.body.name,
                supplierId: req.body.supplierId,
                startDate: req.body.startDate,
                endDate: req.body.endDate,
                itemIdColumn: req.body.itemIdColumn,
                priceColumn: req.body.priceColumn,
                uploadId
            }).then(() => {
                debug.log('Promotion upload successful');
                // Clean up the uploaded file
                fs.unlinkSync(req.file.path);
                debug.log('Cleaned up uploaded file');
            }).catch(err => {
                debug.error('Error processing promotion upload:', err);
                if (req.file?.path) {
                    try {
                        fs.unlinkSync(req.file.path);
                        debug.log('Cleaned up file after error');
                    } catch (cleanupErr) {
                        debug.error('Error cleaning up file:', cleanupErr);
                    }
                }
            });
        } catch (err) {
            if (req.file?.path) {
                try {
                    fs.unlinkSync(req.file.path);
                    debug.log('Cleaned up file after error');
                } catch (cleanupErr) {
                    debug.error('Error cleaning up file:', cleanupErr);
                }
            }
            debug.error('Error processing promotion upload:', err);
            next(err);
        }
    });

    // Get columns from Excel file
    router.post('/columns', upload.single('excelFile'), async (req, res, next) => {
        try {
            debug.log('Starting column detection process');
            debug.log('File:', req.file ? {
                filename: req.file.filename,
                size: req.file.size,
                path: req.file.path
            } : 'No file');

            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded',
                    details: 'Please select a file to upload',
                    suggestion: 'Please ensure you have selected an Excel file'
                });
            }

            const ExcelProcessor = require('../utils/excelProcessor');
            const { headers } = await ExcelProcessor.readExcelFile(req.file.path);

            debug.log('Detected columns:', headers);

            // Cleanup uploaded file
            fs.unlinkSync(req.file.path);
            debug.log('Cleaned up uploaded file');

            res.json({ columns: headers });
        } catch (err) {
            if (req.file?.path) {
                try {
                    fs.unlinkSync(req.file.path);
                    debug.log('Cleaned up file after error');
                } catch (cleanupErr) {
                    debug.error('Error cleaning up file:', cleanupErr);
                }
            }
            debug.error('Error getting Excel columns:', err);
            next(err);
        }
    });

    return router;
}

module.exports = createRouter;
