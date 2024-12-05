const express = require('express');
const imageUpload = require('../middleware/imageUpload');
const debug = require('../utils/debug');
const Item = require('../models/item');

function createItemsRouter({ db }) {
    const router = express.Router();
    const itemModel = new Item(db);

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

    // Get item supplier prices
    router.get('/:id/supplier-prices', async (req, res) => {
        try {
            debug.log('Fetching supplier prices for item:', req.params.id);
            const prices = await itemModel.getSupplierPrices(req.params.id);
            res.json(prices);
        } catch (err) {
            debug.error('Error fetching supplier prices:', err);
            res.status(500).json({
                error: 'Failed to fetch supplier prices',
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
                    parseFloat(req.body.retailPrice) : null
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
                retailPrice: retailPrice !== null ? retailPrice : currentItem.retailPrice
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
