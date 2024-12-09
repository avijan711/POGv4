/**
 * Utility functions for cleaning and standardizing item IDs
 */

/**
 * Cleans and standardizes an item ID by:
 * 1. Removing decimal points
 * 2. Removing spaces
 * 3. Removing exactly 4 leading zeros if present
 * 4. Converting to uppercase
 * 
 * Examples:
 * - "00001109AL" -> "1109AL" (removes exactly 4 leading zeros)
 * - "00000052CT" -> "052CT" (removes exactly 4 leading zeros)
 * - "0111AT" -> "0111AT" (keeps zeros when not exactly 4 leading)
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
        // Remove exactly 4 leading zeros
        .replace(/^0000(?=\d)/, '')
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
