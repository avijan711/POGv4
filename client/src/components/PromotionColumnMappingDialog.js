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
  { 
    field: 'itemId', 
    label: 'Item ID', 
    description: 'Unique identifier for each item', 
    hebrewLabels: ['קוד פריט', 'מספר פריט', 'מקט'], 
  },
  { 
    field: 'price', 
    label: 'Price (EUR)', 
    description: 'Promotion price in Euros', 
    hebrewLabels: ['מחיר', 'מחיר מבצע', 'מחיר יורו'], 
  },
];

function PromotionColumnMappingDialog({ open, onClose, excelColumns = [], onConfirm }) {
  const [mapping, setMapping] = useState({});
  const [errors, setErrors] = useState([]);

  // Process Excel columns once
  const processedColumns = React.useMemo(() => {
    return excelColumns
      .filter(col => col != null)
      .map((col, index) => ({
        id: `col-${index}`,
        value: String(col).trim(),
      }))
      .filter(col => col.value.length > 0);
  }, [excelColumns]);

  useEffect(() => {
    // Try to auto-map columns based on similar names
    if (processedColumns.length > 0) {
      const initialMapping = {};
      
      REQUIRED_FIELDS.forEach(({ field, label, hebrewLabels }) => {
        // Try to match Hebrew labels first
        if (hebrewLabels) {
          const matchingColumn = processedColumns.find(col => 
            hebrewLabels.some(hebrewLabel => {
              const normalizedCol = col.value.trim().toLowerCase();
              const normalizedLabel = hebrewLabel.trim().toLowerCase();
              return normalizedCol === normalizedLabel || normalizedCol.includes(normalizedLabel);
            }),
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

      onConfirm(finalMapping);
    }
  };

  const handleFieldChange = (field, columnId) => {
    setMapping(prev => ({
      ...prev,
      [field]: columnId,
    }));
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle>Map Promotion Columns</DialogTitle>
      <DialogContent>
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </Alert>
        )}

        <Typography variant="body2" color="textSecondary" sx={{ mb: 2, mt: 1 }}>
          Please map the Excel columns to the required fields. The system will automatically detect matching columns.
        </Typography>

        <Grid container spacing={2}>
          {REQUIRED_FIELDS.map(({ field, label, description, hebrewLabels }) => (
            <Grid item xs={12} key={field}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id={`${field}-label`}>{label} *</InputLabel>
                <Select
                  labelId={`${field}-label`}
                  id={field}
                  value={mapping[field] || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  label={`${label} *`}
                  required
                >
                  <MenuItem value="">
                    <em>Select column</em>
                  </MenuItem>
                  {processedColumns.map((column) => (
                    <MenuItem key={column.id} value={column.id}>
                      {column.value}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                  {description}
                  {hebrewLabels && (
                    <span style={{ display: 'block', color: 'rgba(0, 0, 0, 0.6)' }}>
                      Expected Hebrew: {hebrewLabels.join(' / ')}
                    </span>
                  )}
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

export default PromotionColumnMappingDialog;
