import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Box,
  Typography,
  Popover
} from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import { formatEurPrice, formatPercentage } from '../../utils/priceUtils';

const EUR_TO_ILS = 3.95;

function SupplierPricesPanel({ supplierPrices, itemDetails }) {
  const [historyAnchorEl, setHistoryAnchorEl] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const handleHistoryClick = (event, supplier) => {
    setHistoryAnchorEl(event.currentTarget);
    setSelectedSupplier(supplier);
  };

  const handleHistoryClose = () => {
    setHistoryAnchorEl(null);
    setSelectedSupplier(null);
  };

  // Calculate supplier discounts and find the best supplier
  const getSupplierDiscounts = () => {
    const discounts = {};
    supplierPrices?.forEach(price => {
      const discount = calculateDiscount(
        price.price,
        parseFloat(itemDetails?.importMarkup),
        parseFloat(itemDetails?.retailPrice)
      );
      if (discount !== null && (!discounts[price.supplierName] || discount > discounts[price.supplierName])) {
        discounts[price.supplierName] = discount;
      }
    });
    return discounts;
  };

  const calculateDiscount = (priceEUR, importMarkup, retailPriceILS) => {
    if (!retailPriceILS || !priceEUR || !importMarkup) return null;
    const supplierPriceILS = priceEUR * EUR_TO_ILS * importMarkup;
    const discount = ((retailPriceILS - supplierPriceILS) / retailPriceILS) * 100;
    return Math.max(0, Math.min(100, discount));
  };

  // Get price history for a supplier and calculate changes
  const getSupplierPriceHistory = (supplierName) => {
    const history = supplierPrices
      ?.filter(price => price.supplierName === supplierName)
      .sort((a, b) => new Date(b.date) - new Date(a.date)) || [];

    return history.map((price, index) => {
      if (index === history.length - 1) {
        return { ...price, change: null }; // No change for the oldest price
      }
      const nextPrice = history[index + 1];
      const change = nextPrice.price ? ((price.price - nextPrice.price) / nextPrice.price) : null;
      return { ...price, change };
    });
  };

  // Calculate changes between consecutive prices for each supplier
  const supplierPricesWithChanges = supplierPrices?.map((price, index, arr) => {
    const prevPrice = arr.find(p => 
      p.supplierName === price.supplierName && 
      new Date(p.date) < new Date(price.date)
    );
    const change = prevPrice?.price ? ((price.price - prevPrice.price) / prevPrice.price) : null;
    return { ...price, change };
  });

  const supplierDiscounts = getSupplierDiscounts();
  const sortedDiscounts = Object.entries(supplierDiscounts)
    .sort(([, a], [, b]) => b - a);
  const bestSupplier = sortedDiscounts[0]?.[0];
  const delta = sortedDiscounts[0] && sortedDiscounts[1] ? 
    (sortedDiscounts[0][1] - sortedDiscounts[1][1]).toFixed(1) : null;

  if (!supplierPrices?.length) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="textSecondary">
          No supplier prices available
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Supplier</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">Price (EUR)</TableCell>
            <TableCell>Notes</TableCell>
            <TableCell align="right">Change</TableCell>
            <TableCell align="right">Discount</TableCell>
            <TableCell align="right">Delta</TableCell>
            <TableCell align="center">History</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {supplierPricesWithChanges.map((price, index) => {
            const discount = calculateDiscount(
              price.price,
              parseFloat(itemDetails?.importMarkup),
              parseFloat(itemDetails?.retailPrice)
            );
            const isBestSupplier = price.supplierName === bestSupplier;
            
            return (
              <TableRow 
                key={index}
                sx={isBestSupplier ? { backgroundColor: 'rgba(76, 175, 80, 0.08)' } : {}}
              >
                <TableCell>{price.supplierName}</TableCell>
                <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  {formatEurPrice(price.price) || (
                    <Typography variant="body2" color="error">
                      No Price
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{price.notes || '-'}</TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    color: price.change > 0 ? 'success.main' : 
                           price.change < 0 ? 'error.main' : 'text.primary'
                  }}
                >
                  {price.change !== null ? formatPercentage(price.change) : '-'}
                </TableCell>
                <TableCell align="right">
                  {discount !== null ? `${discount.toFixed(1)}%` : '-'}
                </TableCell>
                <TableCell align="right">
                  {isBestSupplier && delta ? `${delta}%` : '-'}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={(e) => handleHistoryClick(e, price.supplierName)}
                    title="View price history"
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      <Popover
        open={Boolean(historyAnchorEl)}
        anchorEl={historyAnchorEl}
        onClose={handleHistoryClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 400 }}>
          <Typography variant="h6" gutterBottom>
            Price History - {selectedSupplier}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Price (EUR)</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getSupplierPriceHistory(selectedSupplier)?.map((price, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    {formatEurPrice(price.price) || (
                      <Typography variant="body2" color="error">
                        No Price
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{price.notes || '-'}</TableCell>
                  <TableCell 
                    align="right"
                    sx={{ 
                      color: price.change > 0 ? 'success.main' : 
                             price.change < 0 ? 'error.main' : 'text.primary'
                    }}
                  >
                    {price.change !== null ? formatPercentage(price.change) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Popover>
    </>
  );
}

export default SupplierPricesPanel;
