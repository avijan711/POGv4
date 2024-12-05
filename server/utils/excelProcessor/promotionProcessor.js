const XLSX = require('xlsx');
const debug = require('../debug');
const { cleanItemId } = require('../itemIdCleaner');

class PromotionProcessor {
    /**
     * Process promotion Excel file with column mapping
     * @param {string} filePath - Path to Excel file
     * @param {Object} columnMapping - Mapping of required columns to Excel columns
     * @returns {Array<{item_id: string, price: number}>} Array of processed items
     */
    static async processFile(filePath, columnMapping) {
        try {
            debug.log('Reading promotion file:', filePath);
            debug.log('Column mapping:', columnMapping);

            // Read workbook
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON with header row
            const rawData = XLSX.utils.sheet_to_json(worksheet, {
                raw: true,
                defval: null
            });

            if (!rawData || rawData.length === 0) {
                throw new Error('File is empty or missing data rows');
            }

            debug.log('Raw data rows:', rawData.length);

            // Validate column mapping
            if (!columnMapping.item_id || !columnMapping.price) {
                throw new Error('Missing required column mapping for Item ID or Price');
            }

            // Process data rows
            const errors = [];
            const itemMap = new Map(); // Map to track lowest price for each item

            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];
                
                try {
                    // Get values using mapped columns
                    const rawItemId = row[columnMapping.item_id]?.toString() || '';
                    const rawPrice = row[columnMapping.price];

                    // Clean and validate item ID
                    const itemId = cleanItemId(rawItemId);
                    if (!itemId) {
                        errors.push(`Row ${i + 2}: Invalid item ID "${rawItemId}"`);
                        continue;
                    }

                    // Parse and validate price
                    const price = parseFloat(rawPrice);
                    if (isNaN(price)) {
                        errors.push(`Row ${i + 2}: Invalid price "${rawPrice}" for item ${itemId}`);
                        continue;
                    }

                    if (price < 0) {
                        errors.push(`Row ${i + 2}: Negative price ${price} for item ${itemId}`);
                        continue;
                    }

                    // If item exists, keep the lowest price
                    if (itemMap.has(itemId)) {
                        const existingPrice = itemMap.get(itemId).price;
                        if (price < existingPrice) {
                            itemMap.set(itemId, { price, row: i + 2 });
                            debug.log(`Updated item ${itemId} with lower price ${price} (was ${existingPrice})`);
                        }
                    } else {
                        itemMap.set(itemId, { price, row: i + 2 });
                    }

                } catch (err) {
                    errors.push(`Row ${i + 2}: ${err.message}`);
                }
            }

            // Convert map to array of items
            const processedItems = Array.from(itemMap.entries()).map(([itemId, data]) => ({
                item_id: itemId,
                price: data.price,
                row: data.row
            }));

            debug.log('Processed items:', {
                total: processedItems.length,
                errorCount: errors.length,
                duplicatesHandled: rawData.length - processedItems.length
            });

            // If there are any errors, log them but don't throw
            if (errors.length > 0) {
                debug.error('Processing errors:', errors);
            }

            if (processedItems.length === 0) {
                throw new Error('No valid items found after processing');
            }

            return processedItems;
        } catch (err) {
            debug.error('Error processing promotion file:', err);
            throw err;
        }
    }

    /**
     * Get columns from Excel file
     * @param {string} filePath - Path to Excel file
     * @returns {string[]} Array of column names
     */
    static async getColumns(filePath) {
        try {
            debug.log('Getting columns from file:', filePath);

            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Get headers from first row
            const headers = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: true,
                defval: null
            })[0];

            if (!headers || headers.length === 0) {
                throw new Error('No columns found in Excel file');
            }

            // Clean and validate headers
            const cleanedHeaders = headers
                .map(h => h?.toString().trim())
                .filter(h => h && h.length > 0);

            if (cleanedHeaders.length === 0) {
                throw new Error('No valid columns found in Excel file');
            }

            debug.log('Found columns:', cleanedHeaders);

            return cleanedHeaders;
        } catch (err) {
            debug.error('Error getting columns:', err);
            throw new Error(`Failed to get columns: ${err.message}`);
        }
    }

    /**
     * Validate promotion data structure
     * @param {Array} items - Array of processed items
     * @throws {Error} If validation fails
     */
    static validateData(items) {
        if (!Array.isArray(items)) {
            throw new Error('Invalid data structure');
        }

        if (items.length === 0) {
            throw new Error('No valid items found in file');
        }

        const errors = [];

        items.forEach((item, index) => {
            if (!item.item_id || typeof item.price !== 'number') {
                errors.push(`Row ${index + 2}: Missing required fields`);
                return;
            }

            if (item.price < 0) {
                errors.push(`Row ${index + 2}: Invalid price for item ${item.item_id}`);
                return;
            }
        });

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }
}

module.exports = PromotionProcessor;
