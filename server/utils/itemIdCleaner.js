/**
 * Utility functions for cleaning and standardizing item IDs
 */

/**
 * Cleans and standardizes an item ID by:
 * 1. Removing decimal points
 * 2. Removing spaces
 * 3. Trimming leading zeros
 * 4. Converting to uppercase
 * 
 * Examples:
 * - "1174.G9" -> "1174G9"
 * - "98 100 486 80" -> "9810048680"
 * - "00001109AL" -> "1109AL"
 * 
 * @param {string} itemId - The raw item ID to clean
 * @returns {string} The cleaned and standardized item ID
 */
function cleanItemId(itemId) {
    if (!itemId) return '';

    return itemId
        .toString()
        // Remove decimal points
        .replace(/\./g, '')
        // Remove all spaces
        .replace(/\s+/g, '')
        // Remove leading zeros, but handle special cases:
        // 1. If the ID is all zeros, return "0"
        // 2. Keep zeros that are between other characters
        .replace(/^0+(?=\d)/, '')
        // Convert to uppercase
        .toUpperCase();
}

/**
 * Batch cleans multiple item IDs
 * 
 * @param {string[]} itemIds - Array of item IDs to clean
 * @returns {string[]} Array of cleaned item IDs
 */
function cleanItemIds(itemIds) {
    if (!Array.isArray(itemIds)) return [];
    return itemIds.map(cleanItemId);
}

/**
 * Validates if an item ID has been properly cleaned
 * 
 * @param {string} itemId - The item ID to validate
 * @returns {boolean} True if the item ID is properly cleaned
 */
function isCleanItemId(itemId) {
    if (!itemId) return false;

    const cleanedId = cleanItemId(itemId);
    return cleanedId === itemId;
}

/**
 * Cleans item IDs in an object array by specified key
 * 
 * @param {Object[]} items - Array of objects containing item IDs
 * @param {string} idKey - The key containing the item ID in each object
 * @returns {Object[]} Array of objects with cleaned item IDs
 */
function cleanItemIdsInObjects(items, idKey = 'item_id') {
    if (!Array.isArray(items)) return [];
    
    return items.map(item => {
        if (!item || typeof item !== 'object') return item;
        return {
            ...item,
            [idKey]: cleanItemId(item[idKey])
        };
    });
}

module.exports = {
    cleanItemId,
    cleanItemIds,
    isCleanItemId,
    cleanItemIdsInObjects
};
