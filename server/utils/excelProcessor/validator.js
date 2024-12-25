const debug = require('../debug');

class ExcelValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ExcelValidationError';
    this.details = details;
  }
}

class CircularReferenceError extends Error {
  constructor(message, cycle = []) {
    super(message);
    this.name = 'CircularReferenceError';
    this.cycle = cycle;
  }
}

class ExcelValidator {
  constructor(model) {
    this.model = model;
  }

  /**
   * Validate Excel format and required columns
   * @param {Object[]} data - Parsed Excel data
   * @param {Object} columnMapping - Column mapping configuration
   * @throws {ExcelValidationError}
   */
  validateFormat(data, columnMapping) {
    debug.log('Validating Excel format');

    if (!Array.isArray(data) || data.length === 0) {
      throw new ExcelValidationError('Excel file must contain at least one data row');
    }

    // Check required columns
    const requiredColumns = ['itemID', 'hebrewDescription', 'requestedQty'];
    const missingColumns = requiredColumns.filter(col => !columnMapping[col]);

    if (missingColumns.length > 0) {
      throw new ExcelValidationError('Missing required columns', {
        missingColumns,
        message: `The following columns are required: ${missingColumns.join(', ')}`,
      });
    }

    // Validate each row
    data.forEach((row, index) => {
      const rowNum = index + 2; // Excel row number (1-based + header)
      const errors = [];

      // Check required fields
      for (const field of requiredColumns) {
        const excelCol = columnMapping[field];
        if (!excelCol || !row[excelCol]) {
          errors.push(`Missing required value for ${field}`);
        }
      }

      // Validate numeric fields
      if (columnMapping.requestedQty) {
        const qty = row[columnMapping.requestedQty];
        if (isNaN(qty) || qty <= 0) {
          errors.push('Requested quantity must be a positive number');
        }
      }

      if (columnMapping.importMarkup) {
        const markup = row[columnMapping.importMarkup];
        if (markup && (isNaN(markup) || markup < 1 || markup > 2)) {
          errors.push('Import markup must be between 1.00 and 2.00');
        }
      }

      if (errors.length > 0) {
        throw new ExcelValidationError(`Validation failed for row ${rowNum}`, {
          rowNumber: rowNum,
          errors,
        });
      }
    });

    debug.log('Excel format validation passed');
  }

  /**
   * Validate references and detect cycles
   * @param {Object[]} data - Parsed Excel data
   * @param {Object} columnMapping - Column mapping configuration
   * @throws {ExcelValidationError|CircularReferenceError}
   */
  async validateReferences(data, columnMapping) {
    debug.log('Validating references');

    const referenceMap = new Map();
    const itemIds = new Set();

    // Build reference map and collect item IDs
    data.forEach((row, index) => {
      const itemId = row[columnMapping.itemID]?.toString().trim();
      const newRefId = row[columnMapping.newReferenceID]?.toString().trim();

      if (itemId) {
        itemIds.add(itemId);
        if (newRefId) {
          referenceMap.set(itemId, newRefId);
        }
      }
    });

    // Check for invalid references
    for (const [itemId, refId] of referenceMap) {
      if (!itemIds.has(refId)) {
        throw new ExcelValidationError(`Invalid reference: ${refId} not found in data`, {
          itemId,
          referenceId: refId,
          message: `Referenced item ${refId} does not exist in the uploaded data`,
        });
      }
    }

    // Detect circular references
    for (const startId of referenceMap.keys()) {
      const visited = new Set();
      const path = [startId];
      let currentId = startId;

      while (referenceMap.has(currentId)) {
        currentId = referenceMap.get(currentId);
        
        if (visited.has(currentId)) {
          const cycleStart = path.indexOf(currentId);
          const cycle = path.slice(cycleStart).concat(currentId);
          
          throw new CircularReferenceError(
            `Circular reference detected: ${cycle.join(' -> ')}`,
            cycle,
          );
        }

        visited.add(currentId);
        path.push(currentId);
      }
    }

    debug.log('Reference validation passed');
  }

  /**
   * Collect all unique items (direct and referenced)
   * @param {Object[]} data - Parsed Excel data
   * @param {Object} columnMapping - Column mapping configuration
   * @returns {Map} Map of item IDs to their data
   */
  collectUniqueItems(data, columnMapping) {
    const itemsMap = new Map();

    data.forEach((row, index) => {
      const itemId = row[columnMapping.itemID]?.toString().trim();
      const newRefId = row[columnMapping.newReferenceID]?.toString().trim();

      if (itemId) {
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, {
            row,
            index,
            references: new Set(),
            referencedBy: new Set(),
          });
        }

        if (newRefId) {
          const itemData = itemsMap.get(itemId);
          itemData.references.add(newRefId);

          // Create or update referenced item
          if (!itemsMap.has(newRefId)) {
            itemsMap.set(newRefId, {
              references: new Set(),
              referencedBy: new Set(),
            });
          }
          itemsMap.get(newRefId).referencedBy.add(itemId);
        }
      }
    });

    return itemsMap;
  }
}

/**
 * Validates that the file is an Excel file based on its extension
 * @param {string} filePath - Path to the uploaded file
 * @throws {Error} If file type is invalid
 */
function validateFileType(filePath) {
  if (!filePath) {
    const error = new Error('File path is required');
    error.name = 'FileTypeError';
    throw error;
  }

  const allowedExtensions = ['.xlsx', '.xls'];
  const fileExtension = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));

  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed');
    error.name = 'FileTypeError';
    throw error;
  }
}

module.exports = {
  ExcelValidator,
  ExcelValidationError,
  CircularReferenceError,
  validateFileType,
};
