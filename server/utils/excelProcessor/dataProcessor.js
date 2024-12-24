const XLSX = require('xlsx');
const debug = require('../debug');

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

async function processInquiryData(filePath, columnMapping, model) {
  try {
    debug.log('Processing inquiry data with mapping:', columnMapping);
        
    // Read Excel file with specific options to handle numeric values correctly
    const workbook = XLSX.readFile(filePath, {
      raw: true,      // Get raw values
      cellDates: true, // Handle dates properly
      cellNF: false,   // Don't parse number formats
      cellText: false,  // Don't generate text values
    });
        
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
    // Convert sheet to JSON with specific options
    const data = XLSX.utils.sheet_to_json(firstSheet, {
      raw: true,      // Get raw values
      defval: '',     // Default value for empty cells
      blankrows: false, // Skip blank rows
    });

    if (data.length === 0) {
      throw new Error('Excel file must contain at least one data row');
    }

    // Track duplicates and original positions
    const itemIdCounts = {};
    const itemIdFirstIndex = {};

    const processedData = await Promise.all(data.map(async (row, index) => {
      const processedRow = {
        excel_row_index: index, // Preserve original Excel order
      };
            
      for (const [field, excelCol] of Object.entries(columnMapping)) {
        if (!excelCol) continue;
                
        let value = row[excelCol];
                
        // Convert field to snake_case
        const dbField = convertToSnakeCase(field);
                
        debug.log(`Processing field ${dbField} with value "${value}" from Excel column "${excelCol}"`);

        switch (dbField) {
        case 'item_id':
          if (!value) {
            throw new Error(`Missing required Item ID in row ${index + 2}`);
          }
          value = String(value).trim();
          processedRow.item_id = value;
          processedRow.original_item_id = value;
                        
          // Track duplicates
          itemIdCounts[value] = (itemIdCounts[value] || 0) + 1;
          if (itemIdCounts[value] === 1) {
            itemIdFirstIndex[value] = index;
          }
          processedRow.is_duplicate = itemIdCounts[value] > 1;
          if (processedRow.is_duplicate) {
            processedRow.original_row_index = itemIdFirstIndex[value];
          }

          // Check for existing references in the database
          const referenceQuery = `
                            SELECT 
                                rc.*,
                                s.name as supplier_name
                            FROM item_reference_change rc
                            LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
                            WHERE rc.original_item_id = ? OR rc.new_reference_id = ?
                            ORDER BY rc.change_date DESC
                            LIMIT 1
                        `;
          const reference = await model.querySingle(referenceQuery, [value, value]);
                        
          if (reference) {
            if (reference.original_item_id === value) {
              processedRow.has_reference_change = true;
              processedRow.reference_change = {
                change_id: reference.change_id,
                new_reference_id: reference.new_reference_id,
                source: reference.supplier_id ? 'supplier' : 'user',
                supplier_name: reference.supplier_name || '',
                notes: reference.notes || '',
              };
            } else {
              processedRow.is_referenced_by = true;
              processedRow.referencing_items = [{
                item_id: reference.original_item_id,
                reference_change: {
                  change_id: reference.change_id,
                  source: reference.supplier_id ? 'supplier' : 'user',
                  supplier_name: reference.supplier_name || '',
                  notes: reference.notes || '',
                },
              }];
            }
          }
          break;

        case 'hebrew_description':
          if (!value) {
            throw new Error(`Missing required Hebrew description in row ${index + 2}`);
          }
          processedRow.hebrew_description = String(value).trim();
          break;

        case 'requested_qty':
          processedRow.requested_qty = parseNumericValue(value, 0);
          break;

        case 'import_markup':
          if (value) {
            const markup = parseNumericValue(value);
            if (markup >= 1.0 && markup <= 2.0) {
              processedRow.import_markup = markup;
            }
          }
          break;

        case 'new_reference_id':
          if (value) {
            const refId = String(value).trim();
            // Only set reference if it's different from the item_id
            if (refId !== processedRow.item_id) {
              processedRow.new_reference_id = refId;
              // If there's a notes column mapped, get the notes
              const notesCol = columnMapping['reference_notes'];
              if (notesCol && row[notesCol]) {
                processedRow.reference_notes = String(row[notesCol]).trim();
              }
              // Create reference change information
              processedRow.has_reference_change = true;
              processedRow.reference_change = {
                source: 'inquiry_item',
                new_reference_id: refId,
                notes: processedRow.reference_notes || 'Replacement from Excel upload',
              };
            } else {
              debug.log(`Skipping self-reference for item ${refId} in row ${index + 2}`);
            }
          }
          break;

        case 'sold_this_year':
        case 'sold_last_year':
          // Handle numeric values with 0 as default for empty/invalid values
          const numericValue = parseNumericValue(value, 0);
          processedRow[dbField] = Math.floor(numericValue); // Ensure whole number
                        
          // Only log successful processing if there was an actual value
          if (value !== null && value !== undefined && value !== '') {
            debug.log(`Successfully processed ${dbField}:`, {
              field: dbField,
              itemId: processedRow.item_id,
              originalValue: value,
              finalValue: processedRow[dbField],
            });
          }
          break;

        case 'qty_in_stock':
          processedRow[dbField] = parseNumericValue(value, 0);
          break;

        case 'retail_price':
          if (value) {
            processedRow[dbField] = parseNumericValue(value);
          }
          break;

        case 'english_description':
        case 'hs_code':
        case 'notes':
        case 'origin':
          if (value) {
            processedRow[dbField] = String(value).trim();
          }
          break;

        default:
          if (value) {
            processedRow[dbField] = String(value).trim();
          }
        }
      }

      // Log the final processed row
      debug.log('Processed row:', {
        itemId: processedRow.item_id,
        soldThisYear: processedRow.sold_this_year,
        soldLastYear: processedRow.sold_last_year,
        rowIndex: index + 2,
      });

      return processedRow;
    }));

    // Process referencing items
    processedData.forEach(item => {
      if (item.has_reference_change) {
        const referencedItems = processedData.filter(otherItem => 
          otherItem.item_id === item.new_reference_id,
        );
        if (referencedItems.length > 0) {
          referencedItems.forEach(refItem => {
            refItem.is_referenced_by = true;
            if (!refItem.referencing_items) {
              refItem.referencing_items = [];
            }
            refItem.referencing_items.push({
              item_id: item.item_id,
              reference_change: item.reference_change,
            });
          });
        }
      }
    });

    // Sort by original Excel order
    processedData.sort((a, b) => a.excel_row_index - b.excel_row_index);

    debug.log('Final processed data:', {
      totalRows: processedData.length,
      sampleRows: processedData.slice(0, 3).map(row => ({
        itemId: row.item_id,
        soldThisYear: row.sold_this_year,
        soldLastYear: row.sold_last_year,
      })),
      duplicates: Object.entries(itemIdCounts).filter(([_, count]) => count > 1).length,
    });

    return processedData;
  } catch (error) {
    debug.error('Error processing inquiry data:', error);
    throw error;
  }
}

function processSupplierResponse(filePath, columnMapping) {
  try {
    const workbook = XLSX.readFile(filePath, {
      cellDates: true,  // Handle dates properly
      cellNF: true,     // Keep number formats
      cellText: false,  // Don't generate text values
      cellFormula: false, // Don't parse formulas
      WTF: false,       // Don't include cell metadata
    });
        
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
    // Get the data with raw values and number formats
    const data = XLSX.utils.sheet_to_json(firstSheet, {
      header: 'A',     // Use A1 notation
      raw: false,      // Don't use raw values
      defval: '',      // Default empty cells to empty string
      blankrows: false, // Skip empty rows
    });

    if (data.length === 0) {
      throw new Error('Excel file must contain at least one data row');
    }

    // Track duplicates and original positions
    const itemIdCounts = {};
    const itemIdFirstIndex = {};

    const processedData = data.slice(1).map((row, index) => { // Skip header row
      const processedRow = {
        excel_row_index: index,
      };
            
      Object.entries(columnMapping).forEach(([field, excelCol]) => {
        if (!excelCol) return;
                
        let value = row[excelCol];
        const cell = firstSheet[XLSX.utils.encode_cell({r: index + 1, c: XLSX.utils.decode_col(excelCol)})];
                
        // Convert field to snake_case
        const dbField = convertToSnakeCase(field);
                
        switch (dbField) {
        case 'item_id':
          if (!value) {
            throw new Error(`Missing required Item ID in row ${index + 2}`);
          }
          processedRow.item_id = String(value).trim();
          processedRow.original_item_id = processedRow.item_id;
                        
          // Track duplicates
          itemIdCounts[processedRow.item_id] = (itemIdCounts[processedRow.item_id] || 0) + 1;
          if (itemIdCounts[processedRow.item_id] === 1) {
            itemIdFirstIndex[processedRow.item_id] = index;
          }
          processedRow.is_duplicate = itemIdCounts[processedRow.item_id] > 1;
          if (processedRow.is_duplicate) {
            processedRow.original_row_index = itemIdFirstIndex[processedRow.item_id];
          }
          break;
                        
        case 'price_quoted':
          let priceValue;
                        
          if (cell && cell.v !== undefined) {
            if (typeof cell.v === 'number') {
              // If it's a number, use it directly
              priceValue = cell.v;
            } else if (typeof cell.v === 'string') {
              // If it's a string, try to parse it
              // Remove any currency symbols and spaces
              const cleanValue = cell.v.replace(/[^\d.,\-]/g, '').trim();
              // Handle comma as decimal separator
              const normalizedValue = cleanValue.replace(',', '.');
              priceValue = parseFloat(normalizedValue);
            }
                            
            // If parsing failed or value is invalid, default to 0
            if (isNaN(priceValue)) {
              priceValue = 0;
              debug.warn(`Invalid price value in row ${index + 2}: ${cell.v}`);
            }
          } else {
            priceValue = 0;
          }
                        
          // Store the price with full precision
          processedRow.price = priceValue;
          processedRow.price_quoted = priceValue;
                        
          // Log for debugging
          debug.log(`Processing price for row ${index + 2}:`, {
            originalValue: cell?.v,
            valueType: typeof cell?.v,
            cellFormat: cell?.z,
            parsedPrice: priceValue,
          });
          break;
                        
        case 'new_reference_id':
          if (value) {
            const refId = String(value).trim();
            // Only set reference if it's different from the item_id
            if (refId !== processedRow.item_id) {
              processedRow.new_reference_id = refId;
              processedRow.has_reference_change = true;
              processedRow.reference_change = {
                source: 'supplier',
                new_reference_id: refId,
                notes: processedRow.notes || 'Replacement from supplier response',
              };
            } else {
              debug.log(`Skipping self-reference for item ${refId} in row ${index + 2}`);
            }
          }
          break;
                        
        case 'notes':
        case 'origin':
        case 'hs_code':
        case 'english_description':
          if (value) {
            processedRow[dbField] = String(value).trim();
          }
          break;

        default:
          if (value) {
            processedRow[dbField] = String(value).trim();
          }
        }
      });

      return processedRow;
    });

    // Sort by original Excel order
    processedData.sort((a, b) => a.excel_row_index - b.excel_row_index);

    debug.log('Processed supplier response:', {
      totalRows: processedData.length,
      sampleRow: processedData[0],
      duplicates: Object.entries(itemIdCounts).filter(([_, count]) => count > 1).length,
    });

    return processedData;
  } catch (error) {
    debug.error('Error processing supplier response:', error);
    throw error;
  }
}

function validateData(data, requiredFields) {
  const errors = [];
  data.forEach((row, index) => {
    requiredFields.forEach(field => {
      // Convert field to snake_case
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
    throw new Error('Data validation failed: ' + JSON.stringify(errors));
  }

  return true;
}

// Helper function to get optimal column width based on content type
function getColumnWidth(header, sampleValue) {
  // Add null check for header
  if (!header) {
    return { wch: 15 }; // Default width for undefined headers
  }

  if (header.includes('Description')) {
    return { wch: 40 }; // Wider for descriptions
  } else if (header === 'Item ID' || header.includes('Code')) {
    return { wch: 12 }; // Medium for IDs and codes
  } else if (typeof sampleValue === 'number') {
    return { wch: 10 }; // Narrower for numbers
  }
  return { wch: 15 }; // Default width
}

// Process and format data for Excel export
async function processExportData(items, selectedHeaders, headerDisplayMap) {
  debug.log('Starting export data processing with:', {
    itemCount: items.length,
    selectedHeaders,
    headerDisplayMap,
  });

  try {
    // Transform items to include ONLY selected headers with strict filtering
    const rows = items.map((item, index) => {
      const filteredRow = {};
      selectedHeaders.forEach(header => {
        let value = item[header];
                
        // Format specific values
        if (['retail_price', 'import_markup'].includes(header) && value != null) {
          value = parseNumericValue(value, 0).toFixed(2);
        } else if (header === 'requested_qty') {
          value = parseNumericValue(value, 0);
        } else if (header === 'hebrew_description' || header === 'english_description') {
          // Ensure text fields are properly encoded
          value = value ? String(value).trim() : '';
        }

        // Use the display name as the key
        const displayName = headerDisplayMap[header];
        filteredRow[displayName] = value ?? ''; // Convert null/undefined to empty string
      });

      if (index === 0) {
        debug.log('First row sample after filtering:', filteredRow);
        debug.log('First row keys:', Object.keys(filteredRow));
      }

      return filteredRow;
    });

    debug.log('Transformed all rows. Sample sizes:', {
      rowCount: rows.length,
      firstRowKeys: Object.keys(rows[0] || {}),
      expectedHeaders: selectedHeaders.map(h => headerDisplayMap[h]),
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const headerDisplayNames = selectedHeaders.map(header => headerDisplayMap[header]);
        
    debug.log('Creating worksheet with headers:', headerDisplayNames);

    // Set worksheet options for better RTL and Unicode support
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: headerDisplayNames,
      raw: false, // This ensures text is properly encoded
    });

    // Verify worksheet structure
    debug.log('Worksheet created. Properties:', {
      ref: ws['!ref'],
      cols: ws['!cols']?.length,
      merges: ws['!merges']?.length,
      firstCell: ws['A1'],
    });

    // Set RTL for Hebrew columns
    const hebrewColumns = headerDisplayNames.reduce((acc, header, idx) => {
      if (header === 'Hebrew Description') {
        acc[XLSX.utils.encode_col(idx)] = { direction: 'rtl' };
      }
      return acc;
    }, {});

    debug.log('Hebrew columns configuration:', hebrewColumns);

    // Set column properties
    ws['!cols'] = headerDisplayNames.map((header, idx) => {
      const sampleValue = rows[0] ? rows[0][header] : null;
      const width = getColumnWidth(header, sampleValue);
      const colConfig = {
        ...width,
        rtl: header === 'Hebrew Description',
        wpx: width.wch * 7,
      };
      debug.log(`Column ${idx} (${header}) config:`, colConfig);
      return colConfig;
    });

    // Add worksheet to workbook with UTF-8 encoding
    XLSX.utils.book_append_sheet(wb, ws, 'Inquiry Items');

    debug.log('Generating final Excel buffer with options:', {
      bookSST: true,
      cellStyles: true,
      compression: true,
    });

    // Generate Excel file with RTL and encoding options
    const buffer = XLSX.write(wb, { 
      type: 'buffer', 
      bookType: 'xlsx',
      bookSST: true, // Enable shared strings for better Unicode support
      cellStyles: true, // Enable cell styles for RTL
      compression: true, // Enable compression for better file size
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
  processSupplierResponse,
  validateData,
  processExportData,
};
