const express = require('express');
const router = express.Router();
const imageUpload = require('../middleware/imageUpload');

module.exports = (itemModel) => {
    // Get all items
    router.get('/', async (req, res) => {
        try {
            const items = await itemModel.getAllItems();
            // Format items to match the table structure, preserving reference data
            const formattedItems = items.map(item => ({
                itemID: item.itemID || '',
                hebrewDescription: item.hebrewDescription || '',
                englishDescription: item.englishDescription || '',
                importMarkup: parseFloat(item.importMarkup).toFixed(2) || '1.30',
                hsCode: item.hsCode || '',
                image: item.image || '',
                qtyInStock: parseInt(item.qtyInStock) || 0,
                soldThisYear: parseInt(item.soldThisYear) || 0,
                soldLastYear: parseInt(item.soldLastYear) || 0,
                retailPrice: item.retailPrice !== null && item.retailPrice !== undefined ? 
                    parseFloat(item.retailPrice) : null,
                // Preserve reference change data
                referenceChange: item.referenceChange,
                referencedBy: item.referencedBy
            }));
            res.json(formattedItems);
        } catch (err) {
            console.error('Error fetching items:', err);
            res.status(500).json({ 
                error: 'Failed to fetch items',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Get item by ID
    router.get('/:id', async (req, res) => {
        try {
            console.log('Fetching item details for ID:', req.params.id);
            const result = await itemModel.getItemById(req.params.id);
            
            console.log('Raw result from database:', JSON.stringify(result, null, 2));
            
            if (!result) {
                return res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            }

            // Format the response with the expected structure
            const formattedResult = {
                item: {
                    itemID: result.itemID || '',
                    hebrewDescription: result.hebrewDescription || '',
                    englishDescription: result.englishDescription || '',
                    importMarkup: parseFloat(result.importMarkup).toFixed(2) || '1.30',
                    hsCode: result.hsCode || '',
                    image: result.image || '',
                    qtyInStock: parseInt(result.qtyInStock) || 0,
                    soldThisYear: parseInt(result.soldThisYear) || 0,
                    soldLastYear: parseInt(result.soldLastYear) || 0,
                    retailPrice: result.retailPrice !== null && result.retailPrice !== undefined ? 
                        parseFloat(result.retailPrice) : null,
                    // Preserve reference change data
                    referenceChange: result.referenceChange,
                    referencedBy: result.referencedBy,
                    lastUpdated: result.lastUpdated
                },
                // Include the arrays from the query
                priceHistory: result.priceHistory,
                supplierPrices: result.supplierPrices,
                promotions: result.promotions
            };

            console.log('Formatted result:', JSON.stringify(formattedResult, null, 2));
            console.log('Response data types:', {
                referenceChange: typeof formattedResult.item.referenceChange,
                referencedBy: typeof formattedResult.item.referencedBy,
                priceHistory: typeof formattedResult.priceHistory,
                supplierPrices: typeof formattedResult.supplierPrices,
                promotions: typeof formattedResult.promotions
            });

            res.json(formattedResult);
        } catch (err) {
            console.error('Error fetching item details:', err);
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
            // Validate retail price if provided
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

            const updateData = {
                hebrewDescription: req.body.hebrewDescription,
                englishDescription: req.body.englishDescription,
                importMarkup: parseFloat(req.body.importMarkup),
                hsCode: req.body.hsCode,
                qtyInStock: parseInt(req.body.qtyInStock),
                soldThisYear: parseInt(req.body.soldThisYear),
                soldLastYear: parseInt(req.body.soldLastYear),
                retailPrice: req.body.retailPrice !== undefined && req.body.retailPrice !== '' ? 
                    parseFloat(req.body.retailPrice) : null
            };

            // Only include image if a new one was uploaded
            if (req.file) {
                updateData.image = req.file.filename;
            }

            await itemModel.updateItem(req.params.id, updateData);
            const updatedItem = await itemModel.getItemById(req.params.id);
            
            if (!updatedItem) {
                return res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            }

            // Format the response
            const formattedItem = {
                itemID: updatedItem.itemID,
                hebrewDescription: updatedItem.hebrewDescription,
                englishDescription: updatedItem.englishDescription || '',
                importMarkup: parseFloat(updatedItem.importMarkup).toFixed(2),
                hsCode: updatedItem.hsCode || '',
                image: updatedItem.image || '',
                qtyInStock: parseInt(updatedItem.qtyInStock) || 0,
                soldThisYear: parseInt(updatedItem.soldThisYear) || 0,
                soldLastYear: parseInt(updatedItem.soldLastYear) || 0,
                retailPrice: updatedItem.retailPrice !== null && updatedItem.retailPrice !== undefined ? 
                    parseFloat(updatedItem.retailPrice) : null,
                // Preserve reference change data
                referenceChange: updatedItem.referenceChange,
                referencedBy: updatedItem.referencedBy
            };

            res.json({ 
                message: 'Item updated successfully',
                item: formattedItem
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
        const { newReferenceId, supplierId, notes } = req.body;

        if (!newReferenceId) {
            return res.status(400).json({
                error: 'Missing reference ID',
                details: 'New reference ID is required',
                suggestion: 'Please provide a new reference ID'
            });
        }

        try {
            // Clean the new reference ID by removing dots
            const cleanedNewReferenceId = newReferenceId.toString().trim().replace(/\./g, '');
            await itemModel.addReferenceChange(req.params.id, cleanedNewReferenceId, supplierId, notes);
            const updatedItem = await itemModel.getItemById(req.params.id);
            
            if (!updatedItem) {
                return res.status(404).json({ 
                    error: 'Item not found',
                    details: `No item exists with ID: ${req.params.id}`,
                    suggestion: 'Please verify the item ID and try again'
                });
            }

            // Format the response
            const formattedItem = {
                itemID: updatedItem.itemID,
                hebrewDescription: updatedItem.hebrewDescription,
                englishDescription: updatedItem.englishDescription || '',
                importMarkup: parseFloat(updatedItem.importMarkup).toFixed(2),
                hsCode: updatedItem.hsCode || '',
                image: updatedItem.image || '',
                qtyInStock: parseInt(updatedItem.qtyInStock) || 0,
                soldThisYear: parseInt(updatedItem.soldThisYear) || 0,
                soldLastYear: parseInt(updatedItem.soldLastYear) || 0,
                retailPrice: updatedItem.retailPrice !== null && updatedItem.retailPrice !== undefined ? 
                    parseFloat(updatedItem.retailPrice) : null,
                // Preserve reference change data
                referenceChange: updatedItem.referenceChange,
                referencedBy: updatedItem.referencedBy
            };

            res.json({ 
                message: 'Reference change added successfully',
                item: formattedItem
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
};
