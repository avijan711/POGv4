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
        <TableCell>Item ID</TableCell>
        <TableCell>Hebrew Description</TableCell>
        <TableCell>English Description</TableCell>
        <TableCell align="right">Import Markup</TableCell>
        <TableCell>HS Code</TableCell>
        <TableCell>Image</TableCell>
        <TableCell align="right">Stock</TableCell>
        <TableCell align="right">Sold This Year</TableCell>
        <TableCell align="right">Sold Last Year</TableCell>
        <TableCell align="right">Retail Price (ILS)</TableCell>
        <TableCell>Reference</TableCell>
        <TableCell align="center">Actions</TableCell>
      </TableRow>
    </TableHead>
  );
}

export default ItemTableHeader;
