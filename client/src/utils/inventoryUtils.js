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
            importMarkup: parseFloat(item.importMarkup) || 1.30,
            retailPrice: item.retailPrice !== null ? parseFloat(item.retailPrice) : null,
            qtyInStock: parseInt(item.qtyInStock) || 0,
            soldThisYear: parseInt(item.soldThisYear) || 0,
            soldLastYear: parseInt(item.soldLastYear) || 0
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
            itemID: item.itemID,
            hebrewDescription: item.hebrewDescription || '',
            englishDescription: item.englishDescription || '',
            importMarkup: item.importMarkup?.toString() || '1.30',
            hsCode: item.hsCode || '',
            image: item.image || null,
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
            return `Changed by supplier ${referenceChange.supplierName || ''}`;
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
            return [...items].sort((a, b) => a.itemID.localeCompare(b.itemID));
        }

        // Apply search term filter
        const term = searchTerm.toLowerCase();
        const filteredItems = items.filter(item => {
            // Search in all text fields
            return (
                item.itemID?.toLowerCase().includes(term) ||
                item.hebrewDescription?.toLowerCase().includes(term) ||
                item.englishDescription?.toLowerCase().includes(term) ||
                item.hsCode?.toLowerCase().includes(term) ||
                // Also search in reference IDs
                (item.referenceChange?.newReferenceID?.toLowerCase().includes(term)) ||
                // Convert numbers to string for searching
                item.importMarkup?.toString().includes(term) ||
                item.retailPrice?.toString().includes(term)
            );
        });

        // Sort filtered items by ID
        return filteredItems.sort((a, b) => a.itemID.localeCompare(b.itemID));
    },

    /**
     * Get background color based on item status
     * @param {Object} item - Item data
     * @returns {string} - Background color
     */
    getBackgroundColor: (item) => {
        if (!item) return 'inherit';

        if (item.hasReferenceChange) {
            return 'rgba(255, 152, 0, 0.08)'; // Subtle orange for old/replaced items
        }
        if (item.isReferencedBy) {
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

        if (item.hasReferenceChange) {
            return 'rgba(255, 152, 0, 0.15)'; // Slightly darker orange on hover
        }
        if (item.isReferencedBy) {
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
            itemID: data?.itemID,
            hebrewDescription: data?.hebrewDescription,
            englishDescription: data?.englishDescription,
            hasReferenceChange: data?.hasReferenceChange,
            isReferencedBy: data?.isReferencedBy,
            referenceChange: data?.referenceChange,
            referencingItems: data?.referencingItems
        });
    }
};

export default inventoryUtils;
