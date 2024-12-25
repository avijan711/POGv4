import React from 'react';
import {
  TextField,
  Box,
} from '@mui/material';

function DetailsTab({ item, onSubmit }) {
  return (
    <Box
      component="form"
      id="item-details-form"
      onSubmit={onSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <TextField
        name="item_id"
        label="Item ID"
        value={item?.item_id || ''}
        InputProps={{ readOnly: true }}
      />
      <TextField
        name="hebrew_description"
        label="Hebrew Description"
        value={item?.hebrew_description || ''}
        multiline
        rows={2}
        InputProps={{ readOnly: true }}
      />
      <TextField
        name="english_description"
        label="English Description"
        value={item?.english_description || ''}
        multiline
        rows={2}
        InputProps={{ readOnly: true }}
      />
      <TextField
        name="import_markup"
        label="Import Markup"
        type="number"
        value={item?.import_markup || ''}
        inputProps={{ 
          step: '0.01',
          min: '0',
        }}
        required
      />
      <TextField
        name="hs_code"
        label="HS Code"
        value={item?.hs_code || ''}
      />
      <TextField
        name="qty_in_stock"
        label="Stock"
        type="number"
        value={item?.qty_in_stock || ''}
        inputProps={{ min: '0' }}
        required
      />
    </Box>
  );
}

export default DetailsTab;