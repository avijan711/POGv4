const express = require('express');
const multer = require('multer');
const debug = require('../utils/debug');
const SupplierResponseService = require('../services/supplierResponseService');
const {
  validateInquiryId,
  validateResponseId,
  validateChangeId,
  validateBulkDelete,
  validateUpload,
  handleErrors,
} = require('../middleware/supplierResponseMiddleware');
const { uploadConfig, handleUploadError, cleanupFile } = require('../middleware/upload');
const ExcelProcessor = require('../utils/excelProcessor/index');
const fs = require('fs');
const path = require('path');

function createRouter({ db }) {
  if (!db) {
    throw new Error('Database instance is required');
  }

  const router = express.Router();
  const supplierResponseService = new SupplierResponseService(db);
  const upload = multer(uploadConfig);

  // Export missing items to Excel
  router.post('/export-missing-items', express.json(), async (req, res) => {
    try {
      const { items, supplierName } = req.body;
            
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Invalid or empty items array');
      }

      debug.log('Exporting missing items:', {
        itemCount: items.length,
        supplierName,
        sampleItem: items[0],
      });

      // Prepare data for Excel
      const excelData = items.map(item => ({
        'Item ID': item.item_id,
        'Description': item.hebrew_description,
        'English Description': item.english_description || '',
        'Requested Qty': item.requested_qty || 0,
        'Retail Price': item.retail_price || 0,
        'Origin': item.origin || '',
      }));

      // Create workbook and worksheet
      const workbook = ExcelProcessor.createWorkbook();
      const worksheet = ExcelProcessor.createWorksheet(excelData);

      // Add worksheet to workbook
      ExcelProcessor.addWorksheetToWorkbook(workbook, worksheet, 'Missing Items');

      // Set filename
      const filename = `missing_items_${supplierName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Write workbook to response
      const buffer = await ExcelProcessor.writeToBuffer(workbook);
      res.end(buffer);

      debug.log('Successfully exported missing items to Excel');
    } catch (error) {
      debug.error('Error exporting missing items:', error);
      res.status(500).json({
        error: 'Failed to export missing items',
        message: error.message,
      });
    }
  });

  // Get supplier responses for an inquiry with pagination
  router.get('/inquiry/:inquiry_id', validateInquiryId, async (req, res, next) => {
    try {
      // Validate and sanitize pagination parameters
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize) || 50));
            
      debug.log('Fetching supplier responses:', {
        inquiry_id: req.params.inquiry_id,
        page,
        pageSize,
      });

      const responses = await supplierResponseService.getSupplierResponses(
        req.params.inquiry_id,
        page,
        pageSize,
      );

      // Enhanced debugging for response data
      debug.log('Raw response data structure:', {
        dataKeys: Object.keys(responses.data || {}),
        statsKeys: Object.keys(responses.stats || {}),
        paginationKeys: Object.keys(responses.pagination || {}),
      });

      // Log sample supplier data
      const sampleSupplierId = Object.keys(responses.data || {})[0];
      if (sampleSupplierId) {
        const sampleSupplier = responses.data[sampleSupplierId];
        debug.log('Sample supplier data structure:', {
          supplier_id: sampleSupplierId,
          dataKeys: Object.keys(sampleSupplier),
          missing_items_type: typeof sampleSupplier.missing_items,
          missing_items_length: Array.isArray(sampleSupplier.missing_items) ? sampleSupplier.missing_items.length : 'not an array',
          missing_items_sample: Array.isArray(sampleSupplier.missing_items) && sampleSupplier.missing_items.length > 0 
            ? sampleSupplier.missing_items[0] 
            : 'no items',
        });
      }

      // Log missing items data specifically
      debug.log('Missing items data:', {
        globalMissingItems: responses.stats.missing_items,
        supplierSpecificMissing: Object.entries(responses.data || {}).map(([id, data]) => ({
          supplier_id: id,
          missing_count: Array.isArray(data.missing_items) ? data.missing_items.length : 'not an array',
          sample: Array.isArray(data.missing_items) && data.missing_items.length > 0 ? data.missing_items[0] : null,
        })),
      });

      // Add pagination metadata to response headers
      res.set({
        'X-Page': responses.pagination.page,
        'X-Page-Size': responses.pagination.pageSize,
        'X-Has-More': responses.pagination.hasMore,
      });

      // Transform the response to ensure missing items are properly included
      const transformedData = Object.entries(responses.data).reduce((acc, [supplierId, supplierData]) => {
        // Parse missing items if it's a string
        let missing_items = [];
        if (supplierData.missing_items) {
          if (typeof supplierData.missing_items === 'string') {
            try {
              // Split by semicolon and parse each item as JSON
              missing_items = supplierData.missing_items
                .split(';')
                .filter(Boolean)
                .map(item => {
                  try {
                    // Try parsing each item as JSON
                    return JSON.parse(item);
                  } catch (jsonError) {
                    debug.error('Error parsing JSON item:', {
                      item,
                      error: jsonError.message,
                    });
                    // If JSON parse fails, try parsing as delimited string
                    const [
                      item_id,
                      hebrew_description,
                      english_description,
                      requested_qty,
                      retail_price,
                      origin,
                    ] = item.split('|').map(field => field?.trim());

                    return {
                      item_id,
                      hebrew_description,
                      english_description: english_description || '',
                      requested_qty: parseInt(requested_qty, 10) || 0,
                      retail_price: parseFloat(retail_price) || 0,
                      origin: origin || '',
                    };
                  }
                });
            } catch (e) {
              debug.error('Error parsing missing items:', {
                error: e.message,
                raw: supplierData.missing_items,
              });
              missing_items = [];
            }
          } else if (Array.isArray(supplierData.missing_items)) {
            missing_items = supplierData.missing_items;
          }
        }

        debug.log(`Transformed missing items for supplier ${supplierId}:`, {
          raw: supplierData.missing_items,
          parsed: missing_items,
          count: missing_items.length,
          sample: missing_items[0],
        });

        acc[supplierId] = {
          ...supplierData,
          missing_items: missing_items,
        };
        return acc;
      }, {});

      // Send the response data with stats
      res.json({
        data: transformedData,
        stats: {
          totalResponses: responses.stats.totalResponses,
          totalItems: responses.stats.totalItems,
          totalSuppliers: responses.stats.totalSuppliers,
          respondedItems: responses.stats.respondedItems,
          missingResponses: responses.stats.missingResponses,
        },
      });
    } catch (err) {
      debug.error('Error in supplier responses route:', err);
      next(err);
    }
  });

  // Get columns from Excel file
  router.post('/columns', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        throw new Error('No file uploaded');
      }

      // Use the full path from req.file
      const filePath = req.file.fullPath || path.join(__dirname, '..', 'uploads', req.file.filename);

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found after upload');
      }

      debug.log('Reading columns from file:', filePath);
            
      try {
        const rawColumns = await ExcelProcessor.getColumns(filePath);
                
        // Process columns to ensure they are valid strings
        const processedColumns = rawColumns
          .filter(col => col != null)
          .map(col => String(col).trim())
          .filter(col => col.length > 0);

        debug.log('Processed columns:', processedColumns);

        if (processedColumns.length === 0) {
          throw new Error('No valid columns found in the Excel file');
        }

        res.json({
          columns: processedColumns,
          tempFile: req.file.filename,
        });
      } catch (excelError) {
        debug.error('Error processing Excel file:', excelError);
        throw new Error(`Failed to read Excel file: ${excelError.message}`);
      }
    } catch (error) {
      debug.error('Error reading Excel columns:', error);
      if (req.file?.fullPath) {
        cleanupFile(req.file.fullPath);
      }
      res.status(400).json({
        error: 'Failed to read Excel columns',
        message: error.message,
        suggestion: 'Please ensure your file is a valid Excel file with headers in the first row',
      });
    }
  });

  // Delete a specific supplier response
  router.delete('/:response_id', validateResponseId, async (req, res, next) => {
    try {
      const result = await supplierResponseService.deleteResponse(req.params.response_id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Delete a reference change
  router.delete('/reference-change/:change_id', validateChangeId, async (req, res, next) => {
    try {
      const result = await supplierResponseService.deleteReferenceChange(req.params.change_id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Delete all responses for a supplier on a specific date
  router.delete('/bulk/:date/:supplier_id', validateBulkDelete, async (req, res, next) => {
    try {
      const result = await supplierResponseService.deleteBulkResponses(
        req.params.date,
        req.params.supplier_id,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Handle supplier response upload
  router.post('/upload', 
    upload.single('file'),
    validateUpload,
    async (req, res, next) => {
      try {
        if (!req.file) {
          throw new Error('No file uploaded');
        }

        // Use the full path from req.file
        const filePath = req.file.fullPath || path.join(__dirname, '..', 'uploads', req.file.filename);

        // Verify file exists
        if (!fs.existsSync(filePath)) {
          throw new Error('File not found after upload');
        }

        // Update req.file with the correct path
        req.file.path = filePath;

        // Parse the column mapping
        let columnMapping;
        try {
          columnMapping = typeof req.body.column_mapping === 'string' 
            ? JSON.parse(req.body.column_mapping) 
            : req.body.column_mapping;
        } catch (error) {
          throw new Error('Invalid column mapping format');
        }

        const result = await supplierResponseService.processUpload(
          req.file,
          columnMapping,
          req.body.supplier_id,
          req.body.inquiry_id,
        );
        res.json(result);
      } catch (error) {
        debug.error('Upload processing error:', error);
        if (req.file?.fullPath) {
          cleanupFile(req.file.fullPath);
        }
        next(error);
      }
    },
  );

  // Error handling middleware
  router.use(handleErrors);

  return router;
}

module.exports = createRouter;
