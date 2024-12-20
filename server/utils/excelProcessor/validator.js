const debug = require('../debug');
const path = require('path');
const fs = require('fs');

// List of valid Excel MIME types
const VALID_EXCEL_MIMETYPES = [
    'application/vnd.ms-excel',                                           // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel.sheet.macroEnabled.12',                    // .xlsm
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',             // .xlsb
    'application/vnd.ms-excel.template.macroEnabled.12',                 // .xltm
    'application/vnd.ms-excel.template',                                 // .xlt
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template' // .xltx
];

function validateFileType(filePath) {
    if (!filePath) {
        debug.error('No file path provided');
        throw new Error('No file provided');
    }

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            debug.error('File does not exist:', filePath);
            throw new Error('File not found or not accessible');
        }

        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            debug.error('File is empty:', filePath);
            throw new Error('The file is empty');
        }

        if (stats.size > 50 * 1024 * 1024) { // 50MB limit
            debug.error('File too large:', filePath);
            throw new Error('File size exceeds 50MB limit');
        }

        // Check file extension
        const ext = path.extname(filePath).toLowerCase();
        if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
            debug.error('Invalid file extension:', ext);
            throw new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed');
        }

        debug.log('File validation passed:', {
            path: filePath,
            size: stats.size,
            extension: ext
        });

        return true;
    } catch (error) {
        debug.error('File validation error:', error);
        throw new Error(`File validation failed: ${error.message}`);
    }
}

function validateColumnMapping(columnMapping, requiredFields = []) {
    if (!columnMapping || typeof columnMapping !== 'object') {
        debug.error('Invalid column mapping format:', columnMapping);
        throw new Error('Invalid column mapping format');
    }

    try {
        // Convert required fields to snake_case if they aren't already
        const snakeCaseRequiredFields = requiredFields.map(field => 
            field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '')
        );

        // Create a case-insensitive map of column mappings
        const mappingLookup = {};
        Object.entries(columnMapping).forEach(([field, value]) => {
            // Convert field to snake_case
            const snakeField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
            // Store both the snake_case field name and its value
            mappingLookup[snakeField] = {
                field: snakeField,
                value: value
            };
        });

        debug.log('Column mapping lookup:', mappingLookup);

        // Ensure all values in columnMapping are strings
        Object.values(mappingLookup).forEach(({ field, value }) => {
            if (value && typeof value !== 'string') {
                debug.error('Invalid column mapping value:', { field, value });
                throw new Error(`Invalid column mapping value for field: ${field}`);
            }
        });

        // Check for required fields using snake_case comparison
        const missingFields = snakeCaseRequiredFields.filter(field => {
            const lookup = mappingLookup[field];
            return !lookup || !lookup.value;
        });

        if (missingFields.length > 0) {
            debug.error('Missing required fields:', missingFields);
            throw new Error(`Missing required column mappings: ${missingFields.join(', ')}`);
        }

        debug.log('Column mapping validation passed:', {
            mapping: mappingLookup,
            requiredFields: snakeCaseRequiredFields
        });

        return true;
    } catch (error) {
        debug.error('Column mapping validation error:', error);
        throw error;
    }
}

function validateDataTypes(data, typeValidations) {
    if (!Array.isArray(data)) {
        debug.error('Invalid data format:', data);
        throw new Error('Data must be an array');
    }

    try {
        const errors = [];
        data.forEach((row, index) => {
            Object.entries(typeValidations).forEach(([field, validation]) => {
                if (row[field] !== undefined && row[field] !== null) {
                    const value = row[field];
                    const { type, validator } = validation;

                    let isValid = true;
                    let typedValue = value;

                    switch (type) {
                        case 'string':
                            isValid = typeof value === 'string';
                            typedValue = String(value).trim();
                            break;
                        case 'number':
                            // Handle Hebrew decimal separator (comma)
                            const numStr = String(value).replace(/,/g, '.');
                            typedValue = parseFloat(numStr);
                            isValid = !isNaN(typedValue);
                            break;
                        case 'boolean':
                            isValid = typeof value === 'boolean';
                            break;
                        case 'date':
                            // Handle Hebrew date format (dd/mm/yy)
                            const parts = String(value).split('/');
                            if (parts.length === 3) {
                                const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                                typedValue = new Date(`${year}-${parts[1]}-${parts[0]}`);
                                isValid = !isNaN(typedValue.getTime());
                            } else {
                                typedValue = new Date(value);
                                isValid = !isNaN(typedValue.getTime());
                            }
                            break;
                        default:
                            isValid = true;
                    }

                    if (!isValid || (validator && !validator(typedValue))) {
                        errors.push({
                            row: index + 2, // +2 for header row and 0-based index
                            field,
                            value,
                            type,
                            message: `Invalid ${type} value for field: ${field}`
                        });
                    }
                }
            });
        });

        if (errors.length > 0) {
            debug.error('Data validation errors:', errors);
            throw new Error('Data validation failed: ' + JSON.stringify(errors, null, 2));
        }

        debug.log('Data validation passed:', {
            rowCount: data.length,
            validatedFields: Object.keys(typeValidations)
        });

        return true;
    } catch (error) {
        debug.error('Data validation error:', error);
        throw error;
    }
}

const typeValidations = {
    // General validations
    item_id: {  // Match database field name
        type: 'string',
        validator: value => value && value.trim().length > 0
    },
    hebrew_description: {  // Match database field name
        type: 'string',
        validator: value => value && value.trim().length > 0
    },
    english_description: {  // Match database field name
        type: 'string',
        validator: value => true // Optional field
    },
    requested_qty: {  // Match database field name
        type: 'number',
        validator: value => {
            const num = Number(value);
            return Number.isInteger(num) && num >= 0;
        }
    },
    import_markup: {  // Match database field name
        type: 'number',
        validator: value => {
            const num = parseFloat(String(value).replace(/,/g, '.'));
            return !isNaN(num) && num >= 1.0 && num <= 2.0;
        }
    },
    hs_code: {  // Match database field name
        type: 'string',
        validator: value => true // Optional field
    },
    stock_quantity: {  // Match database field name
        type: 'number',
        validator: value => {
            const num = Number(value);
            return Number.isInteger(num) && num >= 0;
        }
    },
    sold_this_year: {  // Match database field name
        type: 'number',
        validator: value => {
            const num = Number(value);
            return Number.isInteger(num) && num >= 0;
        }
    },
    retail_price: {  // Match database field name
        type: 'number',
        validator: value => {
            const num = parseFloat(String(value).replace(/,/g, '.'));
            return !isNaN(num) && num >= 0;
        }
    },
    new_reference_id: {  // Match database field name
        type: 'string',
        validator: value => true // Optional field
    },
    reference_notes: {  // Match database field name
        type: 'string',
        validator: value => true // Optional field
    },
    notes: {  // New field
        type: 'string',
        validator: value => true // Optional field
    },
    origin: {  // New field
        type: 'string',
        validator: value => true // Optional field
    },

    // Promotion-specific validations
    promotion_price: {  // Match database field name
        type: 'number',
        validator: value => {
            const num = parseFloat(String(value).replace(/,/g, '.'));
            return !isNaN(num) && num > 0;
        }
    }
};

// Specific validation sets for different types of data
const validationSets = {
    promotion: {
        required: ['item_id', 'promotion_price'],  // Match database field names
        types: {
            item_id: typeValidations.item_id,
            promotion_price: typeValidations.promotion_price
        }
    },
    inquiry: {
        required: ['item_id', 'hebrew_description', 'requested_qty'],  // Match database field names
        types: {
            item_id: typeValidations.item_id,
            hebrew_description: typeValidations.hebrew_description,
            english_description: typeValidations.english_description,
            requested_qty: typeValidations.requested_qty,
            import_markup: typeValidations.import_markup,
            hs_code: typeValidations.hs_code,
            retail_price: typeValidations.retail_price,
            stock_quantity: typeValidations.stock_quantity,
            sold_this_year: typeValidations.sold_this_year,
            notes: typeValidations.notes,  // Add new field
            origin: typeValidations.origin  // Add new field
        }
    }
};

module.exports = {
    validateFileType,
    validateColumnMapping,
    validateDataTypes,
    typeValidations,
    validationSets,
    VALID_EXCEL_MIMETYPES
};
