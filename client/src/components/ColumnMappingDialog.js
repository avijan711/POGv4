import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Grid,
} from '@mui/material';

const SUPPLIER_RESPONSE_REQUIRED_FIELDS = [
  { field: 'item_id', label: 'Item ID', description: 'Unique identifier for each item', hebrewLabels: ['קוד פריט', 'מספר פריט'] },
  { field: 'price_quoted', label: 'Price', description: 'Price quoted by supplier', hebrewLabels: ['מחיר', 'מחירון'] }
];

const SUPPLIER_RESPONSE_OPTIONAL_FIELDS = [
  { field: 'hebrew_description', label: 'Hebrew Description', description: 'Item description in Hebrew', hebrewLabels: ['שם פריט'] },
  { field: 'english_description', label: 'English Description', description: 'Item description in English' },
  { field: 'hs_code', label: 'HS Code', description: 'Harmonized System code', hebrewLabels: ['קוד יצרן'] },
  { field: 'new_reference_id', label: 'New Reference ID', description: 'ID of the replacement item' },
  { field: 'notes', label: 'Notes', description: 'Additional notes', hebrewLabels: ['הערות'] },
  { field: 'origin', label: 'Origin', description: 'Item origin or source', hebrewLabels: ['מקור', 'ארץ מקור'] }
];

const INVENTORY_REQUIRED_FIELDS = [
  { field: 'item_id', label: 'Item ID', description: 'Unique identifier for each item', hebrewLabels: ['קוד פריט', 'מספר פריט'] },
  { field: 'hebrew_description', label: 'Hebrew Description', description: 'Item description in Hebrew', hebrewLabels: ['שם פריט'] },
  { field: 'requested_qty', label: 'Requested Quantity', description: 'Number of items being requested', hebrewLabels: ['כמות', 'כמות שהוזמנה'] }
];

const INVENTORY_OPTIONAL_FIELDS = [
  { field: 'english_description', label: 'English Description', description: 'Item description in English' },
  { field: 'import_markup', label: 'Import Markup', description: 'Value between 1.00 and 2.00', hebrewLabels: ['% מס'] },
  { field: 'hs_code', label: 'HS Code', description: 'Harmonized System code', hebrewLabels: ['קוד יצרן'] },
  { field: 'qty_in_stock', label: 'Current Stock', description: 'Current quantity in stock', hebrewLabels: ['כמות במלאי'] },
  { field: 'retail_price', label: 'Retail Price (ILS)', description: 'Retail price in Israeli Shekels', hebrewLabels: ['מחירון'] },
  { field: 'sold_this_year', label: 'Sold This Year', description: 'Units sold in current year', hebrewLabels: ['כמות שנמכרה'] },
  { field: 'sold_last_year', label: 'Sold Last Year', description: 'Units sold in previous year', hebrewLabels: ['כמות נמכרה ש'] },
  { field: 'new_reference_id', label: 'New Reference ID', description: 'ID of the replacement item' },
  { field: 'reference_notes', label: 'Reference Notes', description: 'Additional reference information' },
  { field: 'notes', label: 'Notes', description: 'General notes about the item', hebrewLabels: ['הערות'] },
  { field: 'origin', label: 'Origin', description: 'Item origin or source', hebrewLabels: ['מקור', 'ארץ מקור'] }
];

function ColumnMappingDialog({ open, onClose, columns = [], onConfirm, uploadType = 'inventory' }) {
  const [mapping, setMapping] = useState({});
  const [errors, setErrors] = useState([]);

  const requiredFields = uploadType === 'supplier_response' 
    ? SUPPLIER_RESPONSE_REQUIRED_FIELDS 
    : INVENTORY_REQUIRED_FIELDS;

  const optionalFields = uploadType === 'supplier_response'
    ? SUPPLIER_RESPONSE_OPTIONAL_FIELDS
    : INVENTORY_OPTIONAL_FIELDS;

  // Process Excel columns once
  const processedColumns = React.useMemo(() => {
    return columns
      .filter(col => col != null)
      .map((col, index) => ({
        id: `col-${index}`,
        value: String(col).trim()
      }))
      .filter(col => col.value.length > 0);
  }, [columns]);

  useEffect(() => {
    // Try to auto-map columns based on similar names
    if (processedColumns.length > 0) {
      const initialMapping = {};
      const allFields = [...requiredFields, ...optionalFields];
      
      allFields.forEach(({ field, label, hebrewLabels }) => {
        // Try to match Hebrew labels first
        if (hebrewLabels) {
          const matchingColumn = processedColumns.find(col => 
            hebrewLabels.some(hebrewLabel => {
              const normalizedCol = col.value.trim();
              const normalizedLabel = hebrewLabel.trim();
              return normalizedCol === normalizedLabel || normalizedCol.includes(normalizedLabel);
            })
          );
          
          if (matchingColumn) {
            initialMapping[field] = matchingColumn.id;
            return;
          }
        }

        // Fall back to English label matching
        const normalizedLabel = String(label).toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchingColumn = processedColumns.find(col => {
          const normalizedCol = col.value.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedCol === normalizedLabel || normalizedCol.includes(normalizedLabel);
        });

        if (matchingColumn) {
          initialMapping[field] = matchingColumn.id;
        }
      });
      
      setMapping(initialMapping);
    }
  }, [processedColumns, requiredFields, optionalFields]);

  const validateMapping = () => {
    const newErrors = [];
    
    // Check required fields
    requiredFields.forEach(({ field, label }) => {
      if (!mapping[field]) {
        newErrors.push(`${label} is required`);
      }
    });
    
    // Check for duplicate mappings
    const usedColumns = Object.values(mapping).filter(Boolean);
    const duplicates = usedColumns.filter((col, index) => usedColumns.indexOf(col) !== index);
    if (duplicates.length > 0) {
      newErrors.push(`Duplicate mappings found: ${duplicates.join(', ')}`);
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleConfirm = () => {
    if (validateMapping()) {
      // Convert column IDs back to values for the final mapping
      const finalMapping = {};
      Object.entries(mapping).forEach(([field, columnId]) => {
        const column = processedColumns.find(col => col.id === columnId);
        if (column) {
          finalMapping[field] = column.value;
        }
      });

      // Log the mapping for debugging
      console.log('Column mapping:', {
        original: mapping,
        final: finalMapping,
        processedColumns
      });

      onConfirm(finalMapping);
    }
  };

  const handleFieldChange = (field, columnId) => {
    setMapping(prev => ({
      ...prev,
      [field]: columnId
    }));
  };

  const renderField = ({ field, label, description, hebrewLabels, required = false }) => (
    <Grid item xs={12} sm={6} key={field}>
      <FormControl fullWidth variant="outlined" size="medium">
        <InputLabel id={`${field}-label`}>{label}{required ? ' *' : ''}</InputLabel>
        <Select
          labelId={`${field}-label`}
          id={field}
          value={mapping[field] || ''}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          label={`${label}${required ? ' *' : ''}`}
          required={required}
          MenuProps={{
            PaperProps: {
              style: {
                maxHeight: 300
              }
            }
          }}
        >
          <MenuItem value="">
            <em>{required ? 'Select column' : 'None'}</em>
          </MenuItem>
          {processedColumns.map((column) => (
            <MenuItem key={column.id} value={column.id}>
              {column.value}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="textSecondary" style={{ marginTop: '4px' }}>
          {description}
          {hebrewLabels && (
            <span style={{ display: 'block', color: 'rgba(0, 0, 0, 0.6)' }}>
              Expected Hebrew: {hebrewLabels.join(' / ')}
            </span>
          )}
        </Typography>
      </FormControl>
    </Grid>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        style: {
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>Map Excel Columns</DialogTitle>
      <DialogContent dividers>
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </Alert>
        )}

        <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, color: 'error.main' }}>
          Required Fields
        </Typography>
        <Grid container spacing={2}>
          {requiredFields.map(field => renderField({ ...field, required: true }))}
        </Grid>

        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          Optional Fields
        </Typography>
        <Grid container spacing={2}>
          {optionalFields.map(field => renderField({ ...field }))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          Confirm Mapping
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ColumnMappingDialog;
