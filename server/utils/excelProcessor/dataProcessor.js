const XLSX = require('xlsx');
const debug = require('../debug');
const { ExcelValidator, ExcelValidationError, CircularReferenceError } = require('./validator');
const { BatchProcessor, BatchProcessingError } = require('./batchProcessor');

// Common field mapping for converting client-side field names to database field names
const fieldMap = {
  'itemID': 'item_id',
  'newReferenceID': 'new_reference_id',
  'hsCode': 'hs_code',
  'HSCode': 'hs_code',
  'englishDescription': 'english_description',
  'EnglishDescription': 'english_description',
  'hebrewDescription': 'hebrew_description',
  'HebrewDescription': 'hebrew_description',
  'importMarkup': 'import_markup',
  'ImportMarkup': 'import_markup',
  'requestedQty': 'requested_qty',
  'RequestedQty': 'requested_qty',
  'stockQuantity': 'qty_in_stock',
  'StockQuantity': 'qty_in_stock',
  'retailPrice': 'retail_price',
  'RetailPrice': 'retail_price',
  'qtySoldThisYear': 'qty_sold_this_year',     // Fixed mapping
  'QtySoldThisYear': 'qty_sold_this_year',     // Fixed mapping
  'qty_sold_this_year': 'qty_sold_this_year',  // Fixed mapping
  'qtySoldLastYear': 'qty_sold_last_year',     // Fixed mapping
  'QtySoldLastYear': 'qty_sold_last_year',     // Fixed mapping
  'qty_sold_last_year': 'qty_sold_last_year',  // Fixed mapping
  'referenceNotes': 'reference_notes',
  'ReferenceNotes': 'reference_notes',
  'notes': 'notes',
  'Notes': 'notes',
  'origin': 'origin',
  'Origin': 'origin',
};

// Helper function to convert field names to snake_case
function convertToSnakeCase(field) {
  return fieldMap[field] || field.toLowerCase().replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Helper function to safely parse numeric values
function parseNumericValue(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  // If it's already a number (Excel might provide it as such)
  if (typeof value === 'number') {
    return Math.max(0, value);
  }

  // Convert to string and clean up
  const strValue = String(value).trim();
    
  // Remove any spaces and handle both comma and period as decimal separators
  const cleanValue = strValue.replace(/\s/g, '').replace(/,/g, '.');
  const numValue = Number(cleanValue);

  return !isNaN(numValue) ? Math.max(0, numValue) : defaultValue;
}

/**
 * Process inquiry data from Excel file
 * @param {string} filePath - Path to Excel file
 * @param {Object} columnMapping - Column mapping configuration
 * @param {Object} model - Database model instance
 * @returns {Promise<Array>} Processed data
 * @throws {ExcelValidationError|CircularReferenceError|BatchProcessingError}
 */
async function processInquiryData(filePath, columnMapping, model) {
  try {
    debug.log('Processing inquiry data with mapping:', columnMapping);

    // Initialize validator and processor
    const validator = new ExcelValidator(model);
    const batchProcessor = new BatchProcessor(model);
        
    // Read Excel file
    const workbook = XLSX.readFile(filePath, {
      raw: true,
      cellDates: true,
      cellNF: false,
      cellText: false,
    });
        
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, {
      raw: true,
      defval: '',
      blankrows: false,
    });

    // Validate Excel format and data
    await validator.validateFormat(data, columnMapping);
    await validator.validateReferences(data, columnMapping);

    // Collect all unique items
    const itemsMap = validator.collectUniqueItems(data, columnMapping);

    // Process items in batch
    const batchResults = await batchProcessor.createItems(itemsMap, columnMapping);
    debug.log('Batch processing results:', batchResults);

    // If there are any errors, throw them
    if (batchResults.errors.length > 0) {
      throw new BatchProcessingError('Some items failed to process', {
        errors: batchResults.errors,
        created: batchResults.created,
        updated: batchResults.updated,
        referenced: batchResults.referenced,
      });
    }

    // Process the data for return
    const processedData = data.map((row, index) => {
      const processedRow = {
        excel_row_index: index,
      };

      // Convert fields using mapping
      for (const [field, excelCol] of Object.entries(columnMapping)) {
        if (!excelCol) continue;
        const value = row[excelCol];
        const dbField = convertToSnakeCase(field);

        switch (dbField) {
        case 'item_id':
          processedRow.item_id = String(value).trim();
          processedRow.original_item_id = processedRow.item_id;
          break;

        case 'requested_qty':
          processedRow.requested_qty = parseNumericValue(value, 0);
          break;

        case 'import_markup':
          processedRow.import_markup = Math.min(Math.max(parseNumericValue(value, 1.3), 1.0), 2.0);
          break;

        case 'retail_price':
          processedRow.retail_price = parseNumericValue(value);
          break;

        case 'qty_in_stock':
        case 'sold_this_year':
        case 'sold_last_year':
          processedRow[dbField] = parseNumericValue(value);
          break;

        default:
          if (value) {
            processedRow[dbField] = String(value).trim();
          }
        }
      }

      // Add reference information from itemsMap
      const itemData = itemsMap.get(processedRow.item_id);
      if (itemData) {
        if (itemData.references.size > 0) {
          processedRow.has_reference_change = true;
          processedRow.reference_change = {
            source: 'inquiry_item',
            new_reference_id: Array.from(itemData.references)[0],
            notes: processedRow.reference_notes || 'Reference from Excel upload',
          };
        }
        if (itemData.referencedBy.size > 0) {
          processedRow.is_referenced_by = true;
          processedRow.referencing_items = Array.from(itemData.referencedBy).map(id => ({
            item_id: id,
            reference_change: {
              source: 'inquiry_item',
              notes: 'Reference from Excel upload',
            },
          }));
        }
      }

      return processedRow;
    });

    debug.log('Successfully processed inquiry data:', {
      totalRows: processedData.length,
      created: batchResults.created.length,
      updated: batchResults.updated.length,
      referenced: batchResults.referenced.length,
    });

    return processedData;
  } catch (error) {
    debug.error('Error processing inquiry data:', error);
    throw error;
  }
}

/**
 * Validate data against required fields
 * @param {Object[]} data - Data to validate
 * @param {string[]} requiredFields - List of required fields
 * @throws {ExcelValidationError}
 */
function validateData(data, requiredFields) {
  const errors = [];
  data.forEach((row, index) => {
    requiredFields.forEach(field => {
      const dbField = convertToSnakeCase(field);
      const value = row[dbField];
      if (value == null || (typeof value === 'string' && !value.trim())) {
        errors.push({
          row: index + 2,
          field: dbField,
          message: `Missing required field: ${dbField}`,
        });
      }
    });
  });

  if (errors.length > 0) {
    throw new ExcelValidationError('Data validation failed', { errors });
  }

  return true;
}

// Helper function to get optimal column width based on content type
function getColumnWidth(header, sampleValue) {
  if (!header) return { wch: 15 }; // Default width for undefined headers
  if (header.includes('Description')) return { wch: 40 }; // Wider for descriptions
  if (header === 'Item ID' || header.includes('Code')) return { wch: 12 }; // Medium for IDs and codes
  if (typeof sampleValue === 'number') return { wch: 10 }; // Narrower for numbers
  return { wch: 15 }; // Default width
}

/**
 * Process and format data for Excel export
 * @param {Object[]} items - Items to export
 * @param {string[]} selectedHeaders - Headers to include
 * @param {Object} headerDisplayMap - Map of header names
 * @returns {Promise<Object>} Export results
 */
async function processExportData(items, selectedHeaders, headerDisplayMap) {
  debug.log('Starting export data processing with:', {
    itemCount: items.length,
    selectedHeaders,
    headerDisplayMap,
  });

  // Log any headers that don't have display mappings
  const unmappedHeaders = selectedHeaders.filter(header => !headerDisplayMap[header]);
  if (unmappedHeaders.length > 0) {
    debug.log('Warning: Some headers do not have display mappings:', unmappedHeaders);
  }

  try {
    // Transform items to include ONLY selected headers
    const rows = items.map(item => {
      const filteredRow = {};
      selectedHeaders.forEach(header => {
        if (!(header in item)) {
          debug.error(`Warning: Header '${header}' not found in item:`, Object.keys(item));
        }
        // Map current_ prefixed fields
        const fieldValue = header.startsWith('qty_in_stock') ? item['current_qty_in_stock'] :
          header.startsWith('retail_price') ? item['current_retail_price'] :
            header.startsWith('sold_this_year') ? item['current_sold_this_year'] :
              header.startsWith('sold_last_year') ? item['current_sold_last_year'] :
                item[header];

        let value = fieldValue;
                
        // Format specific values
        if (['retail_price', 'import_markup'].includes(header) && value != null) {
          value = parseNumericValue(value, 0).toFixed(2);
        } else if (header === 'requested_qty' || header === 'qty_in_stock' ||
                  header === 'sold_this_year' || header === 'sold_last_year') {
          value = parseNumericValue(value, 0);
        } else if (header === 'hebrew_description' || header === 'english_description') {
          value = value ? String(value).trim() : '';
        }

        // Use the display name as the key, fallback to original header if no mapping exists
        const displayName = headerDisplayMap[header] || header;
        filteredRow[displayName] = value ?? ''; // Convert null/undefined to empty string
      });

      return filteredRow;
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const headerDisplayNames = selectedHeaders.map(header => headerDisplayMap[header]);
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: headerDisplayNames,
      raw: false,
    });

    // Set column widths
    ws['!cols'] = headerDisplayNames.map((header, idx) => {
      const sampleValue = rows[0] ? rows[0][header] : null;
      return getColumnWidth(header, sampleValue);
    });

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inquiry Items');

    // Generate Excel file
    const buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
      bookSST: true,
      cellStyles: true,
      compression: true,
    });

    return {
      buffer,
      rowCount: rows.length,
      headers: headerDisplayNames,
    };
  } catch (error) {
    debug.error('Error processing export data:', error);
    throw new Error('Failed to process export data: ' + error.message);
  }
}

module.exports = {
  processInquiryData,
  validateData,
  processExportData,
};
