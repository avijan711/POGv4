const XLSX = require('xlsx');
const debug = require('../debug');
const BaseModel = require('../../models/BaseModel');

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
    'qtySoldThisYear': 'sold_this_year',
    'QtySoldThisYear': 'sold_this_year',
    'qty_sold_this_year': 'sold_this_year',
    'qtySoldLastYear': 'sold_last_year',
    'QtySoldLastYear': 'sold_last_year',
    'qty_sold_last_year': 'sold_last_year',
    'referenceNotes': 'reference_notes',
    'ReferenceNotes': 'reference_notes',
    'notes': 'notes',
    'Notes': 'notes',
    'origin': 'origin',
    'Origin': 'origin'
};

// Helper function to convert field names to snake_case
function convertToSnakeCase(field) {
    return fieldMap[field] || field.toLowerCase().replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

async function processInquiryData(filePath, columnMapping, db) {
    try {
        debug.log('Processing inquiry data with mapping:', columnMapping);
        
        const workbook = XLSX.readFile(filePath);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        const data = XLSX.utils.sheet_to_json(firstSheet, { 
            raw: false,
            defval: ''
        });

        if (data.length === 0) {
            throw new Error('Excel file must contain at least one data row');
        }

        // Track duplicates and original positions
        const itemIdCounts = {};
        const itemIdFirstIndex = {};

        // Create BaseModel instance for database queries
        const model = new BaseModel(db);

        const processedData = await Promise.all(data.map(async (row, index) => {
            const processedRow = {
                excel_row_index: index // Preserve original Excel order
            };
            
            for (const [field, excelCol] of Object.entries(columnMapping)) {
                if (!excelCol) continue;
                
                let value = row[excelCol];
                value = value != null ? String(value).trim() : null;
                
                // Convert field to snake_case
                const dbField = convertToSnakeCase(field);
                
                debug.log(`Processing field ${dbField} with value "${value}" from Excel column "${excelCol}"`);

                switch (dbField) {
                    case 'item_id':
                        if (!value) {
                            throw new Error(`Missing required Item ID in row ${index + 2}`);
                        }
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
                        const reference = await model.executeQuerySingle(referenceQuery, [value, value]);
                        
                        if (reference) {
                            if (reference.original_item_id === value) {
                                processedRow.has_reference_change = true;
                                processedRow.reference_change = {
                                    change_id: reference.change_id,
                                    new_reference_id: reference.new_reference_id,
                                    source: reference.supplier_id ? 'supplier' : 'user',
                                    supplier_name: reference.supplier_name || '',
                                    notes: reference.notes || ''
                                };
                            } else {
                                processedRow.is_referenced_by = true;
                                processedRow.referencing_items = [{
                                    item_id: reference.original_item_id,
                                    reference_change: {
                                        change_id: reference.change_id,
                                        source: reference.supplier_id ? 'supplier' : 'user',
                                        supplier_name: reference.supplier_name || '',
                                        notes: reference.notes || ''
                                    }
                                }];
                            }
                        }
                        break;

                    case 'hebrew_description':
                        if (!value) {
                            throw new Error(`Missing required Hebrew description in row ${index + 2}`);
                        }
                        processedRow.hebrew_description = value;
                        break;

                    case 'requested_qty':
                        // Default to 0 if value is empty or not provided
                        if (!value) {
                            processedRow.requested_qty = 0;
                            break;
                        }
                        const qty = parseInt(value.replace(/,/g, ''), 10);
                        if (isNaN(qty) || qty < 0) {
                            throw new Error(`Invalid requested quantity in row ${index + 2}: ${value}`);
                        }
                        processedRow.requested_qty = qty;
                        break;

                    case 'import_markup':
                        if (value) {
                            const markup = parseFloat(value.replace(/,/g, '.'));
                            if (!isNaN(markup) && markup >= 1.0 && markup <= 2.0) {
                                processedRow.import_markup = markup;
                            }
                        }
                        break;

                    case 'new_reference_id':
                        if (value) {
                            const refId = value.trim();
                            // Only set reference if it's different from the item_id
                            if (refId !== processedRow.item_id) {
                                processedRow.new_reference_id = refId;
                                // If there's a notes column mapped, get the notes
                                const notesCol = columnMapping['reference_notes'];
                                if (notesCol && row[notesCol]) {
                                    processedRow.reference_notes = row[notesCol].trim();
                                }
                                // Create reference change information
                                processedRow.has_reference_change = true;
                                processedRow.reference_change = {
                                    source: 'inquiry_item',
                                    new_reference_id: refId,
                                    notes: processedRow.reference_notes || 'Replacement from Excel upload'
                                };
                            } else {
                                debug.log(`Skipping self-reference for item ${refId} in row ${index + 2}`);
                            }
                        }
                        break;

                    case 'sold_this_year':
                    case 'sold_last_year':
                        // Convert to number and ensure non-negative
                        if (value) {
                            // Remove any spaces and handle both comma and period as decimal separators
                            const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
                            const numericValue = parseInt(cleanValue, 10);
                            
                            debug.log(`Processing ${dbField}:`, {
                                originalValue: value,
                                cleanedValue: cleanValue,
                                parsedValue: numericValue,
                                itemId: processedRow.item_id
                            });

                            if (!isNaN(numericValue) && numericValue >= 0) {
                                processedRow[dbField] = numericValue;
                                debug.log(`Successfully processed ${dbField}:`, {
                                    field: dbField,
                                    itemId: processedRow.item_id,
                                    originalValue: value,
                                    finalValue: numericValue
                                });
                            } else {
                                debug.error(`Invalid ${dbField} format:`, {
                                    field: dbField,
                                    itemId: processedRow.item_id,
                                    originalValue: value,
                                    cleanedValue: cleanValue,
                                    parsedValue: numericValue
                                });
                                processedRow[dbField] = 0; // Default to 0 for invalid values
                            }
                        } else {
                            debug.log(`Empty ${dbField}, defaulting to 0:`, {
                                field: dbField,
                                itemId: processedRow.item_id
                            });
                            processedRow[dbField] = 0; // Default to 0 for empty values
                        }
                        break;

                    case 'qty_in_stock':
                        // Convert to number and ensure non-negative
                        if (value) {
                            // Remove any spaces and handle both comma and period as decimal separators
                            const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
                            const numericValue = Number(cleanValue);
                            
                            if (!isNaN(numericValue) && numericValue >= 0) {
                                processedRow[dbField] = numericValue;
                                debug.log(`Processed ${dbField} for item ${processedRow.item_id}: ${value} -> ${numericValue}`);
                            } else {
                                debug.error(`Invalid ${dbField} format for item ${processedRow.item_id}: ${value}`);
                                processedRow[dbField] = 0; // Default to 0 for invalid values
                            }
                        } else {
                            processedRow[dbField] = 0; // Default to 0 for empty values
                        }
                        break;

                    case 'retail_price':
                        if (value) {
                            const num = parseFloat(value.replace(/,/g, '.'));
                            if (!isNaN(num) && num >= 0) {
                                processedRow[dbField] = num;
                            }
                        }
                        break;

                    case 'english_description':
                    case 'hs_code':
                    case 'notes':
                    case 'origin':
                        if (value) {
                            processedRow[dbField] = value;
                        }
                        break;

                    default:
                        if (value) {
                            processedRow[dbField] = value;
                        }
                }
            }

            // Log the final processed row
            debug.log('Processed row:', {
                itemId: processedRow.item_id,
                soldThisYear: processedRow.sold_this_year,
                soldLastYear: processedRow.sold_last_year,
                rowIndex: index + 2
            });

            return processedRow;
        }));

        // Process referencing items
        processedData.forEach(item => {
            if (item.has_reference_change) {
                const referencedItems = processedData.filter(otherItem => 
                    otherItem.item_id === item.new_reference_id
                );
                if (referencedItems.length > 0) {
                    referencedItems.forEach(refItem => {
                        refItem.is_referenced_by = true;
                        if (!refItem.referencing_items) {
                            refItem.referencing_items = [];
                        }
                        refItem.referencing_items.push({
                            item_id: item.item_id,
                            reference_change: item.reference_change
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
                soldLastYear: row.sold_last_year
            })),
            duplicates: Object.entries(itemIdCounts).filter(([_, count]) => count > 1).length
        });

        return processedData;
    } catch (error) {
        debug.error('Error processing inquiry data:', error);
        throw error;
    }
}

function processSupplierResponse(filePath, columnMapping) {
    try {
        const workbook = XLSX.readFile(filePath);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        const data = XLSX.utils.sheet_to_json(firstSheet, { 
            raw: false,
            defval: ''
        });

        if (data.length === 0) {
            throw new Error('Excel file must contain at least one data row');
        }

        // Track duplicates and original positions
        const itemIdCounts = {};
        const itemIdFirstIndex = {};

        const processedData = data.map((row, index) => {
            const processedRow = {
                excel_row_index: index // Preserve original Excel order
            };
            
            Object.entries(columnMapping).forEach(([field, excelCol]) => {
                if (!excelCol) return;
                
                let value = row[excelCol];
                value = value != null ? String(value).trim() : null;
                
                // Convert field to snake_case
                const dbField = convertToSnakeCase(field);
                
                switch (dbField) {
                    case 'item_id':
                        if (!value) {
                            throw new Error(`Missing required Item ID in row ${index + 2}`);
                        }
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
                        break;
                        
                    case 'price':
                        // Initialize price as null
                        processedRow.price = null;
                        
                        if (value) {
                            // Remove any spaces and handle both comma and period as decimal separators
                            const cleanValue = value.replace(/\s/g, '');
                            
                            // Check if the value uses comma as decimal separator
                            const hasCommaDecimal = /^\d+,\d+$/.test(cleanValue);
                            const hasPeriodDecimal = /^\d+\.\d+$/.test(cleanValue);
                            
                            let numericValue;
                            if (hasCommaDecimal) {
                                // Replace comma with period for decimal
                                numericValue = parseFloat(cleanValue.replace(',', '.'));
                            } else if (hasPeriodDecimal) {
                                // Already in correct format
                                numericValue = parseFloat(cleanValue);
                            } else {
                                // Handle whole numbers or other formats
                                // First remove any thousands separators (both commas and periods)
                                const stripped = cleanValue.replace(/[,.](?=\d{3})/g, '');
                                numericValue = parseFloat(stripped);
                            }
                            
                            if (!isNaN(numericValue) && numericValue >= 0) {
                                processedRow.price = numericValue;
                                debug.log(`Processed price for item ${processedRow.item_id}: ${value} -> ${numericValue}`);
                            } else {
                                debug.error(`Invalid price format for item ${processedRow.item_id}: ${value}`);
                            }
                        }
                        break;
                        
                    case 'new_reference_id':
                        if (value) {
                            const refId = value.trim();
                            // Only set reference if it's different from the item_id
                            if (refId !== processedRow.item_id) {
                                processedRow.new_reference_id = refId;
                                processedRow.has_reference_change = true;
                                processedRow.reference_change = {
                                    source: 'supplier',
                                    new_reference_id: refId,
                                    notes: processedRow.notes || 'Replacement from supplier response'
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
                            processedRow[dbField] = value;
                        }
                        break;

                    default:
                        if (value) {
                            processedRow[dbField] = value;
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
            duplicates: Object.entries(itemIdCounts).filter(([_, count]) => count > 1).length
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
                    message: `Missing required field: ${dbField}`
                });
            }
        });
    });

    if (errors.length > 0) {
        throw new Error('Data validation failed: ' + JSON.stringify(errors));
    }

    return true;
}

module.exports = {
    processInquiryData,
    processSupplierResponse,
    validateData
};
