const express = require('express');
const multer = require('multer');
const ExcelProcessor = require('../utils/excelProcessor/index');
const { getExcelColumns } = require('../utils/excelProcessor/columnReader');
const { processInquiryData, processExportData } = require('../utils/excelProcessor/dataProcessor');
const InquiryModel = require('../models/inquiry');
const InquiryItemModel = require('../models/inquiry/item');
const Promotion = require('../models/promotion');
const debug = require('../utils/debug');
const { handleUpload, cleanupFile } = require('../middleware/upload');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { DatabaseAccessLayer } = require('../config/database');

function createRouter({ db }) {
  const router = express.Router();
  const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
  const inquiryModel = new InquiryModel(dal);
  const inquiryItemModel = new InquiryItemModel(dal);

  // Get all inquiries
  router.get('/', async (req, res) => {
    try {
      const inquiries = await inquiryModel.getAllInquiries();
      res.json(inquiries);
    } catch (err) {
      debug.error('Error fetching inquiries:', err);
      res.status(500).json({
        error: 'Failed to fetch inquiries',
        details: err.message,
      });
    }
  });

  // Get single inquiry with its items
  router.get('/:inquiryId', async (req, res) => {
    try {
      const { inquiryId } = req.params;
      const inquiry = await inquiryModel.getInquiryById(inquiryId);
            
      if (!inquiry) {
        return res.status(404).json({
          error: 'Inquiry not found',
          details: `No inquiry found with ID ${inquiryId}`,
        });
      }

      res.json(inquiry);
    } catch (err) {
      debug.error('Error fetching inquiry:', err);
      res.status(500).json({
        error: 'Failed to fetch inquiry',
        details: err.message,
      });
    }
  });

  // Export inquiry to Excel
  router.get('/:inquiryId/export', async (req, res) => {
    try {
      const { inquiryId } = req.params;
      const headersParam = req.query.headers;
            
      if (!headersParam) {
        return res.status(400).json({
          error: 'Missing headers parameter',
          details: 'Headers parameter is required for export',
        });
      }

      let headers;
      try {
        headers = JSON.parse(decodeURIComponent(headersParam));
      } catch (err) {
        return res.status(400).json({
          error: 'Invalid headers format',
          details: 'Headers must be a valid JSON array',
        });
      }

      // Get inquiry items
      const items = await inquiryModel.getInquiryItems(inquiryId);
            
      if (!items || items.length === 0) {
        return res.status(404).json({
          error: 'No items found',
          details: 'No items found for this inquiry',
        });
      }

      // Map header display names
      const headerDisplayMap = {
        'item_id': 'Item ID',
        'hebrew_description': 'Hebrew Description',
        'english_description': 'English Description',
        'requested_qty': 'Requested Quantity',
        'import_markup': 'Import Markup',
        'hs_code': 'HS Code',
        'origin': 'Origin',
        'retail_price': 'Retail Price (ILS)',
        'qty_in_stock': 'Current Stock',
        'sold_this_year': 'Sold This Year',
        'sold_last_year': 'Sold Last Year',
        'notes': 'Notes',
      };

      // Process data for export
      const { buffer } = await processExportData(items, headers, headerDisplayMap);

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=inquiry_${inquiryId}_export.xlsx`);
            
      // Send the Excel file
      res.send(buffer);

    } catch (err) {
      debug.error('Error exporting inquiry:', err);
      res.status(500).json({
        error: 'Failed to export inquiry',
        details: err.message,
      });
    }
  });

  // Add new item to inquiry
  router.post('/:inquiryId/items', async (req, res) => {
    try {
      const { inquiryId } = req.params;
      const { item_id, hebrew_description, english_description, requested_qty, notes } = req.body;

      if (!item_id || !requested_qty) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Item ID and quantity are required',
          suggestion: 'Please provide both item ID and quantity',
        });
      }

      await inquiryItemModel.createInquiryItem(inquiryId, {
        item_id,
        hebrew_description: hebrew_description || `Item ${item_id}`,
        english_description: english_description || '',
        requested_qty: parseInt(requested_qty, 10),
        notes: notes || '',
      });

      const updatedInquiry = await inquiryModel.getInquiryById(inquiryId);
      res.status(201).json(updatedInquiry);
    } catch (err) {
      debug.error('Error adding item:', err);
      res.status(500).json({
        error: 'Failed to add item',
        details: err.message,
        suggestion: 'Please try again or contact support if the issue persists',
      });
    }
  });

  // Update inquiry item quantity
  router.put('/inquiry-items/:inquiryItemId/quantity', async (req, res) => {
    try {
      const { inquiryItemId } = req.params;
      const { requested_qty } = req.body;

      if (requested_qty === undefined) {
        return res.status(400).json({
          error: 'Missing required field',
          details: 'Quantity is required',
          suggestion: 'Please provide a quantity value',
        });
      }

      await inquiryItemModel.updateQuantity(inquiryItemId, requested_qty);
      res.status(200).json({ message: 'Quantity updated successfully' });
    } catch (err) {
      debug.error('Error updating quantity:', err);
      if (err.message.includes('not found')) {
        res.status(404).json({
          error: 'Item not found',
          details: err.message,
        });
      } else {
        res.status(500).json({
          error: 'Failed to update quantity',
          details: err.message,
        });
      }
    }
  });

  // Delete inquiry item
  router.delete('/inquiry-items/:inquiryItemId', async (req, res) => {
    try {
      const { inquiryItemId } = req.params;
      await inquiryItemModel.deleteItem(inquiryItemId);
      res.status(204).send();
    } catch (err) {
      debug.error('Error deleting inquiry item:', err);
      if (err.message.includes('not found')) {
        res.status(404).json({
          error: 'Item not found',
          details: err.message,
        });
      } else {
        res.status(500).json({
          error: 'Failed to delete item',
          details: err.message,
        });
      }
    }
  });

  // Get Excel columns for mapping
  router.post('/columns', handleUpload, async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          details: 'Please select a file to upload',
          suggestion: 'Make sure you have selected an Excel file',
        });
      }

      debug.log('Reading columns from file:', req.file.path);
      const columns = await getExcelColumns(req.file.path);
            
      // Clean up the file after reading columns
      cleanupFile(req.file.path);
            
      res.json({ columns });
    } catch (err) {
      debug.error('Error reading columns:', err);
      cleanupFile(req.file?.path);
      next(err);
    }
  });

  // Upload Excel file for inquiry
  router.post('/upload', handleUpload, async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          details: 'Please select a file to upload',
          suggestion: 'Make sure you have selected an Excel file',
        });
      }

      const { inquiryNumber, columnMapping } = req.body;
            
      if (!inquiryNumber) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Missing inquiry number',
          details: 'An inquiry number is required',
          suggestion: 'Please provide an inquiry number',
        });
      }

      if (!columnMapping) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Missing column mapping',
          details: 'Column mapping is required',
          suggestion: 'Please map the Excel columns first',
        });
      }

      let mapping;
      try {
        mapping = JSON.parse(columnMapping);
      } catch (err) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Invalid column mapping',
          details: 'Column mapping must be valid JSON',
          suggestion: 'Please try mapping the columns again',
        });
      }

      // Process the Excel file using the mapping
      const items = await processInquiryData(req.file.path, mapping, dal);
            
      // Create a new inquiry with the processed items
      const inquiry = await inquiryModel.createInquiry({
        inquiryNumber,
        items,
      });

      // Clean up the uploaded file
      cleanupFile(req.file.path);

      res.status(201).json({
        message: 'File processed successfully',
        inquiryId: inquiry.id,
        itemCount: items.length,
      });

    } catch (err) {
      debug.error('Error processing upload:', err);
      cleanupFile(req.file?.path);
      next(err);
    }
  });

  // Create new inquiry
  router.post('/', async (req, res) => {
    try {
      const inquiry = await inquiryModel.createInquiry(req.body);
      res.status(201).json(inquiry);
    } catch (err) {
      debug.error('Error creating inquiry:', err);
      res.status(500).json({
        error: 'Failed to create inquiry',
        details: err.message,
      });
    }
  });

  // Update inquiry
  router.put('/:inquiryId', async (req, res) => {
    try {
      const { inquiryId } = req.params;
      const inquiry = await inquiryModel.updateInquiry(inquiryId, req.body);
      res.json(inquiry);
    } catch (err) {
      debug.error('Error updating inquiry:', err);
      res.status(500).json({
        error: 'Failed to update inquiry',
        details: err.message,
      });
    }
  });

  // Delete inquiry
  router.delete('/:inquiryId', async (req, res) => {
    try {
      const { inquiryId } = req.params;
      await inquiryModel.deleteInquiry(inquiryId);
      res.status(204).send();
    } catch (err) {
      debug.error('Error deleting inquiry:', err);
      res.status(500).json({
        error: 'Failed to delete inquiry',
        details: err.message,
      });
    }
  });

  return router;
}

module.exports = createRouter;
