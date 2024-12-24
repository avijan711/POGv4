import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';

function PriceHistoryTable({ data = [], loading = false, error = null }) {
  if (loading) {
    return (
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data.length) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No price history available
        </Typography>
      </Box>
    );
  }

  const formatPrice = (price) => {
    if (!price && price !== 0) return '—';
    return `₪${Number(price).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  };

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell align="right">Retail Price</TableCell>
            <TableCell align="right">Stock</TableCell>
            <TableCell align="right">Sold This Year</TableCell>
            <TableCell align="right">Sold Last Year</TableCell>
            {data[0]?.supplier_name && (
              <TableCell>Supplier</TableCell>
            )}
            {data[0]?.promotion_name && (
              <TableCell>Promotion</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((record, index) => (
            <TableRow
              key={index}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell>{formatDate(record.date)}</TableCell>
              <TableCell align="right">{formatPrice(record.retailPrice || record.price)}</TableCell>
              <TableCell align="right">{record.qtyInStock || record.stock || '—'}</TableCell>
              <TableCell align="right">{record.soldThisYear || record.sold_this_year || '—'}</TableCell>
              <TableCell align="right">{record.soldLastYear || record.sold_last_year || '—'}</TableCell>
              {data[0]?.supplier_name && (
                <TableCell>{record.supplier_name}</TableCell>
              )}
              {data[0]?.promotion_name && (
                <TableCell>{record.promotion_name || '—'}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default PriceHistoryTable;
