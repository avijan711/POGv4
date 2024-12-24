import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import { LocalOffer as PromotionIcon } from '@mui/icons-material';
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

  // Format date with time
  const formatDate = (dateString) => {
    if (!dateString) return 'No End Date';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Calculate days remaining or days until start
  const getDateStatus = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    if (now < start) {
      const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
      return `Starts in ${days} day${days !== 1 ? 's' : ''}`;
    }

    if (end && now <= end) {
      const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return `${days} day${days !== 1 ? 's' : ''} remaining`;
    }

    if (end && now > end) {
      const days = Math.ceil((now - end) / (1000 * 60 * 60 * 24));
      return `Ended ${days} day${days !== 1 ? 's' : ''} ago`;
    }

    return 'No end date';
  };

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Supplier</TableCell>
          <TableCell>Promotion Name</TableCell>
          <TableCell>Start Date</TableCell>
          <TableCell>End Date</TableCell>
          <TableCell align="right">Price (EUR)</TableCell>
          <TableCell align="right">Items</TableCell>
          <TableCell>Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {promotions.map((promo, index) => {
          const active = isActive(promo.startDate, promo.endDate);
          const dateStatus = getDateStatus(promo.startDate, promo.endDate);
          
          return (
            <TableRow 
              key={index}
              sx={{ 
                backgroundColor: 'rgba(156, 39, 176, 0.08)',
                '&:hover': {
                  backgroundColor: 'rgba(156, 39, 176, 0.12)',
                },
              }}
            >
              <TableCell>{promo.supplierName}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PromotionIcon 
                    fontSize="small" 
                    sx={{ color: 'secondary.main' }}
                  />
                  {promo.name}
                </Box>
              </TableCell>
              <TableCell>
                <Tooltip title={formatDate(promo.startDate)}>
                  <span>{new Date(promo.startDate).toLocaleDateString()}</span>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip title={promo.endDate ? formatDate(promo.endDate) : 'No End Date'}>
                  <span>
                    {promo.endDate ? new Date(promo.endDate).toLocaleDateString() : 'No End Date'}
                  </span>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                {formatEurPrice(promo.price) || (
                  <Typography variant="body2" color="error">
                    No Price
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                {promo.itemCount || 0}
              </TableCell>
              <TableCell>
                <Tooltip title={dateStatus}>
                  <Chip 
                    label={active ? 'Active' : 'Inactive'} 
                    color={active ? 'secondary' : 'default'} 
                    size="small"
                    sx={{ 
                      backgroundColor: active ? 'rgba(156, 39, 176, 0.1)' : undefined,
                      '& .MuiChip-label': {
                        fontWeight: active ? 500 : 400,
                      },
                    }}
                  />
                </Tooltip>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default PromotionsPanel;
