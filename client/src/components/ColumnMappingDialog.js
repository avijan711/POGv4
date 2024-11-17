import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Grid,
} from '@mui/material';

const REQUIRED_FIELDS = [
  { field: 'itemID', label: 'Item ID', description: 'Unique identifier for each item' },
  { field: 'hebrewDescription', label: 'Hebrew Description', description: 'Item description in Hebrew' },
  { field: 'requestedQty', label: 'Requested Quantity', description: 'Number of items being requested' }
];

const OPTIONAL_FIELDS = [
  { field: 'englishDescription', label: 'English Description', description: 'Item description in English' },
  { field: 'importMarkup', label: 'Import Markup', description: 'Value between 1.00 and 2.00' },
  { field: 'hsCode', label: 'HS Code', description: 'Harmonized System code' },
  { field: 'qtyInStock', label: 'Current Stock', description: 'Current quantity in stock' },
  { field: 'retailPrice', label: 'Retail Price (ILS)', description: 'Retail price in Israeli Shekels' },
  { field: 'soldThisYear', label: 'Sold This Year', description: 'Units sold in current year' },
  { field: 'soldLastYear', label: 'Sold Last Year', description: 'Units sold in previous year' },
  { field: 'newReferenceID', label: 'New Reference ID', description: 'ID of the replacement item' },
  { field: 'referenceNotes', label: 'Reference Notes', description: 'Additional reference information' }
];

function ColumnMappingDialog({ open, onClose, excelColumns, onConfirm }) {
  const [mapping, setMapping] = useState({});
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    // Try to auto-map columns based on similar names
    if (excelColumns && excelColumns.length > 0) {
      const initialMapping = {};
      const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
      
      allFields.forEach(({ field, label }) => {
        // Try to find a matching column
        const matchingColumn = excelColumns.find(col => 
          col.toLowerCase() === label.toLowerCase() ||
          col.toLowerCase().replace(/[^a-z0-9]/g, '') === label.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (matchingColumn) {
          initialMapping[field] = matchingColumn;
        }
      });
      
      setMapping(initialMapping);
    }
  }, [excelColumns]);

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
      onConfirm(mapping);
    }
  };

  const handleFieldChange = (field, value) => {
    setMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Map Excel Columns</DialogTitle>
      <DialogContent>
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
          {REQUIRED_FIELDS.map(({ field, label, description }) => (
            <Grid item xs={12} sm={6} key={field}>
              <FormControl fullWidth>
                <InputLabel>{label}</InputLabel>
                <Select
                  value={mapping[field] || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  label={label}
                  required
                >
                  <MenuItem value="">
                    <em>Select column</em>
                  </MenuItem>
                  {excelColumns.map((column, index) => (
                    <MenuItem key={`${column}-${index}`} value={column}>
                      {column}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="textSecondary">
                  {description}
                </Typography>
              </FormControl>
            </Grid>
          ))}
        </Grid>

        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          Optional Fields
        </Typography>
        <Grid container spacing={2}>
          {OPTIONAL_FIELDS.map(({ field, label, description }) => (
            <Grid item xs={12} sm={6} key={field}>
              <FormControl fullWidth>
                <InputLabel>{label}</InputLabel>
                <Select
                  value={mapping[field] || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  label={label}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {excelColumns.map((column, index) => (
                    <MenuItem key={`${column}-${index}`} value={column}>
                      {column}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="textSecondary">
                  {description}
                </Typography>
              </FormControl>
            </Grid>
          ))}
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
