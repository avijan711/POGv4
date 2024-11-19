const express = require('express');
const multer = require('multer');
const fs = require('fs');
const ExcelProcessor = require('../utils/excelProcessor/index');
const cors = require('cors');
const debug = require('../utils/debug');
const { uploadConfig } = require('../middleware/upload');

function createRouter(db) {
    const router = express.Router();
    const upload = multer(uploadConfig);

    // Enable CORS
    router.use(cors());

    // Get all promotions
    router.get('/', async (req, res, next) => {
        try {
            const promotions = await db.all('SELECT * FROM promotions ORDER BY created_at DESC');
            res.json(promotions);
        } catch (err) {
            next(err);
        }
    });

    // Get specific promotion
    router.get('/:id', async (req, res, next) => {
        try {
            const promotion = await db.get('SELECT * FROM promotions WHERE id = ?', req.params.id);
            if (!promotion) {
                return res.status(404).json({ error: 'Promotion not found' });
            }
            res.json(promotion);
        } catch (err) {
            next(err);
        }
    });

    // Create new promotion
    router.post('/', async (req, res, next) => {
        try {
            const result = await db.run(
                'INSERT INTO promotions (title, description, start_date, end_date) VALUES (?, ?, ?, ?)',
                [req.body.title, req.body.description, req.body.startDate, req.body.endDate]
            );
            const promotion = await db.get('SELECT * FROM promotions WHERE id = ?', result.lastID);
            res.status(201).json(promotion);
        } catch (err) {
            next(err);
        }
    });

    // Update promotion
    router.put('/:id', async (req, res, next) => {
        try {
            await db.run(
                'UPDATE promotions SET title = ?, description = ?, start_date = ?, end_date = ? WHERE id = ?',
                [req.body.title, req.body.description, req.body.startDate, req.body.endDate, req.params.id]
            );
            const promotion = await db.get('SELECT * FROM promotions WHERE id = ?', req.params.id);
            if (!promotion) {
                return res.status(404).json({ error: 'Promotion not found' });
            }
            res.json(promotion);
        } catch (err) {
            next(err);
        }
    });

    // Delete promotion
    router.delete('/:id', async (req, res, next) => {
        try {
            const result = await db.run('DELETE FROM promotions WHERE id = ?', req.params.id);
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Promotion not found' });
            }
            res.json({ message: 'Promotion deleted successfully' });
        } catch (err) {
            next(err);
        }
    });

    // Upload promotion items
    router.post('/upload', upload.single('file'), async (req, res, next) => {
        try {
            if (!req.file) {
                throw new Error('No file uploaded');
            }

            const { data } = await ExcelProcessor.readExcelFile(req.file.path);
            
            // Process and validate data
            const processedData = data.map(row => ({
                itemId: row.itemId?.toString(),
                promotionPrice: parseFloat(row.promotionPrice),
                startDate: row.startDate,
                endDate: row.endDate
            })).filter(item => 
                item.itemId && 
                !isNaN(item.promotionPrice) && 
                item.promotionPrice > 0
            );

            if (processedData.length === 0) {
                throw new Error('No valid promotion items found in file');
            }

            // Insert promotion items
            const insertPromises = processedData.map(item =>
                db.run(
                    'INSERT INTO promotion_items (item_id, promotion_price, start_date, end_date) VALUES (?, ?, ?, ?)',
                    [item.itemId, item.promotionPrice, item.startDate, item.endDate]
                )
            );

            await Promise.all(insertPromises);

            // Cleanup uploaded file
            fs.unlinkSync(req.file.path);

            res.json({
                message: 'Promotion items uploaded successfully',
                itemCount: processedData.length
            });
        } catch (err) {
            if (req.file?.path) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (cleanupErr) {
                    debug.error('Error cleaning up file:', cleanupErr);
                }
            }
            next(err);
        }
    });

    return router;
}

module.exports = createRouter;
