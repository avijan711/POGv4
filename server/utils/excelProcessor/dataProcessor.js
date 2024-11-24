const XLSX = require('xlsx');
const debug = require('../debug');
const BaseModel = require('../../models/BaseModel');

async function processInquiryData(filePath, columnMapping, db) {
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

        // Create BaseModel instance for database queries
        const model = new BaseModel(db);

        const processedData = await Promise.all(data.map(async (row, index) => {
            const processedRow = {
                excelRowIndex: index // Preserve original Excel order
            };
            
            for (const [field, excelCol] of Object.entries(columnMapping)) {
                if (!excelCol) continue;
                
                let value = row[excelCol];
                value = value != null ? String(value).trim() : null;
                
                switch (field) {
                    case 'itemID':  // Match client field name
                        if (!value) {
                            throw new Error(`Missing required Item ID in row ${index + 2}`);
                        }
                        processedRow.ItemID = value;  // Use database field name
                        processedRow.originalItemID = value; // Always store original ID
                        
                        // Track duplicates
                        itemIdCounts[value] = (itemIdCounts[value] || 0) + 1;
                        if (itemIdCounts[value] === 1) {
                            itemIdFirstIndex[value] = index;
                        }
                        processedRow.isDuplicate = itemIdCounts[value] > 1;
                        if (processedRow.isDuplicate) {
                            processedRow.originalRowIndex = itemIdFirstIndex[value];
                        }

                        // Check for existing references in the database
                        const referenceQuery = `
                            SELECT 
                                rc.*,
                                s.Name as SupplierName
                            FROM ItemReferenceChange rc
                            LEFT JOIN Supplier s ON rc.SupplierID = s.SupplierID
                            WHERE rc.OriginalItemID = ? OR rc.NewReferenceID = ?
                            ORDER BY rc.ChangeDate DESC
                            LIMIT 1
                        `;
                        const reference = await model.executeQuerySingle(referenceQuery, [value, value]);
                        
                        if (reference) {
                            if (reference.OriginalItemID === value) {
                                processedRow.hasReferenceChange = true;
                                processedRow.referenceChange = {
                                    changeId: reference.ChangeID,
                                    newReferenceID: reference.NewReferenceID,
                                    source: reference.SupplierID ? 'supplier' : 'user',
                                    supplierName: reference.SupplierName || '',
                                    notes: reference.Notes || ''
                                };
                            } else {
                                processedRow.isReferencedBy = true;
                                processedRow.referencingItems = [{
                                    itemId: reference.OriginalItemID,
                                    referenceChange: {
                                        changeId: reference.ChangeID,
                                        source: reference.SupplierID ? 'supplier' : 'user',
                                        supplierName: reference.SupplierName || '',
                                        notes: reference.Notes || ''
                                    }
                                }];
                            }
                        }
                        break;

                    case 'HebrewDescription':  // Match client field name
                        if (!value) {
                            throw new Error(`Missing required Hebrew description in row ${index + 2}`);
                        }
                        processedRow.HebrewDescription = value;  // Use database field name
                        break;

                    case 'RequestedQty':  // Match client field name
                        // Default to 0 if value is empty or not provided
                        if (!value) {
                            processedRow.RequestedQty = 0;  // Use database field name
                            break;
                        }
                        const qty = parseInt(value.replace(/,/g, ''), 10);
                        if (isNaN(qty) || qty < 0) {
                            throw new Error(`Invalid requested quantity in row ${index + 2}: ${value}`);
                        }
                        processedRow.RequestedQty = qty;  // Use database field name
                        break;

                    case 'ImportMarkup':  // Match client field name
                        if (value) {
                            const markup = parseFloat(value.replace(/,/g, '.'));
                            if (!isNaN(markup) && markup >= 1.0 && markup <= 2.0) {
                                processedRow.ImportMarkup = markup;  // Use database field name
                            }
                        }
                        break;

                    case 'newReferenceID':  // Match client field name
                        if (value) {
                            const refId = value.trim();
                            // Only set reference if it's different from the itemId
                            if (refId !== processedRow.ItemID) {
                                processedRow.NewReferenceID = refId;  // Use database field name
                                // If there's a notes column mapped, get the notes
                                const notesCol = columnMapping['ReferenceNotes'];
                                if (notesCol && row[notesCol]) {
                                    processedRow.ReferenceNotes = row[notesCol].trim();
                                }
                                // Create reference change information
                                processedRow.hasReferenceChange = true;
                                processedRow.referenceChange = {
                                    source: 'inquiry_item',
                                    newReferenceID: refId,
                                    notes: processedRow.ReferenceNotes || 'Replacement from Excel upload'
                                };
                            } else {
                                debug.log(`Skipping self-reference for item ${refId} in row ${index + 2}`);
                            }
                        }
                        break;

                    case 'RetailPrice':
                    case 'QtyInStock':
                    case 'QtySoldThisYear':
                    case 'QtySoldLastYear':
                        if (value) {
                            const num = parseFloat(value.replace(/,/g, '.'));
                            if (!isNaN(num) && num >= 0) {
                                processedRow[field] = num;  // Use database field name
                            }
                        }
                        break;

                    case 'EnglishDescription':
                    case 'HSCode':
                        if (value) {
                            processedRow[field] = value;  // Use database field name
                        }
                        break;

                    default:
                        if (value) {
                            processedRow[field] = value;
                        }
                }
            }

            return processedRow;
        }));

        // Process referencing items
        processedData.forEach(item => {
            if (item.hasReferenceChange) {
                const referencedItems = processedData.filter(otherItem => 
                    otherItem.ItemID === item.NewReferenceID
                );
                if (referencedItems.length > 0) {
                    referencedItems.forEach(refItem => {
                        refItem.isReferencedBy = true;
                        if (!refItem.referencingItems) {
                            refItem.referencingItems = [];
                        }
                        refItem.referencingItems.push({
                            itemId: item.ItemID,
                            referenceChange: item.referenceChange
                        });
                    });
                }
            }
        });

        // Sort by original Excel order
        processedData.sort((a, b) => a.excelRowIndex - b.excelRowIndex);

        debug.log('Processed inquiry data:', {
            totalRows: processedData.length,
            sampleRow: processedData[0],
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
                excelRowIndex: index // Preserve original Excel order
            };
            
            Object.entries(columnMapping).forEach(([field, excelCol]) => {
                if (!excelCol) return;
                
                let value = row[excelCol];
                value = value != null ? String(value).trim() : null;
                
                // Map of client-side field names to database field names
                const fieldMap = {
                    'itemID': 'ItemID',
                    'newReferenceID': 'NewReferenceID',
                    'hsCode': 'HSCode',
                    'HSCode': 'HSCode',
                    'englishDescription': 'EnglishDescription',
                    'EnglishDescription': 'EnglishDescription',
                    'price': 'Price',
                    'notes': 'Notes'
                };

                // Get the database field name, defaulting to PascalCase if not in map
                const dbField = fieldMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
                
                switch (field.toLowerCase()) {
                    case 'itemid':
                        if (!value) {
                            throw new Error(`Missing required itemID in row ${index + 2}`);
                        }
                        processedRow.ItemID = value;
                        processedRow.originalItemID = value;
                        
                        // Track duplicates
                        itemIdCounts[value] = (itemIdCounts[value] || 0) + 1;
                        if (itemIdCounts[value] === 1) {
                            itemIdFirstIndex[value] = index;
                        }
                        processedRow.isDuplicate = itemIdCounts[value] > 1;
                        if (processedRow.isDuplicate) {
                            processedRow.originalRowIndex = itemIdFirstIndex[value];
                        }
                        break;
                        
                    case 'price':
                        // Initialize Price as null
                        processedRow.Price = null;
                        
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
                                processedRow.Price = numericValue;
                                debug.log(`Processed price for item ${processedRow.ItemID}: ${value} -> ${numericValue}`);
                            } else {
                                debug.error(`Invalid price format for item ${processedRow.ItemID}: ${value}`);
                            }
                        }
                        break;
                        
                    case 'newreferenceid':
                        if (value) {
                            const refId = value.trim();
                            // Only set reference if it's different from the itemID
                            if (refId !== processedRow.ItemID) {
                                processedRow.NewReferenceID = refId;
                                processedRow.hasReferenceChange = true;
                                processedRow.referenceChange = {
                                    source: 'supplier',
                                    NewReferenceID: refId,
                                    Notes: processedRow.Notes || 'Replacement from supplier response'
                                };
                            } else {
                                debug.log(`Skipping self-reference for item ${refId} in row ${index + 2}`);
                            }
                        }
                        break;
                        
                    case 'notes':
                        if (value) {
                            processedRow.Notes = value;
                        }
                        break;

                    case 'hscode':
                        if (value) {
                            processedRow.HSCode = value;
                        }
                        break;

                    case 'englishdescription':
                        if (value) {
                            processedRow.EnglishDescription = value;
                        }
                        break;

                    default:
                        if (value) {
                            processedRow[dbField] = value;
                        }
                }
            });

            // Keep metadata fields in camelCase
            processedRow.excelRowIndex = processedRow.excelRowIndex;
            processedRow.isDuplicate = processedRow.isDuplicate;
            processedRow.originalRowIndex = processedRow.originalRowIndex;
            processedRow.hasReferenceChange = processedRow.hasReferenceChange;
            processedRow.referenceChange = processedRow.referenceChange;

            return processedRow;
        });

        // Sort by original Excel order
        processedData.sort((a, b) => a.excelRowIndex - b.excelRowIndex);

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
            // Map of client-side field names to database field names
            const fieldMap = {
                'itemID': 'ItemID',
                'newReferenceID': 'NewReferenceID',
                'hsCode': 'HSCode',
                'HSCode': 'HSCode',
                'englishDescription': 'EnglishDescription',
                'EnglishDescription': 'EnglishDescription'
            };
            
            // Get the database field name, defaulting to PascalCase if not in map
            const dbField = fieldMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
            
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
