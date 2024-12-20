const express = require('express');
const imageUpload = require('../middleware/imageUpload');
const itemFileUpload = require('../middleware/itemFileUpload');
const debug = require('../utils/debug');
const Item = require('../models/item');
const SupplierPricesService = require('../services/supplierPricesService');
const PromotionService = require('../services/promotionService');
const { DatabaseAccessLayer } = require('../config/database');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { cleanItemId } = require('../utils/itemIdCleaner');
const itemUtils = require('../utils/itemUtils');

function createItemsRouter({ db }) {
    const router = express.Router();
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    const itemModel = new Item(dal);
    const supplierPricesService = new SupplierPricesService(dal);
    const promotionService = new PromotionService(dal);

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

    // Export inventory to Excel - IMPORTANT: This route must be before any routes with parameters
    router.get('/export', async (req, res) => {
        try {
            debug.log('Exporting inventory with headers:', req.query.headers);
            
            // Get selected headers from query params
            const selectedHeaders = req.query.headers ? req.query.headers.split(',') : [];
            if (selectedHeaders.length === 0) {
                return res.status(400).json({
                    error: 'No headers selected',
                    details: 'At least one header must be selected for export',
                    suggestion: 'Please select headers to include in the export'
                });
            }

            // Get all items
            const items = await itemModel.getAllItems();

            // Map headers to display labels
            const headerLabels = {
                item_id: 'Item ID',
                hebrew_description: 'Hebrew Description',
                english_description: 'English Description',
                import_markup: 'Import Markup',
                hs_code: 'HS Code',
                origin: 'Origin',
                reference_notes: 'Reference Notes',
                retail_price: 'Retail Price (ILS)',
                stock: 'Stock',
                sold_this_year: 'Sold This Year',
                sold_last_year: 'Sold Last Year',
                reference: 'Reference'
            };

            // Create worksheet data with only selected columns
            const wsData = [
                // Header row with display labels
                selectedHeaders.map(header => headerLabels[header] || header)
            ];

            // Add item data rows
            items.forEach(item => {
                const row = selectedHeaders.map(header => {
                    // Map item properties to their corresponding headers
                    switch (header) {
                        case 'item_id':
                            return item.item_id;
                        case 'hebrew_description':
                            return item.hebrew_description;
                        case 'english_description':
                            return item.english_description;
                        case 'import_markup':
                            return item.import_markup;
                        case 'hs_code':
                            return item.hs_code;
                        case 'origin':
                            return item.origin;
                        case 'reference_notes':
                            return item.notes;
                        case 'retail_price':
                            return item.retail_price;
                        case 'stock':
                            return item.qty_in_stock;
                        case 'sold_this_year':
                            return item.sold_this_year;
                        case 'sold_last_year':
                            return item.sold_last_year;
                        case 'reference':
                            return item.reference_id;
                        default:
                            return '';
                    }
                });
                wsData.push(row);
            });

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

            // Generate Excel file
            const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            // Set response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=inventory.xlsx');
            
            // Send file
            res.send(excelBuffer);

        } catch (err) {
            debug.error('Error exporting inventory:', err);
            res.status(500).json({
                error: 'Failed to export inventory',
                details: err.message,
                suggestion: 'Please try again or contact support if the issue persists'
            });
        }
    });

    // Create new item
    router.post('/', imageUpload.handleUpload, async (req, res) => {
        try {
            debug.log('Creating new item with raw data:', {
                item_id: req.body.item_id,
                hebrew_description: req.body.hebrew_description,
                reference_id: req.body.reference_id
            });

            // Validate retail price
            if (req.body.retail_price !== undefined && req.body.retail_price !== '') {
                const retailPrice = parseFloat(req.body.retail_price);
                if (isNaN(retailPrice) || retailPrice <= 0) {
                    return res.status(400).json({
                        error: 'Invalid retail price',
                        details: 'Retail price must be a positive number',
                        suggestion: 'Please provide a valid retail price greater than 0'
                    });
                }
            }

            // Clean and validate item ID
            let cleanedId;
            try {
                cleanedId = cleanItemId(req.body.item_id);
                debug.log('Cleaned item ID:', cleanedId);
            } catch (error) {
                debug.error('Item ID cleaning error:', error);
                return res.status(400).json({
                    error: 'Invalid item ID',
                    details: error.message,
                    suggestion: 'Please provide a valid item ID'
                });
            }

            // Format item data using utility function
            const itemData = {
                item_id: cleanedId,
                hebrew_description: req.body.hebrew_description,
                english_description: req.body.english_description,
                import_markup: req.body.import_markup,
                hs_code: req.body.hs_code,
                qty_in_stock: req.body.qty_in_stock,
                sold_this_year: req.body.sold_this_year,
                sold_last_year: req.body.sold_last_year,
                retail_price: req.body.retail_price,
                reference_id: req.body.reference_id,
                image: req.files?.image?.[0]?.filename || ''
            };

            debug.log('Formatted item data:', itemData);

            const newItem = await itemModel.createItem(itemData);

            // After creating the item, sync any pending promotion prices
            try {
                debug.log('Syncing promotion prices for new item');
                await promotionService.syncUnmatchedItems();
            } catch (syncError) {
                debug.error('Error syncing promotion prices:', syncError);
                // Don't fail the request, just log the error
            }

            // If reference_id is provided, create the reference relationship
            if (req.body.reference_id) {
                try {
                    const cleanedRefId = cleanItemId(req.body.reference_id);
                    debug.log('Cleaned reference ID:', cleanedRefId);
                    
                    // Prevent self-references
                    if (cleanedRefId === cleanedId) {
                        return res.status(400).json({
                            error: 'Invalid reference',
                            details: 'An item cannot reference itself',
                            suggestion: 'Please provide a different reference ID'
                        });
                    }

                    // Add the reference change
                    await itemModel.addReferenceChange(
                        cleanedId,  // original item (the new item)
                        cleanedRefId,     // referenced item
                        null,             // no supplier ID (user-initiated)
                        'Initial reference set during item creation'
                    );

                    // Get the updated item with reference information
                    const updatedItem = await itemModel.getItemById(cleanedId);
                    debug.log('Item created successfully with reference:', updatedItem);
                    return res.status(201).json({ 
                        message: 'Item created successfully with reference',
                        item: updatedItem
                    });
                } catch (error) {
                    debug.error('Error adding reference:', error);
                    // If reference creation fails, still return success for item creation
                    return res.status(201).json({ 
                        message: 'Item created successfully but reference creation failed',
                        item: newItem,
                        warning: 'Failed to create reference: ' + error.message
                    });
                }
            }

            debug.log('Item created successfully:', newItem);
            res.status(201).json({ 
                message: 'Item created successfully',
                item: newItem
            });
        } catch (err) {
            debug.error('Error creating item:', err);
            if (err.code === 'DUPLICATE_ITEM') {
                res.status(400).json({ 
                    error: 'Item already exists',
                    details: err.message,
                    suggestion: 'Please use a different item ID'
                });
            } else if (err.code === 'INVALID_ITEM_ID') {
                res.status(400).json({ 
                    error: 'Invalid item ID',
                    details: err.message,
                    suggestion: 'Please provide a valid item ID'
                });
            } else {
                res.status(500).json({ 
                    error: 'Failed to create item',
                    details: err.message,
                    suggestion: 'Please try again or contact support if the issue persists'
                });
            }
        }
    });

    // Get item by ID - IMPORTANT: This route must be after /export to prevent conflicts
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

    // Update item
    router.put('/:id', imageUpload.handleUpload, async (req, res) => {
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
            let retail_price = null;
            if (req.body.retail_price !== undefined && req.body.retail_price !== '') {
                retail_price = parseFloat(req.body.retail_price);
                if (isNaN(retail_price) || retail_price <= 0) {
                    return res.status(400).json({
                        error: 'Invalid retail price',
                        details: 'Retail price must be a positive number',
                        suggestion: 'Please provide a valid retail price greater than 0'
                    });
                }
            }

            // Only update fields that are actually provided
            const updateData = {
                hebrew_description: req.body.hebrew_description || currentItem.hebrew_description,
                english_description: req.body.english_description !== undefined ? 
                    req.body.english_description : currentItem.english_description,
                import_markup: req.body.import_markup !== undefined && req.body.import_markup !== '' ? 
                    parseFloat(req.body.import_markup) : currentItem.import_markup,
                hs_code: req.body.hs_code !== undefined ? 
                    req.body.hs_code : currentItem.hs_code,
                qty_in_stock: req.body.qty_in_stock !== undefined && req.body.qty_in_stock !== '' ? 
                    parseInt(req.body.qty_in_stock) : currentItem.qty_in_stock,
                sold_this_year: req.body.sold_this_year !== undefined && req.body.sold_this_year !== '' ? 
                    parseInt(req.body.sold_this_year) : currentItem.sold_this_year,
                sold_last_year: req.body.sold_last_year !== undefined && req.body.sold_last_year !== '' ? 
                    parseInt(req.body.sold_last_year) : currentItem.sold_last_year,
                retail_price: retail_price !== null ? retail_price : currentItem.retail_price,
                notes: req.body.notes !== undefined ? req.body.notes : currentItem.notes
            };

            // Only include image if a new one was uploaded
            if (req.files?.image?.[0]) {
                updateData.image = req.files.image[0].filename;
            }

            debug.log('Updating item with data:', {
                item_id: req.params.id,
                updateData
            });

            await itemModel.updateItem(req.params.id, updateData);
            const updatedItem = await itemModel.getItemById(req.params.id);
            
            res.json({ 
                message: 'Item updated successfully',
                item: updatedItem
            });
        } catch (err) {
            debug.error('Error updating item:', err);
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
            debug.error('Error updating notes:', err);
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
            debug.error('Error deleting item:', err);
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
            debug.error('Error adding reference change:', err);
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
