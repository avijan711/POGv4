import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Box
} from '@mui/material';
import { formatIlsPrice, formatPercentage } from '../../utils/priceUtils';

function PriceHistoryPanel({ priceHistory }) {
  if (!priceHistory?.length) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="textSecondary">
          No price history available
        </Typography>
      </Box>
    );
  }

  // Calculate price changes between consecutive entries
  const historyWithChanges = priceHistory.map((price, index) => {
    if (index === priceHistory.length - 1) {
      return { ...price, change: null }; // No change for the oldest price
    }
    const nextPrice = priceHistory[index + 1];
    const change = nextPrice.price ? ((price.price - nextPrice.price) / nextPrice.price) : null;
    return { ...price, change };
  });

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell align="right">Price</TableCell>
          <TableCell align="right">Stock</TableCell>
          <TableCell align="right">Change</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {historyWithChanges.map((entry, index) => (
          <TableRow key={index}>
            <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
            <TableCell align="right">
              {formatIlsPrice(entry.price) || (
                <Typography variant="body2" color="error">
                  No Price
                </Typography>
              )}
            </TableCell>
            <TableCell align="right">
              {entry.qtyInStock}
            </TableCell>
            <TableCell 
              align="right"
              sx={{ 
                color: entry.change > 0 ? 'success.main' : 
                       entry.change < 0 ? 'error.main' : 'text.primary'
              }}
            >
              {entry.change !== null ? formatPercentage(entry.change) : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default PriceHistoryPanel;
