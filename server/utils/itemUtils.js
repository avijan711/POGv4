const debug = require('./debug');

/**
 * Utility functions for item operations
 */
const itemUtils = {
    /**
     * Validate item data
     * @param {Object} data - Item data to validate
     * @returns {Object} - Validation result {isValid, errors}
     */
    validateItemData: (data) => {
        const errors = [];
        
        if (!data.itemID) {
            errors.push('Item ID is required');
        }
        
        if (!data.hebrewDescription && !data.englishDescription) {
            errors.push('At least one description (Hebrew or English) is required');
        }

        if (data.retailPrice !== undefined && data.retailPrice !== null) {
            const price = parseFloat(data.retailPrice);
            if (isNaN(price) || price < 0) {
                errors.push('Retail price must be a positive number');
            }
        }

        if (data.importMarkup) {
            const markup = parseFloat(data.importMarkup);
            if (isNaN(markup) || markup <= 0) {
                errors.push('Import markup must be a positive number');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    /**
     * Format item data for database operations
     * @param {Object} data - Raw item data
     * @returns {Object} - Formatted item data
     */
    formatItemData: (data) => {
        return {
            itemID: data.itemID?.toString().trim().replace(/\./g, ''),
            hebrewDescription: data.hebrewDescription,
            englishDescription: data.englishDescription || '',
            importMarkup: parseFloat(data.importMarkup) || 1.30,
            hsCode: data.hsCode || '',
            image: data.image || '',
            qtyInStock: parseInt(data.qtyInStock) || 0,
            soldThisYear: parseInt(data.soldThisYear) || 0,
            soldLastYear: parseInt(data.soldLastYear) || 0,
            retailPrice: data.retailPrice !== undefined && data.retailPrice !== '' ? 
                parseFloat(data.retailPrice) : null
        };
    },

    /**
     * Parse JSON fields in item data
     * @param {Object} data - Item data with potential JSON fields
     * @param {Array<string>} fields - Fields to parse
     * @returns {Object} - Data with parsed JSON fields
     */
    parseJsonFields: (data, fields) => {
        const result = { ...data };
        fields.forEach(field => {
            if (result[field]) {
                try {
                    if (typeof result[field] === 'string') {
                        result[field] = JSON.parse(result[field]);
                        debug.log(`Parsed JSON field: ${field}`);
                    }
                } catch (e) {
                    debug.error(`Error parsing JSON field ${field}:`, e);
                    result[field] = null;
                }
            }
        });
        return result;
    },

    /**
     * Generate database query parameters
     * @param {Object} data - Item data
     * @param {boolean} includeImage - Whether to include image parameter
     * @returns {Array} - Array of query parameters
     */
    generateQueryParams: (data, includeImage = false) => {
        const params = [
            data.hebrewDescription,
            data.englishDescription || '',
            data.importMarkup || 1.30,
            data.hsCode || '',
            data.qtyInStock || 0,
            data.retailPrice,
            data.soldThisYear || 0,
            data.soldLastYear || 0
        ];

        if (includeImage && data.image) {
            params.splice(4, 0, data.image);
        }

        return params;
    },

    /**
     * Check if item has retail price
     * @param {Object} data - Item data
     * @returns {boolean} - Whether item has retail price
     */
    hasRetailPrice: (data) => {
        return data.retailPrice !== undefined && 
               data.retailPrice !== null && 
               data.retailPrice !== '';
    },

    /**
     * Format reference change data
     * @param {Object} data - Reference change data
     * @returns {Object} - Formatted reference change data
     */
    formatReferenceChange: (data) => {
        return {
            newReferenceId: data.newReferenceId?.toString().trim().replace(/\./g, ''),
            supplierId: data.supplierId,
            notes: data.notes || '',
            changedByUser: !data.supplierId
        };
    }
};

module.exports = itemUtils;
