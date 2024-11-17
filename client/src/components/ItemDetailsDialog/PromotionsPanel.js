import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Box,
  Typography
} from '@mui/material';
import { formatEurPrice } from '../../utils/priceUtils';

function PromotionsPanel({ promotions }) {
  if (!promotions?.length) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="textSecondary">
          No promotions available
        </Typography>
      </Box>
    );
  }

  // Check if a promotion is currently active
  const isActive = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    return now >= start && (!end || now <= end);
  };

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Start Date</TableCell>
          <TableCell>End Date</TableCell>
          <TableCell align="right">Price (EUR)</TableCell>
          <TableCell>Notes</TableCell>
          <TableCell>Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {promotions.map((promo, index) => {
          const active = isActive(promo.startDate, promo.endDate);
          return (
            <TableRow 
              key={index}
              sx={active ? { backgroundColor: 'rgba(76, 175, 80, 0.08)' } : {}}
            >
              <TableCell>{new Date(promo.startDate).toLocaleDateString()}</TableCell>
              <TableCell>
                {promo.endDate ? new Date(promo.endDate).toLocaleDateString() : 'No End Date'}
              </TableCell>
              <TableCell align="right">
                {formatEurPrice(promo.price) || (
                  <Typography variant="body2" color="error">
                    No Price
                  </Typography>
                )}
              </TableCell>
              <TableCell>{promo.notes || '-'}</TableCell>
              <TableCell>
                <Chip 
                  label={active ? 'Active' : 'Inactive'} 
                  color={active ? 'success' : 'default'} 
                  size="small"
                  sx={{ 
                    backgroundColor: active ? 'rgba(76, 175, 80, 0.1)' : undefined,
                    '& .MuiChip-label': {
                      fontWeight: active ? 500 : 400
                    }
                  }}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default PromotionsPanel;
