/**
 * Format a date as YYYY-MM-DD
 * @param {Date} date - The date to format
 * @returns {string} The formatted date string
 */
export const formatDate = (date) => {
  return date.getFullYear() + '-' + 
        String(date.getMonth() + 1).padStart(2, '0') + '-' + 
        String(date.getDate()).padStart(2, '0');
};

/**
 * Parse missing items data from various formats
 * @param {Array|Object|string} items - The items to parse
 * @param {string} [supplierId] - Optional supplier ID for filtering
 * @returns {Object} Object containing parsed items and count
 */
export const parseMissingItems = (items, supplierId = null) => {
  console.log('parseMissingItems input:', {
    items,
    type: typeof items,
    supplierId,
  });

  try {
    // Handle supplierSpecificMissing structure
    if (items && Array.isArray(items.supplierSpecificMissing)) {
      const supplierMissing = supplierId 
        ? items.supplierSpecificMissing.find(s => s.supplier_id === supplierId)
        : items.supplierSpecificMissing[0];
            
      return {
        items: supplierMissing ? (supplierMissing.items || []) : [],
        count: supplierMissing ? supplierMissing.missingCount : 0,
      };
    }

    // Handle direct array
    if (Array.isArray(items)) {
      const filteredItems = items.filter(Boolean);
      console.log('Parsed array items:', filteredItems);
      return {
        items: filteredItems,
        count: filteredItems.length,
      };
    }

    // Handle delimited string (format: item_id|hebrew_desc|english_desc|qty|price|origin;...)
    if (typeof items === 'string' && items.includes('|')) {
      const itemsList = items.split(';').filter(Boolean);
      console.log('Split delimited items:', itemsList);
            
      const parsedItems = itemsList.map(item => {
        const [
          item_id,
          hebrew_description,
          english_description,
          requested_qty,
          retail_price,
          origin,
        ] = item.split('|').map(field => field?.trim());

        return {
          item_id,
          hebrew_description,
          english_description: english_description || '',
          requested_qty: parseInt(requested_qty, 10) || 0,
          retail_price: parseFloat(retail_price) || 0,
          origin: origin || '',
        };
      });

      console.log('Parsed delimited items:', parsedItems);
      return {
        items: parsedItems,
        count: parsedItems.length,
      };
    }

    // Handle JSON string
    if (typeof items === 'string' && (items.startsWith('[') || items.startsWith('{'))) {
      try {
        const parsed = JSON.parse(items);
        const filteredItems = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        console.log('Parsed JSON items:', filteredItems);
        return {
          items: filteredItems,
          count: filteredItems.length,
        };
      } catch (e) {
        console.error('Error parsing JSON items:', e);
        return { items: [], count: 0 };
      }
    }

    console.warn('Unknown items format:', items);
    return { items: [], count: 0 };
  } catch (e) {
    console.error('Error parsing missing items:', e);
    console.error('Error details:', {
      error: e.message,
      stack: e.stack,
      input: items,
    });
    return { items: [], count: 0 };
  }
};

/**
 * Format a price with the currency symbol
 * @param {number} price - The price to format
 * @returns {string} The formatted price string
 */
export const formatPrice = (price) => {
  return `₪${Number(price || 0).toFixed(2)}`;
};

/**
 * Get the latest response date from supplier data
 * @param {Object} supplierData - The supplier data object
 * @returns {Date|null} The latest response date or null if not found
 */
export const getLatestResponseDate = (supplierData) => {
  if (!supplierData) return null;

  // Try to get date from responses array first
  if (Array.isArray(supplierData.responses) && supplierData.responses.length > 0) {
    const latestResponse = supplierData.responses[0].response_date;
    if (latestResponse) {
      return new Date(latestResponse);
    }
  }

  // Fall back to latest_response field
  if (supplierData.latest_response) {
    return new Date(supplierData.latest_response);
  }

  return null;
};

/**
 * Get the response count from supplier data
 * @param {Object} supplierData - The supplier data object
 * @returns {number} The total number of responses
 */
export const getResponseCount = (supplierData) => {
  return supplierData.responses?.length || 0;
};

/**
 * Validate supplier data for deletion
 * @param {Object} supplierData - The supplier data to validate
 * @returns {Object} Object containing validation result and any error message
 */
export const validateSupplierForDeletion = (supplierData) => {
  if (!supplierData) {
    return { isValid: false, error: 'No supplier data provided' };
  }

  if (!supplierData.supplier_id) {
    return { isValid: false, error: 'Invalid supplier ID' };
  }

  // Check for response date in multiple places
  const latestResponse = getLatestResponseDate(supplierData);
  if (!latestResponse) {
    return { isValid: false, error: 'No response date found for this supplier' };
  }

  return { isValid: true, error: null };
};
