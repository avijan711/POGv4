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
        
    if (!data.item_id) {
      errors.push('Item ID is required');
    }
        
    if (!data.hebrew_description && !data.english_description) {
      errors.push('At least one description (Hebrew or English) is required');
    }

    if (data.retail_price !== undefined && data.retail_price !== null) {
      const price = parseFloat(data.retail_price);
      if (isNaN(price) || price < 0) {
        errors.push('Retail price must be a positive number');
      }
    }

    if (data.import_markup) {
      const markup = parseFloat(data.import_markup);
      if (isNaN(markup) || markup <= 0) {
        errors.push('Import markup must be a positive number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
     * Format item data for database operations
     * @param {Object} data - Raw item data
     * @returns {Object} - Formatted item data
     */
  formatItemData: (data) => {
    return {
      item_id: data.item_id?.toString().trim().replace(/\./g, ''),
      hebrew_description: data.hebrew_description,
      english_description: data.english_description || '',
      import_markup: parseFloat(data.import_markup) || 1.30,
      hs_code: data.hs_code || '',
      origin: data.origin || '',
      image: data.image || '',
      stock_quantity: parseInt(data.stock_quantity) || 0,
      sold_this_year: parseInt(data.sold_this_year) || 0,
      sold_last_year: parseInt(data.sold_last_year) || 0,
      retail_price: data.retail_price !== undefined && data.retail_price !== '' ? 
        parseFloat(data.retail_price) : null,
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
      data.hebrew_description,
      data.english_description || '',
      data.import_markup || 1.30,
      data.hs_code || '',
      data.origin || '',
      data.stock_quantity || 0,
      data.retail_price,
      data.sold_this_year || 0,
      data.sold_last_year || 0,
    ];

    if (includeImage && data.image) {
      params.splice(5, 0, data.image);
    }

    return params;
  },

  /**
     * Check if item has retail price
     * @param {Object} data - Item data
     * @returns {boolean} - Whether item has retail price
     */
  hasRetailPrice: (data) => {
    return data.retail_price !== undefined && 
               data.retail_price !== null && 
               data.retail_price !== '';
  },

  /**
     * Format reference change data
     * @param {Object} data - Reference change data
     * @returns {Object} - Formatted reference change data
     */
  formatReferenceChange: (data) => {
    return {
      new_reference_id: data.new_reference_id?.toString().trim().replace(/\./g, ''),
      supplier_id: data.supplier_id,
      notes: data.notes || '',
      changed_by_user: !data.supplier_id,
    };
  },
};

module.exports = itemUtils;
