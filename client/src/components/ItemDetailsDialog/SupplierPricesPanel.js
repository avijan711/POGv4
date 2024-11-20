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
  Chip
} from '@mui/material';
import { History as HistoryIcon, LocalOffer as PromotionIcon } from '@mui/icons-material';
import { formatEurPrice, formatPercentage } from '../../utils/priceUtils';

const EUR_TO_ILS = 3.95;

function SupplierPricesPanel({ supplierPrices, itemDetails, promotions }) {
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

  // Combine supplier prices with promotion prices
  const combinedPrices = useMemo(() => {
    const now = new Date();
    const result = [];

    // Add regular supplier prices
    if (supplierPrices) {
      result.push(...supplierPrices.map(price => ({
        ...price,
        isPromotion: false,
        date: price.date || price.lastUpdated
      })));
    }

    // Add active promotion prices
    if (promotions) {
      promotions.forEach(promo => {
        const startDate = new Date(promo.startDate);
        const endDate = promo.endDate ? new Date(promo.endDate) : null;
        const isActive = now >= startDate && (!endDate || now <= endDate);

        if (isActive) {
          result.push({
            supplierName: promo.supplierName,
            price: promo.price,
            date: promo.createdAt,
            isPromotion: true,
            promotionName: promo.name,
            promotionId: promo.id,
            startDate: promo.startDate,
            endDate: promo.endDate
          });
        }
      });
    }

    // Sort by date, with newest first
    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [supplierPrices, promotions]);

  // Get the most recent price for each supplier
  const latestPrices = useMemo(() => {
    const priceMap = new Map();
    combinedPrices.forEach(price => {
      if (!priceMap.has(price.supplierName) || 
          new Date(price.date) > new Date(priceMap.get(price.supplierName).date)) {
        priceMap.set(price.supplierName, price);
      }
    });
    return Array.from(priceMap.values());
  }, [combinedPrices]);

  // Calculate supplier discounts and find the best supplier
  const getSupplierDiscounts = () => {
    const discounts = {};
    latestPrices.forEach(price => {
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

  // Get price history for a supplier
  const getSupplierPriceHistory = (supplierName) => {
    return combinedPrices
      .filter(price => price.supplierName === supplierName)
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
              parseFloat(itemDetails?.importMarkup),
              parseFloat(itemDetails?.retailPrice)
            );
            const isBestSupplier = price.supplierName === bestSupplier;
            
            return (
              <TableRow 
                key={index}
                sx={price.isPromotion ? { 
                  backgroundColor: 'rgba(156, 39, 176, 0.08)'
                } : isBestSupplier ? { 
                  backgroundColor: 'rgba(76, 175, 80, 0.08)' 
                } : undefined}
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
                <TableCell>
                  {price.isPromotion ? (
                    <Chip
                      icon={<PromotionIcon />}
                      label={price.promotionName}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ 
                        height: 24,
                        '& .MuiChip-label': { px: 1 },
                        '& .MuiChip-icon': { fontSize: 16 }
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
                <TableCell>Source</TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getSupplierPriceHistory(selectedSupplier)?.map((price, index) => (
                <TableRow 
                  key={index}
                  sx={price.isPromotion ? { 
                    backgroundColor: 'rgba(156, 39, 176, 0.08)'
                  } : undefined}
                >
                  <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    {formatEurPrice(price.price) || (
                      <Typography variant="body2" color="error">
                        No Price
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {price.isPromotion ? (
                      <Chip
                        icon={<PromotionIcon />}
                        label={price.promotionName}
                        size="small"
                        color="secondary"
                        variant="outlined"
                        sx={{ 
                          height: 24,
                          '& .MuiChip-label': { px: 1 },
                          '& .MuiChip-icon': { fontSize: 16 }
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
