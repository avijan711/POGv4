import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Box,
  Typography,
  Popover,
  Chip,
} from '@mui/material';
import { History as HistoryIcon, LocalOffer as PromotionIcon } from '@mui/icons-material';
import { formatEurPrice, formatPercentage } from '../../utils/priceUtils';

const EUR_TO_ILS = 3.95;

function SupplierPricesPanel({ supplierPrices = [], itemDetails }) {
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

  // Parse supplier prices if they're in string format
  const parsedSupplierPrices = useMemo(() => {
    if (typeof supplierPrices === 'string') {
      try {
        return JSON.parse(supplierPrices);
      } catch (e) {
        console.error('Error parsing supplier prices:', e);
        return [];
      }
    }
    return supplierPrices.map(price => ({
      supplier_name: price.supplier_name || price.supplierName,
      date: price.date || price.lastUpdated,
      price: price.price || price.priceQuoted,
      is_promotion: price.is_promotion || price.isPromotion || false,
      promotion_name: price.promotion_name || price.promotionName,
    }));
  }, [supplierPrices]);

  // Get the most recent price for each supplier
  const latestPrices = useMemo(() => {
    const priceMap = new Map();
    parsedSupplierPrices.forEach(price => {
      if (!priceMap.has(price.supplier_name) || 
          new Date(price.date) > new Date(priceMap.get(price.supplier_name).date)) {
        priceMap.set(price.supplier_name, price);
      }
    });
    return Array.from(priceMap.values());
  }, [parsedSupplierPrices]);

  // Calculate supplier discounts and find the best supplier
  const getSupplierDiscounts = () => {
    const discounts = {};
    latestPrices.forEach(price => {
      const discount = calculateDiscount(
        price.price,
        parseFloat(itemDetails?.import_markup),
        parseFloat(itemDetails?.retail_price),
      );
      if (discount !== null && (!discounts[price.supplier_name] || discount > discounts[price.supplier_name])) {
        discounts[price.supplier_name] = discount;
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

  // Get price history for a supplier
  const getSupplierPriceHistory = (supplierName) => {
    return parsedSupplierPrices
      .filter(price => price.supplier_name === supplierName)
      .map((price, index, array) => {
        if (index === array.length - 1) {
          return { ...price, change: null }; // No change for the oldest price
        }
        const nextPrice = array[index + 1];
        const change = nextPrice.price ? ((price.price - nextPrice.price) / nextPrice.price) : null;
        return { ...price, change };
      });
  };

  const supplierDiscounts = getSupplierDiscounts();
  const sortedDiscounts = Object.entries(supplierDiscounts)
    .sort(([, a], [, b]) => b - a);
  const bestSupplier = sortedDiscounts[0]?.[0];
  const delta = sortedDiscounts[0] && sortedDiscounts[1] ? 
    (sortedDiscounts[0][1] - sortedDiscounts[1][1]).toFixed(1) : null;

  if (!latestPrices?.length) {
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
            <TableCell>Source</TableCell>
            <TableCell align="right">Change</TableCell>
            <TableCell align="right">Discount</TableCell>
            <TableCell align="right">Delta</TableCell>
            <TableCell align="center">History</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {latestPrices.map((price, index) => {
            const discount = calculateDiscount(
              price.price,
              parseFloat(itemDetails?.import_markup),
              parseFloat(itemDetails?.retail_price),
            );
            const isBestSupplier = price.supplier_name === bestSupplier;
            
            return (
              <TableRow 
                key={index}
                sx={price.is_promotion ? { 
                  backgroundColor: 'rgba(156, 39, 176, 0.08)',
                } : isBestSupplier ? { 
                  backgroundColor: 'rgba(76, 175, 80, 0.08)', 
                } : undefined}
              >
                <TableCell>{price.supplier_name}</TableCell>
                <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  {formatEurPrice(price.price) || (
                    <Typography variant="body2" color="error">
                      No Price
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {price.is_promotion ? (
                    <Chip
                      icon={<PromotionIcon />}
                      label={price.promotion_name || 'Promotion'}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ 
                        height: 24,
                        '& .MuiChip-label': { px: 1 },
                        '& .MuiChip-icon': { fontSize: 16 },
                      }}
                    />
                  ) : (
                    'Regular Price'
                  )}
                </TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    color: price.change > 0 ? 'success.main' : 
                      price.change < 0 ? 'error.main' : 'text.primary',
                  }}
                >
                  {price.change !== null ? formatPercentage(price.change) : '-'}
                </TableCell>
                <TableCell align="right">
                  {discount !== null ? formatPercentage(discount) : '-'}
                </TableCell>
                <TableCell 
                  align="right"
                  sx={{ color: isBestSupplier ? 'success.main' : 'text.primary' }}
                >
                  {isBestSupplier && delta ? `+${delta}%` : '-'}
                </TableCell>
                <TableCell align="center">
                  <IconButton 
                    size="small"
                    onClick={(e) => handleHistoryClick(e, price.supplier_name)}
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
          <Typography variant="subtitle1" gutterBottom>
            Price History for {selectedSupplier}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Price (EUR)</TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedSupplier && getSupplierPriceHistory(selectedSupplier).map((price, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                  <TableCell align="right">{formatEurPrice(price.price)}</TableCell>
                  <TableCell 
                    align="right"
                    sx={{ 
                      color: price.change > 0 ? 'success.main' : 
                        price.change < 0 ? 'error.main' : 'text.primary',
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
