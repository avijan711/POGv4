const express = require('express');
const imageUpload = require('../middleware/imageUpload');
const itemFileUpload = require('../middleware/itemFileUpload');
const debug = require('../utils/debug');
const Item = require('../models/item');
const SupplierPricesService = require('../services/supplierPricesService');
const { DatabaseAccessLayer } = require('../config/database');
const path = require('path');
const fs = require('fs');

function createItemsRouter({ db }) {
    const router = express.Router();
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    const itemModel = new Item(dal);
    const supplierPricesService = new SupplierPricesService(dal);

    // Get supplier prices for item
    router.get('/:id/supplier-prices', async (req, res) => {
        try {
            const { limit, offset, fromDate, supplierId } = req.query;
            debug.log('Fetching supplier prices for item:', req.params.id, {
                limit,
                offset,
                fromDate,
                supplierId
            });

            const result = await supplierPricesService.getSupplierPrices(
                req.params.id,
                {
                    limit: parseInt(limit) || 10,
                    offset: parseInt(offset) || 0,
                    fromDate: fromDate || null,
                    supplierId: supplierId ? parseInt(supplierId) : null
                }
            );

            res.json(result);
        } catch (err) {
            debug.error('Error fetching supplier prices:', err);
            res.status(500).json({
                error: 'Failed to fetch supplier prices',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get suppliers for item
    router.get('/:id/suppliers', async (req, res) => {
        try {
            debug.log('Fetching suppliers for item:', req.params.id);
            const suppliers = await supplierPricesService.getSuppliers();
            res.json(suppliers);
        } catch (err) {
            debug.error('Error fetching suppliers:', err);
            res.status(500).json({
                error: 'Failed to fetch suppliers',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get all items
    router.get('/', async (req, res) => {
        try {
            const items = await itemModel.getAllItems();
            res.json(items);
        } catch (err) {
            console.error('Error fetching items:', err);
            res.status(500).json({ 
                error: 'Failed to fetch items',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get item price history
    router.get('/:id/price-history', async (req, res) => {
        try {
            debug.log('Fetching price history for item:', req.params.id);
            const history = await itemModel.getPriceHistory(req.params.id);
            res.json(history);
        } catch (err) {
            debug.error('Error fetching price history:', err);
            res.status(500).json({
                error: 'Failed to fetch price history',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get item files
    router.get('/:id/files', async (req, res) => {
        try {
            debug.log('Fetching files for item:', req.params.id);
            const files = await itemModel.getItemFiles(req.params.id);
            res.json(files);
        } catch (err) {
            debug.error('Error fetching item files:', err);
            res.status(500).json({
                error: 'Failed to fetch item files',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Download item file
    router.get('/:id/files/:fileId/download', async (req, res) => {
        try {
            const files = await itemModel.getItemFiles(req.params.id);
            const file = files.find(f => f.id === parseInt(req.params.fileId));
            
            if (!file) {
                return res.status(404).json({
                    error: 'File not found',
                    details: 'The requested file does not exist',
                    suggestion: 'Please verify the file ID and try again'
                });
            }

            const filePath = path.join(__dirname, '..', 'uploads', 'item-files', file.file_path);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'File not found',
                    details: 'The file is missing from the server',
                    suggestion: 'Please contact support'
                });
            }

            res.download(filePath, file.description || file.file_path);
        } catch (err) {
            debug.error('Error downloading file:', err);
            res.status(500).json({
                error: 'Failed to download file',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Upload files for item
    router.post('/:id/files', itemFileUpload.handleUpload, async (req, res) => {
        try {
            debug.log('Uploading files for item:', req.params.id);
            
            if (!req.uploadedFiles?.length) {
                return res.status(400).json({
                    error: 'No files uploaded',
                    details: 'No files were received',
                    suggestion: 'Please select files to upload'
                });
            }

            await itemModel.addItemFiles(req.params.id, req.uploadedFiles);
            
            const files = await itemModel.getItemFiles(req.params.id);
            res.json({
                message: 'Files uploaded successfully',
                files: files
            });
        } catch (err) {
            debug.error('Error uploading files:', err);
            // Clean up any uploaded files
            itemFileUpload.cleanupFiles(req.uploadedFiles);
            res.status(500).json({
                error: 'Failed to upload files',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Delete item file
    router.delete('/:id/files/:fileId', async (req, res) => {
        try {
            const files = await itemModel.getItemFiles(req.params.id);
            const file = files.find(f => f.id === parseInt(req.params.fileId));
            
            if (!file) {
                return res.status(404).json({
                    error: 'File not found',
                    details: 'The requested file does not exist',
                    suggestion: 'Please verify the file ID and try again'
                });
            }

            const filePath = path.join(__dirname, '..', 'uploads', 'item-files', file.file_path);
            
            // Delete from database first
            await itemModel.deleteItemFile(req.params.id, req.params.fileId);
            
            // Then try to delete the file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            res.json({
                message: 'File deleted successfully'
            });
        } catch (err) {
            debug.error('Error deleting file:', err);
            res.status(500).json({
                error: 'Failed to delete file',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get item reference changes
    router.get('/:id/reference-changes', async (req, res) => {
        try {
            debug.log('Fetching reference changes for item:', req.params.id);
            const changes = await itemModel.getReferenceChanges(req.params.id);
            res.json(changes);
        } catch (err) {
            debug.error('Error fetching reference changes:', err);
            res.status(500).json({
                error: 'Failed to fetch reference changes',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get item by ID
    router.get('/:id', async (req, res) => {
        try {
            debug.log('Fetching item details for ID:', req.params.id);
            const result = await itemModel.getItemById(req.params.id);
            
            if (!result) {
                debug.error('Item not found:', req.params.id);
                return res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            }

            debug.log('Item details fetched successfully:', result);
            res.json(result);
        } catch (err) {
            debug.error('Error fetching item details:', err);
            if (err.message === 'Item not found') {
                res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            } else {
                res.status(500).json({ 
                    error: 'Failed to fetch item details',
                    details: err.message,
                    suggestion: 'Please try again or contact support if the issue persists'
                });
            }
        }
    });

    // Create new item
    router.post('/', imageUpload.single('image'), async (req, res) => {
        try {
            // Validate retail price
            if (req.body.retailPrice !== undefined && req.body.retailPrice !== '') {
                const retailPrice = parseFloat(req.body.retailPrice);
                if (isNaN(retailPrice) || retailPrice <= 0) {
                    return res.status(400).json({
                        error: 'Invalid retail price',
                        details: 'Retail price must be a positive number',
                        suggestion: 'Please provide a valid retail price greater than 0'
                    });
                }
            }

            const itemData = {
                itemID: req.body.itemID?.toString().trim().replace(/\./g, ''),
                hebrewDescription: req.body.hebrewDescription,
                englishDescription: req.body.englishDescription || '',
                importMarkup: parseFloat(req.body.importMarkup) || 1.30,
                hsCode: req.body.hsCode || '',
                image: req.file ? req.file.filename : '',
                qtyInStock: parseInt(req.body.qtyInStock) || 0,
                soldThisYear: parseInt(req.body.soldThisYear) || 0,
                soldLastYear: parseInt(req.body.soldLastYear) || 0,
                retailPrice: req.body.retailPrice !== undefined && req.body.retailPrice !== '' ? 
                    parseFloat(req.body.retailPrice) : null,
                notes: req.body.notes || null
            };

            const newItem = await itemModel.createItem(itemData);
            res.status(201).json({ 
                message: 'Item created successfully',
                item: newItem
            });
        } catch (err) {
            console.error('Error creating item:', err);
            res.status(500).json({ 
                error: 'Failed to create item',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Update item
    router.put('/:id', imageUpload.single('image'), async (req, res) => {
        try {
            // Get current item data first
            const currentItem = await itemModel.getItemById(req.params.id);
            if (!currentItem) {
                return res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            }

            // Validate retail price if provided
            let retailPrice = null;
            if (req.body.retailPrice !== undefined && req.body.retailPrice !== '') {
                retailPrice = parseFloat(req.body.retailPrice);
                if (isNaN(retailPrice) || retailPrice <= 0) {
                    return res.status(400).json({
                        error: 'Invalid retail price',
                        details: 'Retail price must be a positive number',
                        suggestion: 'Please provide a valid retail price greater than 0'
                    });
                }
            }

            // Only update fields that are actually provided
            const updateData = {
                hebrewDescription: req.body.hebrewDescription || currentItem.hebrewDescription,
                englishDescription: req.body.englishDescription !== undefined ? req.body.englishDescription : currentItem.englishDescription,
                importMarkup: req.body.importMarkup !== undefined && req.body.importMarkup !== '' ? 
                    parseFloat(req.body.importMarkup) : currentItem.importMarkup,
                hsCode: req.body.hsCode !== undefined ? req.body.hsCode : currentItem.hsCode,
                qtyInStock: req.body.qtyInStock !== undefined && req.body.qtyInStock !== '' ? 
                    parseInt(req.body.qtyInStock) : currentItem.qtyInStock,
                soldThisYear: req.body.soldThisYear !== undefined && req.body.soldThisYear !== '' ? 
                    parseInt(req.body.soldThisYear) : currentItem.soldThisYear,
                soldLastYear: req.body.soldLastYear !== undefined && req.body.soldLastYear !== '' ? 
                    parseInt(req.body.soldLastYear) : currentItem.soldLastYear,
                retailPrice: retailPrice !== null ? retailPrice : currentItem.retailPrice,
                notes: req.body.notes !== undefined ? req.body.notes : currentItem.notes
            };

            // Only include image if a new one was uploaded
            if (req.file) {
                updateData.image = req.file.filename;
            }

            debug.log('Updating item with data:', {
                itemId: req.params.id,
                updateData
            });

            await itemModel.updateItem(req.params.id, updateData);
            const updatedItem = await itemModel.getItemById(req.params.id);
            
            res.json({ 
                message: 'Item updated successfully',
                item: updatedItem
            });
        } catch (err) {
            console.error('Error updating item:', err);
            if (err.message === 'Item not found') {
                res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            } else {
                res.status(500).json({ 
                    error: 'Failed to update item',
                    details: err.message,
                    suggestion: 'Please try again or contact support if the issue persists'
                });
            }
        }
    });

    // Update item notes
    router.patch('/:id', async (req, res) => {
        try {
            debug.log('Updating notes for item:', req.params.id);
            
            const { notes } = req.body;
            if (notes === undefined) {
                return res.status(400).json({
                    error: 'Missing notes',
                    details: 'Notes field is required',
                    suggestion: 'Please provide notes in the request body'
                });
            }

            const updatedItem = await itemModel.updateNotes(req.params.id, notes);
            if (!updatedItem) {
                return res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            }

            res.json({ 
                message: 'Notes updated successfully',
                item: updatedItem
            });
        } catch (err) {
            console.error('Error updating notes:', err);
            res.status(500).json({ 
                error: 'Failed to update notes',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Delete item
    router.delete('/:id', async (req, res) => {
        try {
            await itemModel.deleteItem(req.params.id);
            res.json({ message: 'Item deleted successfully' });
        } catch (err) {
            console.error('Error deleting item:', err);
            res.status(500).json({ 
                error: 'Failed to delete item',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Add reference change
    router.post('/:id/reference', async (req, res) => {
        try {
            const { newReferenceId, supplierId, notes } = req.body;
            const originalItemId = req.params.id;

            if (!newReferenceId) {
                return res.status(400).json({
                    error: 'Missing reference ID',
                    details: 'New reference ID is required',
                    suggestion: 'Please provide a new reference ID'
                });
            }

            // Clean the new reference ID by removing dots
            const cleanedNewReferenceId = newReferenceId.toString().trim().replace(/\./g, '');

            // Prevent self-references
            if (cleanedNewReferenceId === originalItemId) {
                return res.status(400).json({
                    error: 'Invalid reference',
                    details: 'An item cannot reference itself',
                    suggestion: 'Please provide a different reference ID'
                });
            }

            await itemModel.addReferenceChange(originalItemId, cleanedNewReferenceId, supplierId, notes);
            
            // Get the updated item with reference information
            const updatedItem = await itemModel.getItemById(originalItemId);
            
            if (!updatedItem) {
                return res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${originalItemId}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            }

            res.json({ 
                message: 'Reference change added successfully',
                item: updatedItem
            });
        } catch (err) {
            console.error('Error adding reference change:', err);
            res.status(500).json({ 
                error: 'Failed to add reference change',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    return router;
}

module.exports = createItemsRouter;
