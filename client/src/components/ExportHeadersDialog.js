import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Box,
  Divider,
} from '@mui/material';

const AVAILABLE_HEADERS = [
  { key: 'item_id', label: 'Item ID' },
  { key: 'hebrew_description', label: 'Hebrew Description' },
  { key: 'english_description', label: 'English Description' },
  { key: 'requested_qty', label: 'Requested Quantity' },
  { key: 'import_markup', label: 'Import Markup' },
  { key: 'hs_code', label: 'HS Code' },
  { key: 'origin', label: 'Origin' },
  { key: 'reference_notes', label: 'Reference Notes' },
  { key: 'retail_price', label: 'Retail Price (ILS)' },
  { key: 'stock', label: 'Stock' },
  { key: 'sold_this_year', label: 'Sold This Year' },
  { key: 'sold_last_year', label: 'Sold Last Year' },
  { key: 'reference', label: 'Reference' }
];

function ExportHeadersDialog({ open, onClose, onConfirm }) {
  const [selectedHeaders, setSelectedHeaders] = useState(
    AVAILABLE_HEADERS.reduce((acc, header) => ({ ...acc, [header.key]: false }), {})
  );

  const handleToggleHeader = (key) => {
    setSelectedHeaders(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToggleAll = () => {
    const allSelected = AVAILABLE_HEADERS.every(header => selectedHeaders[header.key]);
    const newValue = !allSelected;
    setSelectedHeaders(
      AVAILABLE_HEADERS.reduce((acc, header) => ({
        ...acc,
        [header.key]: newValue
      }), {})
    );
  };

  const handleConfirm = () => {
    const headers = Object.entries(selectedHeaders)
      .filter(([_, selected]) => selected)
      .map(([key]) => key);
    onConfirm(headers);
  };

  const allSelected = AVAILABLE_HEADERS.every(header => selectedHeaders[header.key]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Export Headers</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  onChange={handleToggleAll}
                  indeterminate={!allSelected && Object.values(selectedHeaders).some(Boolean)}
                />
              }
              label="Select/Deselect All"
            />
            <Divider sx={{ my: 1 }} />
            {AVAILABLE_HEADERS.map(({ key, label }) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={selectedHeaders[key]}
                    onChange={() => handleToggleHeader(key)}
                  />
                }
                label={label}
              />
            ))}
          </FormGroup>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color="primary"
          disabled={!Object.values(selectedHeaders).some(Boolean)}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ExportHeadersDialog;
