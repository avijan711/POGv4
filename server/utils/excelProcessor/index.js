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

// Common field mapping for converting client-side field names to database field names
const fieldMap = {
    'itemID': 'item_id',
    'newReferenceID': 'new_reference_id',
    'hsCode': 'hs_code',
    'englishDescription': 'english_description',
    'hebrewDescription': 'hebrew_description',
    'importMarkup': 'import_markup',
    'requestedQty': 'requested_qty',
    'stockQuantity': 'qty_in_stock',
    'StockQuantity': 'qty_in_stock',
    'retailPrice': 'retail_price',
    'RetailPrice': 'retail_price',
    'qtySoldThisYear': 'sold_this_year',
    'QtySoldThisYear': 'sold_this_year',
    'qtySoldLastYear': 'sold_last_year',
    'QtySoldLastYear': 'sold_last_year',
    'referenceNotes': 'reference_notes'
};

// Helper function to convert field names to snake_case
function convertToSnakeCase(field) {
    return fieldMap[field] || field.toLowerCase().replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

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

        // Convert column mapping keys to database field names
        const convertedMapping = {};
        Object.entries(columnMapping).forEach(([field, value]) => {
            const dbField = convertToSnakeCase(field);
            convertedMapping[dbField] = value;
        });

        // Pass the field names directly to validateColumnMapping
        validateColumnMapping(convertedMapping, ['item_id', 'hebrew_description', 'requested_qty']);

        try {
            // Process the data using the new processInquiryData function
            const data = await processInquiryData(filePath, convertedMapping, db);

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
        const requiredFields = (options.requiredFields || ['item_id']).map(field => convertToSnakeCase(field));
        
        // Convert column mapping keys to database field names
        const convertedMapping = {};
        Object.entries(columnMapping).forEach(([field, value]) => {
            const dbField = convertToSnakeCase(field);
            convertedMapping[dbField] = value;
        });
        
        // Validate the mapping with the database field names
        validateColumnMapping(convertedMapping, requiredFields);

        // Process data using the converted mapping
        const data = await processSupplierResponse(filePath, convertedMapping);

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
        debug.log('Validating column mapping:', {
            mapping: columnMapping,
            requiredFields
        });

        // Convert required fields to snake_case
        const snakeCaseRequiredFields = requiredFields.map(field => convertToSnakeCase(field));
        
        // Convert column mapping keys to snake_case
        const convertedMapping = {};
        Object.entries(columnMapping).forEach(([field, value]) => {
            const dbField = convertToSnakeCase(field);
            convertedMapping[dbField] = value;
        });
        
        // Pass the converted fields to validateColumnMapping
        return validateColumnMapping(convertedMapping, snakeCaseRequiredFields);
    }

    static validateFile(filename) {
        return validateFileType(filename);
    }

    static get validations() {
        return typeValidations;
    }
}

module.exports = ExcelProcessor;
