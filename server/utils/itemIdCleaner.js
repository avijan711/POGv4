/**
 * Utility functions for cleaning and standardizing item IDs
 */

const debug = require('./debug');

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
 * @throws {Error} If itemId is empty or invalid
 */
function cleanItemId(itemId) {
    if (!itemId || (typeof itemId !== 'string' && typeof itemId !== 'number')) {
        throw new Error('Invalid item ID: ID cannot be empty');
    }

    const stringId = itemId.toString();
    const cleaned = stringId
        .trim()
        .replace(/\./g, '')
        .replace(/\s+/g, '')
        .replace(/^0000(?=\d)/, '')
        .toUpperCase();

    if (!cleaned) {
        throw new Error('Invalid item ID: ID cannot be empty after cleaning');
    }

    return cleaned;
}

/**
 * Batch cleans multiple item IDs
 * 
 * @param {string[]} itemIds - Array of item IDs to clean
 * @returns {string[]} Array of cleaned item IDs
 * @throws {Error} If any itemId is empty or invalid
 */
function cleanItemIds(itemIds) {
    if (!Array.isArray(itemIds)) {
        throw new Error('Invalid input: expected array of item IDs');
    }
    
    return itemIds.map(cleanItemId);
}

/**
 * Validates if an item ID has been properly cleaned
 * 
 * @param {string} itemId - The item ID to validate
 * @returns {boolean} True if the item ID is properly cleaned
 */
function isCleanItemId(itemId) {
    try {
        const cleanedId = cleanItemId(itemId);
        return cleanedId === itemId;
    } catch (error) {
        return false;
    }
}

/**
 * Cleans item IDs in an object array by specified key
 * 
 * @param {Object[]} items - Array of objects containing item IDs
 * @param {string} idKey - The key containing the item ID in each object
 * @returns {Object[]} Array of objects with cleaned item IDs
 * @throws {Error} If any itemId is empty or invalid
 */
function cleanItemIdsInObjects(items, idKey = 'item_id') {
    if (!Array.isArray(items)) {
        throw new Error('Invalid input: expected array of objects');
    }
    
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
