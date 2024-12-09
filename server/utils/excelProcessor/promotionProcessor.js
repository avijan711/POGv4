const XLSX = require('xlsx');
const debug = require('../debug');
const { cleanItemId } = require('../itemIdCleaner');
const { Worker } = require('worker_threads');
const path = require('path');

class PromotionProcessor {
    static CHUNK_SIZE = 10000; // Process 10000 rows at a time

    /**
     * Process promotion Excel file with column mapping using streaming and chunking
     * @param {string} filePath - Path to Excel file
     * @param {Object} columnMapping - Mapping of required columns to Excel columns
     * @returns {AsyncGenerator<{items: Array, progress: number}>} Generator yielding processed chunks and progress
     */
    static async *processFileInChunks(filePath, columnMapping) {
        try {
            debug.log('Reading promotion file:', filePath);
            debug.log('Column mapping:', columnMapping);

            // Validate column mapping
            if (!columnMapping.item_id || !columnMapping.price) {
                throw new Error('Missing required column mapping for Item ID or Price');
            }

            // Read workbook with streaming enabled
            const workbook = XLSX.readFile(filePath, {
                dense: true,
                cellDates: true,
                rawDates: true,
                sheetRows: 0, // Read all rows
                cellNF: false, // Skip number formatting
                cellHTML: false // Skip HTML formatting
            });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Get headers and create column index map
            const headers = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                range: 0,
                raw: true,
                defval: null
            })[0];

            if (!headers || headers.length === 0) {
                throw new Error('No headers found in Excel file');
            }

            const headerMap = {};
            headers.forEach((header, index) => {
                if (header) headerMap[header] = index;
            });

            // Get column indices
            const itemIdIndex = headerMap[columnMapping.item_id];
            const priceIndex = headerMap[columnMapping.price];

            if (itemIdIndex === undefined || priceIndex === undefined) {
                throw new Error('Could not find mapped columns in file');
            }

            // Process data in chunks
            const itemMap = new Map();
            let processedCount = 0;
            let totalRows = 0;

            // Convert worksheet to array of rows, skipping header
            const rows = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                range: 1,
                raw: true,
                defval: null
            });

            totalRows = rows.length;
            debug.log('Total rows:', totalRows);

            // Process rows in chunks
            for (let i = 0; i < rows.length; i += this.CHUNK_SIZE) {
                const chunk = rows.slice(i, i + this.CHUNK_SIZE);
                const chunkItems = new Map();
                const errors = [];

                // Process chunk
                for (const row of chunk) {
                    try {
                        if (!row || !row[itemIdIndex]) continue;

                        const rawItemId = row[itemIdIndex]?.toString() || '';
                        const rawPrice = row[priceIndex];

                        // Clean and validate item ID
                        const itemId = cleanItemId(rawItemId);
                        if (!itemId) {
                            errors.push(`Invalid item ID "${rawItemId}"`);
                            continue;
                        }

                        // Parse and validate price
                        const price = parseFloat(rawPrice);
                        if (isNaN(price)) {
                            errors.push(`Invalid price "${rawPrice}" for item ${itemId}`);
                            continue;
                        }

                        if (price < 0) {
                            errors.push(`Negative price ${price} for item ${itemId}`);
                            continue;
                        }

                        // If item exists in current chunk or overall, keep the lowest price
                        const existingPrice = chunkItems.get(itemId)?.price ?? itemMap.get(itemId)?.price;
                        if (existingPrice !== undefined) {
                            if (price < existingPrice) {
                                chunkItems.set(itemId, { price, row: i + chunk.indexOf(row) + 2 });
                                debug.log(`Updated item ${itemId} with lower price ${price} (was ${existingPrice})`);
                            }
                        } else {
                            chunkItems.set(itemId, { price, row: i + chunk.indexOf(row) + 2 });
                        }
                    } catch (err) {
                        errors.push(`Row ${i + chunk.indexOf(row) + 2}: ${err.message}`);
                    }
                }

                // Update overall item map with chunk results
                for (const [itemId, data] of chunkItems) {
                    itemMap.set(itemId, data);
                }

                processedCount += chunk.length;
                const progress = Math.round((processedCount / totalRows) * 100);

                // If there are any errors, log them but don't throw
                if (errors.length > 0) {
                    debug.error('Processing errors in chunk:', errors);
                }

                // Convert chunk map to array
                const chunkResult = Array.from(chunkItems.entries()).map(([itemId, data]) => ({
                    item_id: itemId,
                    price: data.price,
                    row: data.row
                }));

                yield {
                    items: chunkResult,
                    progress,
                    total: totalRows,
                    processed: processedCount
                };
            }

            debug.log('Processing completed:', {
                total: itemMap.size,
                duplicatesHandled: totalRows - itemMap.size
            });

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

            const workbook = XLSX.readFile(filePath, {
                sheetRows: 1, // Only read first row
                cellNF: false,
                cellHTML: false
            });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Get headers from first row
            const headers = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                range: 0,
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
}

module.exports = PromotionProcessor;
