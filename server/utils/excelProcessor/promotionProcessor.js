const XLSX = require('xlsx');
const debug = require('../debug');
const { cleanItemId } = require('../itemIdCleaner');
const { Worker } = require('worker_threads');
const path = require('path');

class PromotionProcessor {
    static CHUNK_SIZE = 10000; // Process 10000 rows at a time

    /**
     * Parse price value handling European number format
     * @param {any} rawPrice - Raw price value from Excel
     * @returns {number} Parsed price value
     * @throws {Error} If price is invalid
     */
    static parsePrice(rawPrice) {
        if (rawPrice === null || rawPrice === undefined) {
            throw new Error('Price cannot be empty');
        }

        // Convert to string and clean up
        let priceStr = String(rawPrice)
            .trim()
            // Remove currency symbols and spaces
            .replace(/[€$£¥\s]/g, '')
            // Replace European/Hebrew decimal separator
            .replace(/,/g, '.');

        // Parse the cleaned string
        const price = parseFloat(priceStr);

        // Validate the result
        if (isNaN(price)) {
            throw new Error(`Invalid price format: "${rawPrice}"`);
        }
        if (price <= 0) {
            throw new Error(`Price must be greater than 0: ${price}`);
        }

        return price;
    }

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
                const chunkItems = [];
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

                        // Parse and validate price using the new method
                        let price;
                        try {
                            price = this.parsePrice(rawPrice);
                        } catch (priceError) {
                            errors.push(`Row ${i + chunk.indexOf(row) + 2}: ${priceError.message} for item ${itemId}`);
                            continue;
                        }

                        // Add item to chunk results
                        chunkItems.push({
                            item_id: itemId,
                            price,
                            row: i + chunk.indexOf(row) + 2
                        });
                    } catch (err) {
                        errors.push(`Row ${i + chunk.indexOf(row) + 2}: ${err.message}`);
                    }
                }

                processedCount += chunk.length;
                const progress = Math.round((processedCount / totalRows) * 100);

                // If there are any errors, log them but don't throw
                if (errors.length > 0) {
                    debug.error('Processing errors in chunk:', errors);
                }

                yield {
                    items: chunkItems,
                    progress,
                    total: totalRows,
                    processed: processedCount
                };
            }

            debug.log('Processing completed:', {
                total: totalRows
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
