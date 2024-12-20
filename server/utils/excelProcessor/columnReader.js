const XLSX = require('xlsx');
const debug = require('../debug');
const fs = require('fs');
const path = require('path');

function getExcelColumns(filePath) {
    debug.log('Reading Excel columns from:', filePath);
    
    try {
        // Check if file exists and is accessible
        if (!fs.existsSync(filePath)) {
            debug.error('File not found:', filePath);
            throw new Error('File not found or not accessible');
        }

        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            debug.error('Empty file:', filePath);
            throw new Error('The Excel file is empty');
        }

        // Check file extension
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            debug.error('Invalid file extension:', ext);
            throw new Error('Invalid file type. Only .xlsx and .xls files are supported');
        }

        try {
            const workbook = XLSX.readFile(filePath, {
                cellDates: true,
                cellNF: false,
                cellText: false,
                raw: true // Add raw option to get unformatted values
            });

            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                debug.error('No sheets found in workbook');
                throw new Error('The Excel file contains no sheets');
            }

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            if (!firstSheet) {
                debug.error('First sheet is empty');
                throw new Error('The first sheet in the Excel file is empty');
            }

            // Get the range of the sheet
            if (!firstSheet['!ref']) {
                debug.error('Sheet has no data range');
                throw new Error('The Excel sheet contains no data');
            }

            const range = XLSX.utils.decode_range(firstSheet['!ref']);
            const columns = [];
            
            // Read column headers (first row)
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                const cell = firstSheet[cellAddress];
                
                // Enhanced debugging for each cell
                if (cell && cell.v != null) {
                    const headerValue = String(cell.v).trim();
                    if (headerValue) {
                        // Log detailed information about the header
                        debug.log('Column header details:', {
                            column: col,
                            rawValue: cell.v,
                            trimmedValue: headerValue,
                            charCodes: Array.from(headerValue).map(char => ({
                                char,
                                code: char.charCodeAt(0)
                            }))
                        });
                        columns.push(headerValue);
                    }
                }
            }

            // Validate columns
            if (columns.length === 0) {
                debug.error('No valid columns found');
                throw new Error('No valid columns found in the Excel file. Please ensure the first row contains column headers.');
            }

            debug.log('Found Excel columns:', {
                count: columns.length,
                headers: columns,
                // Log detailed information about specific Hebrew headers
                hebrewHeaders: columns
                    .filter(col => /[\u0590-\u05FF]/.test(col)) // Filter Hebrew characters
                    .map(col => ({
                        value: col,
                        length: col.length,
                        charCodes: Array.from(col).map(char => ({
                            char,
                            code: char.charCodeAt(0)
                        }))
                    }))
            });

            return columns;
        } catch (xlsxError) {
            debug.error('Error parsing Excel file:', xlsxError);
            throw new Error(`Failed to parse Excel file: ${xlsxError.message}`);
        }
    } catch (error) {
        debug.error('Error reading Excel file:', error);
        throw new Error(`Failed to read Excel file: ${error.message}`);
    }
}

function validateColumnHeaders(columns) {
    if (!Array.isArray(columns)) {
        throw new Error('Invalid columns data structure');
    }

    const validColumns = columns.filter(col => 
        col && 
        typeof col === 'string' && 
        col.trim().length > 0
    );

    if (validColumns.length === 0) {
        throw new Error('No valid column headers found');
    }

    if (validColumns.length !== columns.length) {
        debug.log('Some invalid columns were filtered out:', {
            original: columns,
            valid: validColumns
        });
    }

    return validColumns;
}

module.exports = {
    getExcelColumns,
    validateColumnHeaders
};
