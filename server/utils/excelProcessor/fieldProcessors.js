const debug = require('../debug');

/**
 * Base class for field processors
 */
class FieldProcessor {
  validate(value, rowIndex) {
    if (this.isRequired && !value) {
      throw new Error(`Missing required field: ${this.fieldName} in row ${rowIndex + 2}`);
    }
  }

  process(value) {
    return String(value).trim();
  }
}

/**
 * Processor for item ID fields
 */
class ItemIdProcessor extends FieldProcessor {
  constructor() {
    super();
    this.fieldName = 'item_id';
    this.isRequired = true;
  }

  async process(value, { model, processedRow, itemIdCounts, itemIdFirstIndex, index }) {
    this.validate(value, index);
    
    const processedValue = String(value).trim();
    processedRow.item_id = processedValue;
    processedRow.original_item_id = processedValue;

    // Track duplicates
    itemIdCounts[processedValue] = (itemIdCounts[processedValue] || 0) + 1;
    if (itemIdCounts[processedValue] === 1) {
      itemIdFirstIndex[processedValue] = index;
    }
    processedRow.is_duplicate = itemIdCounts[processedValue] > 1;
    if (processedRow.is_duplicate) {
      processedRow.original_row_index = itemIdFirstIndex[processedValue];
    }

    // Check references
    await this.checkReferences(processedValue, { model, processedRow });

    return processedValue;
  }

  async checkReferences(value, { model, processedRow }) {
    const referenceQuery = `
      SELECT
        rc.*,
        s.name as supplier_name
      FROM item_reference_change rc
      LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
      WHERE rc.original_item_id = ? OR rc.new_reference_id = ?
      ORDER BY rc.change_date DESC
      LIMIT 1`;
    
    const referenceResult = await model.executeQuerySingle(referenceQuery, [value, value]);
    
    if (referenceResult) {
      if (referenceResult.original_item_id === value) {
        processedRow.has_reference_change = true;
        processedRow.reference_change = Object.assign({}, {
          change_id: referenceResult.change_id,
          new_reference_id: referenceResult.new_reference_id,
          source: referenceResult.supplier_id ? 'supplier' : 'user',
          supplier_name: referenceResult.supplier_name || '',
          notes: referenceResult.notes || '',
        });
      } else {
        processedRow.is_referenced_by = true;
        processedRow.referencing_items = [Object.assign({}, {
          item_id: referenceResult.original_item_id,
          reference_change: Object.assign({}, {
            change_id: referenceResult.change_id,
            source: referenceResult.supplier_id ? 'supplier' : 'user',
            supplier_name: referenceResult.supplier_name || '',
            notes: referenceResult.notes || '',
          }),
        })];
      }
    }
  }
}

/**
 * Processor for Hebrew description fields
 */
class HebrewDescriptionProcessor extends FieldProcessor {
  constructor() {
    super();
    this.fieldName = 'hebrew_description';
    this.isRequired = true;
  }

  process(value, { processedRow, index }) {
    this.validate(value, index);
    const processedValue = String(value).trim();
    processedRow.hebrew_description = processedValue;
    return processedValue;
  }
}

/**
 * Processor for numeric fields
 */
class NumericFieldProcessor extends FieldProcessor {
  constructor(fieldName, options = {}) {
    super();
    this.fieldName = fieldName;
    this.isRequired = false;
    this.defaultValue = options.defaultValue || 0;
    this.minValue = options.minValue;
    this.maxValue = options.maxValue;
  }

  parseNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return this.defaultValue;
    }

    // If it's already a number
    if (typeof value === 'number') {
      return Math.max(0, value);
    }

    // Convert to string and clean up
    const strValue = String(value).trim();
    const cleanValue = strValue.replace(/\s/g, '').replace(/,/g, '.');
    const numValue = Number(cleanValue);

    return !isNaN(numValue) ? Math.max(0, numValue) : this.defaultValue;
  }

  process(value, { processedRow }) {
    const numericValue = this.parseNumericValue(value);
    
    if (this.minValue !== undefined && numericValue < this.minValue) {
      debug.warn(`Value ${numericValue} is below minimum ${this.minValue} for field ${this.fieldName}`);
      return this.minValue;
    }
    
    if (this.maxValue !== undefined && numericValue > this.maxValue) {
      debug.warn(`Value ${numericValue} is above maximum ${this.maxValue} for field ${this.fieldName}`);
      return this.maxValue;
    }

    processedRow[this.fieldName] = numericValue;
    return numericValue;
  }
}

/**
 * Processor for reference ID fields
 */
class ReferenceIdProcessor extends FieldProcessor {
  constructor() {
    super();
    this.fieldName = 'new_reference_id';
    this.isRequired = false;
  }

  process(value, { processedRow, columnMapping, row }) {
    if (!value) return null;

    const refId = String(value).trim();
    // Only set reference if it's different from the item_id
    if (refId !== processedRow.item_id) {
      processedRow.new_reference_id = refId;
      // If there's a notes column mapped, get the notes
      const notesCol = columnMapping.reference_notes;
      if (notesCol && row[notesCol]) {
        processedRow.reference_notes = String(row[notesCol]).trim();
      }
      // Create reference change information
      processedRow.has_reference_change = true;
      processedRow.reference_change = {
        source: 'inquiry_item',
        new_reference_id: refId,
        notes: processedRow.reference_notes || 'Replacement from Excel upload',
      };
    } else {
      debug.log(`Skipping self-reference for item ${refId}`);
    }

    return refId;
  }
}

// Export field processors
module.exports = {
  ItemIdProcessor,
  HebrewDescriptionProcessor,
  NumericFieldProcessor,
  ReferenceIdProcessor,
};