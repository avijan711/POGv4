const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Promotion = require('../models/promotion');
const ExcelProcessor = require('../utils/excelProcessor');
const cors = require('cors');

module.exports = function(db) {
    const router = express.Router();
    console.log('Initializing promotions router');

    // Enable CORS
    router.use(cors({
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));

    // Ensure uploads directory exists
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
        console.log('Creating uploads directory:', uploadDir);
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Configure multer for Excel file uploads
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            console.log('Storing file in:', uploadDir);
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = 'promotion-' + uniqueSuffix + path.extname(file.originalname);
            console.log('Generated filename:', filename);
            cb(null, filename);
        }
    });

    const fileFilter = (req, file, cb) => {
        console.log('Checking file:', file.originalname);
        const ext = path.extname(file.originalname).toLowerCase();
        console.log('File extension:', ext);
        if (ext === '.xlsx' || ext === '.xls') {
            console.log('File type accepted');
            cb(null, true);
        } else {
            console.log('File type rejected');
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    };

    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 50 * 1024 * 1024 // 50MB limit
        }
    });

    // Get Excel columns
    router.post('/columns', upload.single('excelFile'), async (req, res) => {
        console.log('POST /columns - Getting Excel columns');
        try {
            if (!req.file) {
                console.log('No file uploaded');
                return res.status(400).json({ error: 'Excel file is required' });
            }

            console.log('Processing file:', req.file.path);
            const columns = await ExcelProcessor.getExcelColumns(req.file.path);
            console.log('Found columns:', columns);
            
            // Clean up the uploaded file since we only needed it for columns
            fs.unlinkSync(req.file.path);
            console.log('Cleaned up temporary file');
            
            res.json({ columns });
        } catch (error) {
            console.error('Error reading Excel columns:', error);
            // Clean up file if it exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
                console.log('Cleaned up file after error');
            }
            res.status(500).json({ error: error.message });
        }
    });

    // Create a new promotion group from Excel file
    router.post('/', upload.single('excelFile'), async (req, res) => {
        console.log('POST / - Creating new promotion');
        console.log('Request body:', req.body);
        try {
            const { name, startDate, endDate, supplierId, itemIdColumn, priceColumn } = req.body;
            
            if (!req.file) {
                console.log('No file uploaded');
                return res.status(400).json({ error: 'Excel file is required' });
            }

            if (!name || !startDate || !endDate || !supplierId || !itemIdColumn || !priceColumn) {
                console.log('Missing required fields:', { name, startDate, endDate, supplierId, itemIdColumn, priceColumn });
                return res.status(400).json({ 
                    error: 'Name, start date, end date, supplier, item ID column, and price column are required' 
                });
            }

            console.log('Processing Excel file:', req.file.path);
            const items = await ExcelProcessor.processPromotionExcel(
                req.file.path,
                itemIdColumn,
                priceColumn
            );
            console.log('Processed items:', items.length);

            // Create promotion group
            const groupId = await Promotion.createPromotionGroup(
                name,
                startDate,
                endDate,
                supplierId,
                req.file.path,
                items
            );
            console.log('Created promotion group:', groupId);

            res.status(201).json({ 
                message: 'Promotion group created successfully',
                groupId 
            });
        } catch (error) {
            console.error('Error creating promotion group:', error);
            // Clean up file if it exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
                console.log('Cleaned up file after error');
            }
            res.status(500).json({ error: error.message });
        }
    });

    // Get all active promotions
    router.get('/active', async (req, res) => {
        console.log('GET /active - Getting active promotions');
        try {
            const promotions = await Promotion.getActivePromotions();
            console.log('Found active promotions:', promotions.length);
            res.json(promotions);
        } catch (error) {
            console.error('Error getting active promotions:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get promotion group details with pagination
    router.get('/:groupId', async (req, res) => {
        const groupId = req.params.groupId;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 100;
        
        console.log('GET /:groupId - Getting promotion details for ID:', groupId);
        console.log('Pagination:', { page, pageSize });
        
        try {
            const details = await Promotion.getPromotionGroupDetails(groupId, page, pageSize);
            if (!details) {
                console.log('Promotion group not found');
                return res.status(404).json({ error: 'Promotion group not found' });
            }
            console.log('Found promotion details:', {
                id: details.PromotionGroupID,
                name: details.Name,
                totalItems: details.totalItems,
                currentPage: details.currentPage,
                totalPages: details.totalPages
            });
            res.json(details);
        } catch (error) {
            console.error('Error getting promotion details:', error);
            if (error.message === 'Promotion group not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    // Update promotion group
    router.put('/:groupId', async (req, res) => {
        const groupId = req.params.groupId;
        console.log('PUT /:groupId - Updating promotion group:', groupId);
        console.log('Update data:', req.body);
        try {
            const { name, startDate, endDate, isActive } = req.body;

            if (!name || !startDate || !endDate) {
                console.log('Missing required fields');
                return res.status(400).json({ error: 'Name, start date, and end date are required' });
            }

            const result = await Promotion.updatePromotionGroup(groupId, {
                name,
                startDate,
                endDate,
                isActive: isActive !== undefined ? isActive : true
            });

            if (!result) {
                console.log('Promotion group not found');
                return res.status(404).json({ error: 'Promotion group not found' });
            }

            console.log('Promotion group updated successfully');
            res.json({ message: 'Promotion group updated successfully' });
        } catch (error) {
            console.error('Error updating promotion group:', error);
            if (error.message === 'Promotion group not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    // Delete promotion group
    router.delete('/:groupId', async (req, res) => {
        const groupId = req.params.groupId;
        console.log('DELETE /:groupId - Deleting promotion group:', groupId);
        try {
            const result = await Promotion.deletePromotionGroup(groupId);
            
            if (!result) {
                console.log('Promotion group not found');
                return res.status(404).json({ error: 'Promotion group not found' });
            }

            console.log('Promotion group deleted successfully');
            res.json({ message: 'Promotion group deleted successfully' });
        } catch (error) {
            console.error('Error deleting promotion group:', error);
            if (error.message === 'Promotion group not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    return router;
};
