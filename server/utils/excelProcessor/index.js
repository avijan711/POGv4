const { getExcelColumns } = require('./columnReader');
const { processInquiryData, processSupplierResponse, validateData } = require('./dataProcessor');
const { 
    validateColumnMapping, 
    validateFileType, 
    validateDataTypes, 
    typeValidations 
} = require('./validator');
const XLSX = require('xlsx');
const debug = require('../debug');

class ExcelProcessor {
    static readExcelFile(filePath) {
        debug.log('Reading Excel file:', filePath);
        validateFileType(filePath);
        
        try {
            const workbook = XLSX.readFile(filePath);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Get the range of the sheet
            const range = XLSX.utils.decode_range(firstSheet['!ref']);
            
            // Get headers (first row)
            const headers = [];
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                const cell = firstSheet[cellAddress];
                
                // Ensure header is a string
                const headerValue = cell ? String(cell.v).trim() : '';
                if (headerValue) {
                    headers.push(headerValue);
                }
            }

            // Convert sheet to array of objects with string values
            const rawData = XLSX.utils.sheet_to_json(firstSheet, { 
                header: headers,
                range: 1,  // Skip header row
                raw: false,  // Convert everything to strings
                defval: ''   // Default empty value
            });

            // Process data to ensure all values are strings and handle Hebrew decimal separators
            const data = rawData.map(row => {
                const processedRow = {};
                headers.forEach(header => {
                    let value = row[header];
                    // Convert to string and trim
                    value = value != null ? String(value).trim() : '';
                    // Handle Hebrew decimal separator (comma)
                    if (value && !isNaN(value.replace(/,/g, '.'))) {
                        value = value.replace(/,/g, '.');
                    }
                    processedRow[header] = value;
                });
                return processedRow;
            });

            // Filter out empty rows
            const filteredData = data.filter(row => {
                return Object.values(row).some(value => value !== '');
            });

            debug.log('Excel file processed:', {
                headers,
                rowCount: filteredData.length,
                sampleRow: filteredData[0]
            });

            return { headers, data: filteredData };
        } catch (error) {
            debug.error('Error reading Excel file:', error);
            throw new Error(`Failed to read Excel file: ${error.message}`);
        }
    }

    static async getColumns(filePath) {
        debug.log('Getting Excel columns:', filePath);
        validateFileType(filePath);
        
        try {
            const rawColumns = await getExcelColumns(filePath);
            
            // Process and validate columns - rawColumns is now an array of strings
            const processedColumns = rawColumns
                .filter(col => col != null)
                .map(col => String(col).trim())
                .filter(col => col.length > 0);

            if (processedColumns.length === 0) {
                throw new Error('No valid columns found in the Excel file');
            }

            debug.log('Processed Excel columns:', {
                original: rawColumns,
                processed: processedColumns
            });

            return processedColumns;
        } catch (error) {
            debug.error('Error processing Excel columns:', error);
            throw new Error(`Failed to process Excel columns: ${error.message}`);
        }
    }

    static async processInquiry(filePath, columnMapping, db) {
        debug.log('Processing inquiry file:', {
            filePath,
            mappingKeys: Object.keys(columnMapping)
        });

        // Validate file and mapping
        validateFileType(filePath);
        validateColumnMapping(columnMapping, ['ItemID', 'HebrewDescription', 'RequestedQty']);  // Use database field names

        try {
            // Process the data using the new processInquiryData function
            const data = await processInquiryData(filePath, columnMapping, db);

            // Validate data types
            validateDataTypes(data, typeValidations);

            debug.log('Inquiry data processed:', {
                rowCount: data.length,
                sampleRow: data[0]
            });

            return data;
        } catch (error) {
            debug.error('Error processing inquiry file:', error);
            throw error;
        }
    }

    static async processResponse(filePath, columnMapping, options = {}) {
        debug.log('Processing supplier response:', {
            filePath,
            mappingKeys: Object.keys(columnMapping),
            options
        });

        // Validate file first
        validateFileType(filePath);

        // Convert client-side field names to database field names
        const requiredFields = (options.requiredFields || ['itemID']).map(field => {
            switch (field) {
                case 'itemID':
                    return 'ItemID';
                case 'newReferenceID':
                    return 'NewReferenceID';
                default:
                    return field.charAt(0).toUpperCase() + field.slice(1);
            }
        });
        
        // Validate the mapping with the database field names
        validateColumnMapping(columnMapping, requiredFields);

        // Process data using the original mapping
        const data = await processSupplierResponse(filePath, columnMapping);

        // Validate data with database field names
        validateData(data, requiredFields);

        // Validate data types if specified
        if (options.typeValidations) {
            validateDataTypes(data, options.typeValidations);
        }

        debug.log('Processed supplier response data:', {
            sampleRow: data[0],
            totalRows: data.length
        });

        return data;
    }

    static validateMapping(columnMapping, requiredFields) {
        // Convert required fields to database field names
        const dbFields = requiredFields.map(field => {
            switch (field) {
                case 'itemID':
                    return 'ItemID';
                case 'newReferenceID':
                    return 'NewReferenceID';
                default:
                    return field.charAt(0).toUpperCase() + field.slice(1);
            }
        });
        return validateColumnMapping(columnMapping, dbFields);
    }

    static validateFile(filename) {
        return validateFileType(filename);
    }

    static get validations() {
        return typeValidations;
    }
}

module.exports = ExcelProcessor;
