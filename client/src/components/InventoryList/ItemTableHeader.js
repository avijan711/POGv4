import React from 'react';
import {
  TableHead,
  TableRow,
  TableCell,
} from '@mui/material';

function ItemTableHeader() {
  return (
    <TableHead>
      <TableRow>
        <TableCell sx={{ width: '8%' }}>Item ID</TableCell>
        <TableCell sx={{ width: '15%' }}>Hebrew Description</TableCell>
        <TableCell sx={{ width: '15%' }}>English Description</TableCell>
        <TableCell align="right" sx={{ width: '7%' }}>Import Markup</TableCell>
        <TableCell sx={{ width: '7%' }}>HS Code</TableCell>
        <TableCell sx={{ width: '7%' }}>Origin</TableCell>
        <TableCell sx={{ width: '7%' }}>Image</TableCell>
        <TableCell align="right" sx={{ width: '6%' }}>Stock</TableCell>
        <TableCell align="right" sx={{ width: '7%' }}>Sold This Year</TableCell>
        <TableCell align="right" sx={{ width: '7%' }}>Sold Last Year</TableCell>
        <TableCell align="right" sx={{ width: '7%' }}>Retail Price (ILS)</TableCell>
        <TableCell sx={{ width: '10%' }}>Reference</TableCell>
        <TableCell align="center" sx={{ width: '7%' }}>Actions</TableCell>
      </TableRow>
    </TableHead>
  );
}

export default ItemTableHeader;
