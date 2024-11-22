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

const REQUIRED_FIELDS = [
  { field: 'itemID', label: 'Item ID', description: 'Unique identifier for each item', hebrewLabels: ['קוד פריט', 'מספר פריט'] },
  { field: 'HebrewDescription', label: 'Hebrew Description', description: 'Item description in Hebrew', hebrewLabels: ['שם פריט'] },
  { field: 'RequestedQty', label: 'Requested Quantity', description: 'Number of items being requested', hebrewLabels: ['כמות', 'כמות שהוזמנה'] }
];

const OPTIONAL_FIELDS = [
  { field: 'EnglishDescription', label: 'English Description', description: 'Item description in English' },
  { field: 'ImportMarkup', label: 'Import Markup', description: 'Value between 1.00 and 2.00', hebrewLabels: ['% מס'] },
  { field: 'HSCode', label: 'HS Code', description: 'Harmonized System code', hebrewLabels: ['קוד יצרן'] },
  { field: 'QtyInStock', label: 'Current Stock', description: 'Current quantity in stock', hebrewLabels: ['כמות במלאי'] },
  { field: 'RetailPrice', label: 'Retail Price (ILS)', description: 'Retail price in Israeli Shekels', hebrewLabels: ['מחירון'] },
  { field: 'QtySoldThisYear', label: 'Sold This Year', description: 'Units sold in current year', hebrewLabels: ['כמות שנמכרה'] },
  { field: 'QtySoldLastYear', label: 'Sold Last Year', description: 'Units sold in previous year', hebrewLabels: ['כמות נמכרה ש'] },
  { field: 'NewReferenceID', label: 'New Reference ID', description: 'ID of the replacement item' },
  { field: 'ReferenceNotes', label: 'Reference Notes', description: 'Additional reference information' }
];

function ColumnMappingDialog({ open, onClose, excelColumns = [], onConfirm }) {
  const [mapping, setMapping] = useState({});
  const [errors, setErrors] = useState([]);

  // Process Excel columns once
  const processedColumns = React.useMemo(() => {
    return excelColumns
      .filter(col => col != null)
      .map((col, index) => ({
        id: `col-${index}`,
        value: String(col).trim()
      }))
      .filter(col => col.value.length > 0);
  }, [excelColumns]);

  useEffect(() => {
    // Try to auto-map columns based on similar names
    if (processedColumns.length > 0) {
      const initialMapping = {};
      const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
      
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
  }, [processedColumns]);

  const validateMapping = () => {
    const newErrors = [];
    
    // Check required fields
    REQUIRED_FIELDS.forEach(({ field, label }) => {
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
          {REQUIRED_FIELDS.map(field => renderField({ ...field, required: true }))}
        </Grid>

        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          Optional Fields
        </Typography>
        <Grid container spacing={2}>
          {OPTIONAL_FIELDS.map(field => renderField({ ...field }))}
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
