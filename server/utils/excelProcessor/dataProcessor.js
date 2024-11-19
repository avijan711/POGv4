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
                    case 'itemId':
                        if (!value) {
                            throw new Error(`Missing required itemId in row ${index + 2}`);
                        }
                        processedRow[field] = value;
                        processedRow.originalItemId = value; // Always store original ID
                        
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

                    case 'hebrewDescription':
                        if (!value) {
                            throw new Error(`Missing required Hebrew description in row ${index + 2}`);
                        }
                        processedRow[field] = value;
                        break;

                    case 'requestedQuantity':
                        if (!value) {
                            throw new Error(`Missing required requested quantity in row ${index + 2}`);
                        }
                        const qty = parseInt(value.replace(/,/g, ''), 10);
                        if (isNaN(qty) || qty < 0) {
                            throw new Error(`Invalid requested quantity in row ${index + 2}: ${value}`);
                        }
                        processedRow[field] = qty;
                        break;

                    case 'importMarkup':
                        if (value) {
                            const markup = parseFloat(value.replace(/,/g, '.'));
                            if (!isNaN(markup) && markup >= 1.0 && markup <= 2.0) {
                                processedRow[field] = markup;
                            }
                        }
                        break;

                    case 'newReferenceId':
                        if (value) {
                            const refId = value.trim();
                            // Only set reference if it's different from the itemId
                            if (refId !== processedRow.itemId) {
                                processedRow[field] = refId;
                                processedRow.newReferenceID = refId; // Normalize field name
                                // If there's a notes column mapped, get the notes
                                const notesCol = columnMapping['referenceNotes'];
                                if (notesCol && row[notesCol]) {
                                    processedRow['referenceNotes'] = row[notesCol].trim();
                                }
                                // Create reference change information
                                processedRow['hasReferenceChange'] = true;
                                processedRow['referenceChange'] = {
                                    source: 'inquiry_item',
                                    newReferenceID: refId,
                                    notes: processedRow['referenceNotes'] || 'Replacement from Excel upload'
                                };
                            } else {
                                debug.log(`Skipping self-reference for item ${refId} in row ${index + 2}`);
                            }
                        }
                        break;

                    case 'retailPrice':
                    case 'currentStock':
                    case 'soldThisYear':
                    case 'soldLastYear':
                        if (value) {
                            const num = parseFloat(value.replace(/,/g, '.'));
                            if (!isNaN(num) && num >= 0) {
                                processedRow[field] = num;
                            }
                        }
                        break;

                    case 'englishDescription':
                    case 'hsCode':
                        if (value) {
                            processedRow[field] = value;
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
                    otherItem.itemId === item.newReferenceID
                );
                if (referencedItems.length > 0) {
                    referencedItems.forEach(refItem => {
                        refItem.isReferencedBy = true;
                        if (!refItem.referencingItems) {
                            refItem.referencingItems = [];
                        }
                        refItem.referencingItems.push({
                            itemId: item.itemId,
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
                
                switch (field) {
                    case 'itemId':
                        if (!value) {
                            throw new Error(`Missing required itemId in row ${index + 2}`);
                        }
                        processedRow[field] = value;
                        processedRow.originalItemId = value; // Always store original ID
                        
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
                        if (value) {
                            const price = parseFloat(value.replace(/,/g, '.'));
                            if (!isNaN(price)) {
                                processedRow[field] = price;
                            }
                        }
                        break;
                        
                    case 'newReferenceId':
                        if (value) {
                            const refId = value.trim();
                            // Only set reference if it's different from the itemId
                            if (refId !== processedRow.itemId) {
                                processedRow[field] = refId;
                                processedRow['hasReferenceChange'] = true;
                                processedRow['newReferenceID'] = refId; // Normalize field name
                                processedRow['referenceChange'] = {
                                    source: 'supplier',
                                    newReferenceID: refId,
                                    notes: processedRow.notes || 'Replacement from supplier response'
                                };
                            } else {
                                debug.log(`Skipping self-reference for item ${refId} in row ${index + 2}`);
                            }
                        }
                        break;
                        
                    case 'notes':
                    case 'hsCode':
                    case 'englishDescription':
                        if (value) {
                            processedRow[field] = value;
                        }
                        break;

                    default:
                        if (value) {
                            processedRow[field] = value;
                        }
                }
            });

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
            const value = row[field];
            if (value == null || (typeof value === 'string' && !value.trim())) {
                errors.push({
                    row: index + 2,
                    field,
                    message: `Missing required field: ${field}`
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
