import { dataDebug } from './debug';

/**
 * Utility functions for inventory operations
 */
const inventoryUtils = {
  /**
     * Format item data for display
     * @param {Object} item - Raw item data
     * @returns {Object} - Formatted item data
     */
  formatItemForDisplay: (item) => {
    if (!item) return null;

    return {
      ...item,
      import_markup: parseFloat(item.import_markup) || 1.30,
      retail_price: item.retail_price !== null ? parseFloat(item.retail_price) : null,
      qty_in_stock: parseInt(item.qty_in_stock) || 0,
      sold_this_year: parseInt(item.sold_this_year) || 0,
      sold_last_year: parseInt(item.sold_last_year) || 0,
    };
  },

  /**
     * Format item data for form
     * @param {Object} item - Raw item data
     * @returns {Object} - Formatted item data for form
     */
  formatItemForForm: (item) => {
    if (!item) return null;

    return {
      item_id: item.item_id || '',
      hebrew_description: item.hebrew_description || '',
      english_description: item.english_description || '',
      import_markup: item.import_markup?.toString() || '1.30',
      hs_code: item.hs_code || '',
      image: item.image || null,
      qty_in_stock: item.qty_in_stock?.toString() || '0',
      sold_this_year: item.sold_this_year?.toString() || '0',
      sold_last_year: item.sold_last_year?.toString() || '0',
      retail_price: item.retail_price?.toString() || '',
      reference_id: item.reference_id || '',
    };
  },

  /**
     * Get change source text
     * @param {Object} referenceChange - Reference change data
     * @returns {string} - Change source text
     */
  getChangeSource: (referenceChange) => {
    if (!referenceChange) return '';
        
    if (referenceChange.source === 'supplier') {
      return `Changed by supplier ${referenceChange.supplier_name || ''}`;
    } else if (referenceChange.source === 'user') {
      return 'Changed by user';
    }
    return '';
  },

  /**
     * Filter items by search term
     * @param {Array} items - Items to filter
     * @param {string} searchTerm - Search term
     * @returns {Array} - Filtered items
     */
  filterItems: (items, searchTerm) => {
    if (!items?.length) return [];

    // If no search term, return all items sorted by ID
    if (!searchTerm) {
      return [...items].sort((a, b) => a.item_id.localeCompare(b.item_id));
    }

    // Apply search term filter
    const term = searchTerm.toLowerCase();
    const filteredItems = items.filter(item => {
      // Search in all text fields
      return (
        item.item_id?.toLowerCase().includes(term) ||
                item.hebrew_description?.toLowerCase().includes(term) ||
                item.english_description?.toLowerCase().includes(term) ||
                item.hs_code?.toLowerCase().includes(term) ||
                // Also search in reference IDs
                (item.reference_change?.new_reference_id?.toLowerCase().includes(term)) ||
                // Convert numbers to string for searching
                item.import_markup?.toString().includes(term) ||
                item.retail_price?.toString().includes(term)
      );
    });

    // Sort filtered items by ID
    return filteredItems.sort((a, b) => a.item_id.localeCompare(b.item_id));
  },

  /**
     * Get background color based on item status
     * @param {Object} item - Item data
     * @returns {string} - Background color
     */
  getBackgroundColor: (item) => {
    if (!item) return 'inherit';

    if (item.has_reference_change) {
      return 'rgba(255, 152, 0, 0.08)'; // Subtle orange for old/replaced items
    }
    if (item.is_referenced_by) {
      return 'rgba(76, 175, 80, 0.08)'; // Subtle green for new/replacement items
    }
    return 'inherit';
  },

  /**
     * Get hover color based on item status
     * @param {Object} item - Item data
     * @returns {string} - Hover color
     */
  getHoverColor: (item) => {
    if (!item) return 'rgba(0, 0, 0, 0.04)';

    if (item.has_reference_change) {
      return 'rgba(255, 152, 0, 0.15)'; // Slightly darker orange on hover
    }
    if (item.is_referenced_by) {
      return 'rgba(76, 175, 80, 0.15)'; // Slightly darker green on hover
    }
    return 'rgba(0, 0, 0, 0.04)';
  },

  /**
     * Log item data for debugging
     * @param {string} label - Log label
     * @param {Object} data - Data to log
     */
  logItemData: (label, data) => {
    dataDebug.logData(label, {
      item_id: data?.item_id,
      hebrew_description: data?.hebrew_description,
      english_description: data?.english_description,
      has_reference_change: data?.has_reference_change,
      is_referenced_by: data?.is_referenced_by,
      reference_change: data?.reference_change,
      referencing_items: data?.referencing_items,
    });
  },
};

export default inventoryUtils;
