const XLSX = require('xlsx');
const debug = require('../debug');
const PromotionProcessor = require('./promotionProcessor');

class ExcelProcessor {
  /**
     * Create a new Excel workbook
     * @returns {Object} XLSX workbook
     */
  static createWorkbook() {
    return XLSX.utils.book_new();
  }

  /**
     * Create worksheet from data
     * @param {Array} data - Array of objects to convert to worksheet
     * @returns {Object} XLSX worksheet
     */
  static createWorksheet(data) {
    return XLSX.utils.json_to_sheet(data, {
      header: Object.keys(data[0] || {}),
      skipHeader: false,
    });
  }

  /**
     * Add worksheet to workbook
     * @param {Object} workbook - XLSX workbook
     * @param {Object} worksheet - XLSX worksheet
     * @param {string} sheetName - Name of the worksheet
     */
  static addWorksheetToWorkbook(workbook, worksheet, sheetName) {
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  /**
     * Write workbook to buffer
     * @param {Object} workbook - XLSX workbook
     * @returns {Buffer} Excel file buffer
     */
  static writeToBuffer(workbook) {
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
     * Read Excel file and return rows as JSON
     * @param {string} filePath - Path to Excel file
     * @returns {Array} Array of rows
     */
  static async readExcelFile(filePath) {
    try {
      debug.log('Reading Excel file:', filePath);

      const workbook = XLSX.readFile(filePath, {
        cellDates: true,
        cellNF: false,
        cellHTML: false,
      });
            
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get headers first
      const headers = this.getHeaderRow(worksheet);
            
      // Read data with header reference
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: headers,
        raw: false,
        defval: null,
      });

      debug.log('Read rows:', rows.length);

      return rows;
    } catch (err) {
      debug.error('Error reading Excel file:', err);
      throw new Error(`Failed to read Excel file: ${err.message}`);
    }
  }

  /**
     * Get header row from worksheet
     * @param {Object} worksheet - XLSX worksheet
     * @returns {Array<string>} Array of header names
     */
  static getHeaderRow(worksheet) {
    const headers = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      range: 0,
      raw: true,
      defval: null,
    })[0];

    if (!headers || headers.length === 0) {
      throw new Error('No headers found in Excel file');
    }

    return headers.map(h => h?.toString().trim()).filter(h => h && h.length > 0);
  }

  /**
     * Get column names from Excel file
     * @param {string} filePath - Path to Excel file
     * @returns {Array<string>} Array of column names
     */
  static async getColumns(filePath) {
    try {
      debug.log('Getting columns from file:', filePath);

      const workbook = XLSX.readFile(filePath, {
        sheetRows: 1,
        cellNF: false,
        cellHTML: false,
      });
            
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get headers from first row
      const headers = this.getHeaderRow(worksheet);

      debug.log('Found columns:', headers);

      return headers;
    } catch (err) {
      debug.error('Error getting columns:', err);
      throw new Error(`Failed to get columns: ${err.message}`);
    }
  }

  /**
     * Parse numeric value handling both dot and comma decimal separators
     * @param {any} value - The value to parse
     * @returns {number} Parsed number or 0 if invalid
     */
  static parseNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    // If it's already a number, return it
    if (typeof value === 'number') {
      return value;
    }

    // Convert to string and clean up
    const strValue = String(value).trim();
        
    // Remove any currency symbols, spaces and handle both comma and period
    const cleanValue = strValue.replace(/[^\d.,\-]/g, '').trim();
        
    // Replace comma with period for proper parsing
    const normalizedValue = cleanValue.replace(',', '.');
        
    // Parse the normalized value
    const numValue = parseFloat(normalizedValue);

    // Log the parsing process for debugging
    debug.log('Parsing numeric value:', {
      original: value,
      cleaned: cleanValue,
      normalized: normalizedValue,
      result: numValue,
    });

    return !isNaN(numValue) ? numValue : 0;
  }

  /**
     * Process supplier response Excel file
     * @param {string} filePath - Path to Excel file
     * @param {Object} columnMapping - Mapping of field names to Excel columns
     * @param {Object} options - Processing options
     * @returns {Array} Array of processed items
     */
  static async processResponse(filePath, columnMapping, options = {}) {
    try {
      debug.log('Processing supplier response file:', {
        filePath,
        columnMapping,
        options,
      });

      const workbook = XLSX.readFile(filePath, {
        cellDates: true,
        cellNF: false,
        cellHTML: false,
      });
            
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get headers first
      const headers = this.getHeaderRow(worksheet);
            
      // Read data with header reference
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: headers,
        raw: false,
        defval: null,
      });

      if (!rows || rows.length === 0) {
        throw new Error('No data found in Excel file');
      }

      // Clean and map the data
      const processedData = rows.map(row => {
        const mappedItem = {};
        for (const [field, excelColumn] of Object.entries(columnMapping)) {
          let value = row[excelColumn];
                    
          // Handle special cases
          if (field === 'price_quoted' || field === 'price') {
            value = this.parseNumericValue(value);
            debug.log(`Processed price for field ${field}:`, {
              original: row[excelColumn],
              processed: value,
            });
          } else if (typeof value === 'string') {
            value = value.trim();
          }

          mappedItem[field] = value;
        }
        return mappedItem;
      }).filter(item => {
        // Filter out rows missing required fields
        if (options.requiredFields) {
          return options.requiredFields.every(field => {
            const value = item[field];
            return value !== null && value !== undefined && value !== '';
          });
        }
        return true;
      });

      debug.log('Processed response data:', {
        rowCount: rows.length,
        processedCount: processedData.length,
        sample: processedData[0],
      });

      return processedData;
    } catch (err) {
      debug.error('Error processing supplier response:', err);
      throw new Error(`Failed to process supplier response: ${err.message}`);
    }
  }

  /**
     * Process promotion Excel file
     * @param {string} filePath - Path to Excel file
     * @returns {Array} Array of processed items
     */
  static async processPromotionFile(filePath) {
    return PromotionProcessor.processFile(filePath);
  }

  /**
     * Validate promotion data
     * @param {Array} items - Array of processed items
     */
  static validatePromotionData(items) {
    return PromotionProcessor.validateData(items);
  }

  /**
     * Validate column mapping
     * @param {Object} mapping - Column mapping object
     * @param {Array<string>} headers - Array of Excel headers
     * @returns {Object} Validated mapping
     */
  static validateMapping(mapping, headers) {
    debug.log('Validating column mapping:', { mapping, headers });

    if (!mapping || typeof mapping !== 'object') {
      throw new Error('Invalid mapping: must be an object');
    }

    if (!Array.isArray(headers)) {
      throw new Error('Invalid headers: must be an array');
    }

    // Convert headers to lowercase for case-insensitive comparison
    const normalizedHeaders = headers.map(h => String(h || '').toLowerCase().trim());

    // Check each mapped field exists in headers
    const invalidMappings = [];
    for (const [field, excelColumn] of Object.entries(mapping)) {
      const normalizedColumn = String(excelColumn).toLowerCase().trim();
      if (!normalizedHeaders.includes(normalizedColumn)) {
        invalidMappings.push(`${field} -> ${excelColumn}`);
      }
    }

    if (invalidMappings.length > 0) {
      throw new Error(`Invalid column mappings: ${invalidMappings.join(', ')}`);
    }

    debug.log('Column mapping validated successfully');
    return mapping;
  }

  /**
     * Clean up Excel file data
     * @param {Array} rows - Array of raw Excel rows
     * @returns {Array} Array of cleaned rows
     */
  static cleanData(rows) {
    if (!Array.isArray(rows)) return [];

    return rows.map(row => {
      const cleanedRow = {};
            
      Object.entries(row).forEach(([key, value]) => {
        // Convert null or undefined to empty string
        if (value == null) {
          cleanedRow[key] = '';
          return;
        }

        // Trim strings
        if (typeof value === 'string') {
          cleanedRow[key] = value.trim();
          return;
        }

        // Keep numbers and other types as is
        cleanedRow[key] = value;
      });

      return cleanedRow;
    });
  }

  /**
     * Find matching column names
     * @param {Array<string>} headers - Array of header names
     * @param {Array<string>} possibleNames - Array of possible column names
     * @returns {string|null} Matching column name or null
     */
  static findMatchingColumn(headers, possibleNames) {
    if (!Array.isArray(headers) || !Array.isArray(possibleNames)) {
      return null;
    }

    const normalizedHeaders = headers.map(h => 
      String(h || '').toLowerCase().trim(),
    );

    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().trim();
      const index = normalizedHeaders.findIndex(h => 
        h.includes(normalizedName),
      );
            
      if (index !== -1) {
        return headers[index];
      }
    }

    return null;
  }

  /**
     * Validate required columns exist
     * @param {Array<string>} headers - Array of header names
     * @param {Array<string>} requiredColumns - Array of required column names
     * @throws {Error} If required columns are missing
     */
  static validateRequiredColumns(headers, requiredColumns) {
    const missingColumns = requiredColumns.filter(col => 
      !headers.some(h => 
        String(h || '').toLowerCase().includes(col.toLowerCase()),
      ),
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Missing required columns: ${missingColumns.join(', ')}`,
      );
    }
  }
}

module.exports = ExcelProcessor;
