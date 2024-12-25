import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Paper,
} from '@mui/material';

function SupplierSelect({
  suppliers,
  selectedSupplierId,
  onChange,
  error,
}) {
  if (!suppliers || suppliers.length === 0) {
    return (
      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
        <Typography color="error" align="center">
          No suppliers available. Please add suppliers first.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ minWidth: 200 }}>
      <FormControl fullWidth error={!!error}>
        <InputLabel id="supplier-select-label">Select Supplier</InputLabel>
        <Select
          labelId="supplier-select-label"
          value={selectedSupplierId}
          label="Select Supplier"
          onChange={(e) => onChange(e.target.value)}
        >
          {suppliers.map((supplier) => (
            <MenuItem 
              key={supplier.supplier_id} 
              value={supplier.supplier_id}
            >
              {supplier.name}
            </MenuItem>
          ))}
        </Select>
        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </FormControl>
      {selectedSupplierId && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Selected: {suppliers.find(s => s.supplier_id === selectedSupplierId)?.name}
        </Typography>
      )}
    </Box>
  );
}

export default SupplierSelect;