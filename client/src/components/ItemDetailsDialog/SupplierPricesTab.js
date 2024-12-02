import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Grid
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  RemoveCircleOutline as NoChangeIcon,
  LocalOffer as PromotionIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { formatIlsPrice } from '../../utils/priceUtils';

function SupplierPricesTab({ supplierPrices = [], itemDetails }) {
  const sortedPrices = useMemo(() => {
    return [...supplierPrices].sort((a, b) => {
      // Active prices first
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      // Then by date
      return new Date(b.date) - new Date(a.date);
    });
  }, [supplierPrices]);

  const priceAnalysis = useMemo(() => {
    const activePrices = supplierPrices.filter(p => p.status === 'active');
    if (!activePrices.length) return null;

    const prices = activePrices.map(p => p.price);
    return {
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
      average: prices.reduce((a, b) => a + b, 0) / prices.length
    };
  }, [supplierPrices]);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getPriceChangeDisplay = (change) => {
    if (!change) return null;
    
    const Icon = change > 0 ? TrendingUpIcon : 
                change < 0 ? TrendingDownIcon : 
                NoChangeIcon;
    
    const color = change > 0 ? 'error' : 
                 change < 0 ? 'success' : 
                 'action';

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Icon color={color} fontSize="small" />
        <Typography
          variant="body2"
          color={color}
          component="span"
        >
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </Typography>
      </Box>
    );
  };

  const calculateIlsPrice = (eurPrice) => {
    if (!eurPrice || !itemDetails?.importMarkup) return null;
    return eurPrice * 4.1 * itemDetails.importMarkup;
  };

  const getMarginInfo = (eurPrice) => {
    if (!eurPrice || !itemDetails?.retailPrice) return null;
    
    const costPrice = calculateIlsPrice(eurPrice);
    const margin = ((itemDetails.retailPrice - costPrice) / itemDetails.retailPrice) * 100;
    
    return {
      margin,
      color: margin < 20 ? 'error' : 
             margin < 30 ? 'warning' : 
             'success'
    };
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Price Analysis Summary */}
        {priceAnalysis && (
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="subtitle1" gutterBottom>Price Analysis</Typography>
            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Lowest Price</Typography>
                <Typography variant="h6">€{priceAnalysis.lowest.toFixed(2)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ≈ {formatIlsPrice(calculateIlsPrice(priceAnalysis.lowest))}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Average Price</Typography>
                <Typography variant="h6">€{priceAnalysis.average.toFixed(2)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ≈ {formatIlsPrice(calculateIlsPrice(priceAnalysis.average))}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Highest Price</Typography>
                <Typography variant="h6">€{priceAnalysis.highest.toFixed(2)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ≈ {formatIlsPrice(calculateIlsPrice(priceAnalysis.highest))}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Supplier Prices Table */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>Supplier Prices</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Supplier</TableCell>
                  <TableCell align="right">Price (EUR)</TableCell>
                  <TableCell align="right">Est. ILS Price</TableCell>
                  <TableCell align="right">Margin</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Change</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell>Info</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedPrices.map((price, index) => {
                  const marginInfo = getMarginInfo(price.price);
                  const ilsPrice = calculateIlsPrice(price.price);

                  return (
                    <TableRow 
                      key={index}
                      sx={price.isPromotion ? { bgcolor: 'warning.lighter' } : undefined}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {price.supplierName}
                          {price.isPromotion && (
                            <Tooltip title="Promotion Price">
                              <PromotionIcon color="warning" fontSize="small" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">€{price.price.toFixed(2)}</TableCell>
                      <TableCell align="right">{formatIlsPrice(ilsPrice)}</TableCell>
                      <TableCell align="right">
                        {marginInfo && (
                          <Typography color={`${marginInfo.color}.main`}>
                            {marginInfo.margin.toFixed(1)}%
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={price.status}
                          size="small"
                          color={getStatusColor(price.status)}
                        />
                      </TableCell>
                      <TableCell>
                        {getPriceChangeDisplay(price.change)}
                      </TableCell>
                      <TableCell>
                        {new Date(price.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {price.isPromotion && (
                          <Tooltip title={`Promotion: ${price.promotionName || 'Unnamed'}`}>
                            <IconButton size="small">
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* No Prices Message */}
        {!sortedPrices.length && (
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography color="text.secondary" align="center">
              No supplier prices available
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export default SupplierPricesTab;
