const xlsx = require('xlsx');
const fs = require('fs');

class ExcelProcessor {
    static getExcelColumns(filePath) {
        try {
            const workbook = xlsx.readFile(filePath);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (!data || !data.length) {
                throw new Error('No data found in Excel file');
            }

            // Return first row (headers)
            return data[0].filter(col => col); // Filter out empty columns
        } catch (error) {
            console.error('Error reading Excel columns:', error);
            throw new Error('Failed to read Excel columns');
        }
    }

    static readExcelFile(filePath, options = {}) {
        try {
            const workbook = xlsx.readFile(filePath);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // First get the headers
            const headers = this.getExcelColumns(filePath);
            
            // Then get the data with column mapping if provided
            const data = xlsx.utils.sheet_to_json(worksheet, {
                raw: true,  // Keep original types
                defval: null, // Use null for empty cells
                ...options
            });

            if (!data || !data.length) {
                throw new Error('No data found in Excel file');
            }

            // Process each row to ensure proper type conversion
            const processedData = data.map((row, index) => {
                const processed = {};
                for (const [key, value] of Object.entries(row)) {
                    // Log the raw value for debugging
                    console.log(`Processing row ${index + 1}, column "${key}":`, {
                        rawValue: value,
                        type: typeof value
                    });

                    if (value === null || value === undefined || value === '') {
                        processed[key] = null;
                        continue;
                    }

                    if (key.toLowerCase().includes('price')) {
                        // Handle price values
                        processed[key] = typeof value === 'number' ? value :
                            parseFloat(value.toString().replace(/[^\d.-]/g, '')) || null;
                    }
                    else if (key.toLowerCase().includes('qty') || 
                             key.toLowerCase().includes('quantity') ||
                             key.toLowerCase().includes('stock') || 
                             key.toLowerCase().includes('sold')) {
                        // Handle quantity values - ensure they're integers
                        processed[key] = typeof value === 'number' ? Math.floor(value) :
                            parseInt(value.toString().replace(/[^\d-]/g, '')) || 0;
                    }
                    else if (key.toLowerCase().includes('markup')) {
                        // Handle markup values - keep decimal places
                        processed[key] = typeof value === 'number' ? value :
                            parseFloat(value.toString().replace(/[^\d.-]/g, '')) || 1.3;
                    }
                    else {
                        // Keep other values as strings
                        processed[key] = value.toString().trim();
                    }

                    // Log the processed value for debugging
                    console.log(`Processed value:`, processed[key]);
                }
                return processed;
            });

            return {
                headers,
                data: processedData
            };
        } catch (error) {
            console.error('Excel processing error:', error);
            throw new Error(`Failed to read Excel file: ${error.message}`);
        }
    }

    static processPromotionExcel(filePath, itemIdColumn, priceColumn) {
        try {
            console.log('Processing promotion Excel:', { filePath, itemIdColumn, priceColumn });
            const workbook = xlsx.readFile(filePath);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Get the data with header row as column names
            const data = xlsx.utils.sheet_to_json(worksheet, {
                raw: true,
                defval: null,
                header: "A"  // Use A1 notation for headers
            });

            if (!data || !data.length) {
                throw new Error('No data found in Excel file');
            }

            // Get headers from first row
            const headers = {};
            const firstRow = data[0];
            Object.keys(firstRow).forEach(key => {
                headers[firstRow[key]] = key;
            });

            console.log('Excel headers:', headers);

            // Validate required columns exist
            if (!headers[itemIdColumn]) {
                throw new Error(`Item ID column "${itemIdColumn}" not found in Excel file`);
            }
            if (!headers[priceColumn]) {
                throw new Error(`Price column "${priceColumn}" not found in Excel file`);
            }

            const itemIdCol = headers[itemIdColumn];
            const priceCol = headers[priceColumn];

            // Process data rows (skip header row)
            const processedData = data.slice(1).map((row, index) => {
                const itemId = row[itemIdCol]?.toString().trim();
                if (!itemId) {
                    throw new Error(`Row ${index + 2}: Item ID is required`);
                }

                let price = row[priceCol];
                if (price === null || price === '') {
                    throw new Error(`Row ${index + 2}: Price is required for item ${itemId}`);
                }

                // Convert price to number if it's not already
                if (typeof price !== 'number') {
                    price = parseFloat(price.toString().replace(/[^\d.-]/g, ''));
                }

                if (isNaN(price)) {
                    throw new Error(`Row ${index + 2}: Invalid price format for item ${itemId}`);
                }

                return {
                    itemId,
                    price
                };
            });

            console.log(`Processed ${processedData.length} rows successfully`);
            return processedData;
        } catch (error) {
            console.error('Error processing promotion Excel:', error);
            throw new Error(`Failed to process promotion Excel: ${error.message}`);
        }
    }

    static validateRequiredColumns(headers) {
        if (!Array.isArray(headers)) {
            throw new Error('Invalid headers format');
        }

        // Using the same column names as in the Excel file
        const requiredColumns = ['Item ID', 'Hebrew Description', 'Requested Quantity'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }
    }

    static validateColumnMapping(headers, columnMapping) {
        if (!Array.isArray(headers)) {
            throw new Error('Invalid headers format');
        }

        // Check if required fields are mapped
        const requiredFields = {
            itemID: 'Item ID',
            hebrewDescription: 'Hebrew Description',
            requestedQty: 'Requested Quantity'
        };

        const missingFields = [];
        for (const [field, label] of Object.entries(requiredFields)) {
            if (!columnMapping[field]) {
                missingFields.push(label);
            }
        }

        if (missingFields.length > 0) {
            throw new Error(`Missing required field mappings: ${missingFields.join(', ')}`);
        }

        // Check if mapped columns exist in headers
        const mappedColumns = Object.values(columnMapping).filter(Boolean);
        const missingColumns = mappedColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
            throw new Error(`Mapped columns not found in Excel file: ${missingColumns.join(', ')}`);
        }
    }

    static cleanupFile(filePath) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Cleaned up file:', filePath);
        }
    }

    static createSupplierExport(items, inquiryNumber) {
        try {
            // Format the current date as DD.MM.YYYY
            const today = new Date();
            const formattedDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
            
            // Create worksheet data with only item IDs and requested quantities
            const wsData = items.map(item => ({
                'Item ID': item.itemID,
                'Requested Quantity': item.requestedQty
            }));

            // Convert data to worksheet
            const ws = xlsx.utils.json_to_sheet(wsData);

            // Create workbook and append worksheet
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, 'Items');

            // Generate filename
            const filename = `${inquiryNumber}-${formattedDate}.xlsx`;
            const filePath = `./uploads/${filename}`;

            // Ensure uploads directory exists
            if (!fs.existsSync('./uploads')) {
                fs.mkdirSync('./uploads', { recursive: true });
            }

            // Write file
            xlsx.writeFile(wb, filePath);

            return { filename, filePath };
        } catch (error) {
            console.error('Error creating supplier export:', error);
            throw new Error(`Failed to create supplier export: ${error.message}`);
        }
    }

    static processSupplierResponse(data, supplierId, columnMapping) {
        try {
            console.log('Processing supplier response data:', data);
            console.log('Using column mapping:', columnMapping);
            
            if (!Array.isArray(data) || !data.length) {
                throw new Error('No data rows found in supplier response');
            }

            if (!columnMapping || !columnMapping.itemID) {
                throw new Error('Column mapping must include at least itemID');
            }

            // Process each row with validation using column mapping
            const processedData = data.map((row, index) => {
                // Get values using column mapping
                const itemID = row[columnMapping.itemID]?.toString().trim().replace(/\./g, '');
                if (!itemID) {
                    throw new Error(`Row ${index + 2}: ItemID is required`);
                }

                // Process price if mapped
                let price = null;
                if (columnMapping.price && row[columnMapping.price] !== undefined && row[columnMapping.price] !== '') {
                    price = typeof row[columnMapping.price] === 'number' ? 
                        row[columnMapping.price] : 
                        parseFloat(row[columnMapping.price].toString().replace(/[^\d.-]/g, ''));
                    
                    if (isNaN(price)) {
                        console.warn(`Row ${index + 2}: Invalid price format for item ${itemID}`);
                        price = null;
                    }
                }

                // Process newReferenceID and set to null if it's the same as itemID
                let newReferenceID = columnMapping.newReferenceID && row[columnMapping.newReferenceID] ? 
                    row[columnMapping.newReferenceID].toString().trim().replace(/\./g, '') : null;
                
                // If newReferenceID is the same as itemID, set it to null
                if (newReferenceID === itemID) {
                    newReferenceID = null;
                }
                
                const notes = columnMapping.notes && row[columnMapping.notes] ? 
                    row[columnMapping.notes].toString().trim() : null;

                const hsCode = columnMapping.hsCode && row[columnMapping.hsCode] ?
                    row[columnMapping.hsCode].toString().trim() : null;

                const englishDescription = columnMapping.englishDescription && row[columnMapping.englishDescription] ?
                    row[columnMapping.englishDescription].toString().trim() : null;

                // Create processed row
                const processedRow = {
                    itemID,
                    newReferenceID,
                    price,
                    notes,
                    hsCode,
                    englishDescription
                };

                console.log(`Processed row ${index + 2}:`, processedRow);
                return processedRow;
            });

            // Validate that we have at least one valid row with data
            if (!processedData.some(row => 
                row.price !== null || 
                row.newReferenceID || 
                row.hsCode || 
                row.englishDescription
            )) {
                throw new Error('No valid data found in supplier response. Please ensure at least one row has price, reference ID, HS code, or English description.');
            }

            return { data: processedData };
        } catch (error) {
            console.error('Error processing supplier response:', error);
            throw new Error(`Failed to process supplier response: ${error.message}`);
        }
    }
}

module.exports = ExcelProcessor;
