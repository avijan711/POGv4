import React, { useMemo, useState } from 'react';
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
  CircularProgress,
  Button,
  Chip,
  Grid,
  Stack,
  Tooltip,
} from '@mui/material';
import { 
  Business as BusinessIcon,
  CurrencyExchange as CurrencyExchangeIcon,
} from '@mui/icons-material';
import {
  formatEurPrice,
  formatIlsPrice,
  getMarginInfo,
  getStatusColor,
  getPriceAnalysis,
  calculateIlsPrice,
} from '../../utils/priceUtils';
import { useSettings } from '../../hooks/useSettings';
import SupplierPriceHistoryDialog from './SupplierPriceHistoryDialog';

import { EXCHANGE_RATE_KEY, DEFAULT_EXCHANGE_RATE } from '../../constants';

function SupplierPricingTile({
  item,
  supplierPrices = [],
  suppliers,
  onLoadMore,
  hasMore,
  loading,
  onUpdateFilters,
  filters,
}) {
  const { getSettingValue } = useSettings();
  const eurToIls = getSettingValue(EXCHANGE_RATE_KEY, DEFAULT_EXCHANGE_RATE);
  const [selectedPrice, setSelectedPrice] = useState(null);

  // Calculate price analysis and winning supplier
  const { priceAnalysis, winningPrice, sortedPrices } = useMemo(() => {
    // Filter and sort active prices
    const activePrices = supplierPrices
      .filter(p => p.status === 'active')
      .map(p => ({
        ...p,
        price: Number(p.price_eur || p.price_quoted || 0),
        ilsPrice: p.cost_ils || calculateIlsPrice(Number(p.price_eur || p.price_quoted || 0), item.import_markup, eurToIls),
      }))
      .filter(p => !isNaN(p.price) && p.price > 0)
      .sort((a, b) => a.price - b.price);

    if (!activePrices.length) return { 
      priceAnalysis: null, 
      winningPrice: null,
      sortedPrices: supplierPrices,
    };

    const prices = activePrices.map(p => p.price);
    const lowestPrice = Math.min(...prices);

    // Sort all prices - active first, then by price
    const sorted = [...supplierPrices].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return (Number(a.price_eur || a.price_quoted || 0)) - (Number(b.price_eur || b.price_quoted || 0));
    });

    return {
      priceAnalysis: getPriceAnalysis(prices),
      winningPrice: lowestPrice,
      sortedPrices: sorted,
    };
  }, [supplierPrices, item.import_markup, eurToIls]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!supplierPrices?.length) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          No supplier pricing available
        </Typography>
      </Box>
    );
  }

  const handlePriceClick = (price) => {
    setSelectedPrice(price);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Currency Conversion Info */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'info.lighter' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CurrencyExchangeIcon color="info" />
            <Box>
              <Typography variant="subtitle2" color="info.dark">
                Currency Conversion Rate
              </Typography>
              <Typography variant="body2" color="info.dark">
                1 EUR = ₪{eurToIls} × {item.import_markup.toFixed(2)} (Import Markup) = ₪{(eurToIls * item.import_markup).toFixed(2)}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Price Analysis Summary */}
        {priceAnalysis && (
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="subtitle1" gutterBottom>Price Analysis</Typography>
            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Lowest Price</Typography>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography variant="h6">{formatEurPrice(priceAnalysis.lowest)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    = {formatIlsPrice(calculateIlsPrice(priceAnalysis.lowest, item.import_markup, eurToIls))}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Average Price</Typography>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography variant="h6">{formatEurPrice(priceAnalysis.average)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    = {formatIlsPrice(calculateIlsPrice(priceAnalysis.average, item.import_markup, eurToIls))}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Highest Price</Typography>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography variant="h6">{formatEurPrice(priceAnalysis.highest)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    = {formatIlsPrice(calculateIlsPrice(priceAnalysis.highest, item.import_markup, eurToIls))}
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Supplier Prices Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Supplier</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell align="right">Delta</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Info</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPrices.map((price, index) => {
                const priceEur = Number(price.price_eur || price.price_quoted || 0);
                const ilsPrice = price.cost_ils || calculateIlsPrice(priceEur, item.import_markup, eurToIls);
                const isWinningPrice = priceEur === winningPrice && price.status === 'active';
                
                // Calculate delta with next supplier's discount
                const nextPrice = sortedPrices[index + 1];
                const delta = nextPrice ?
                  (price.discount_percentage - nextPrice.discount_percentage).toFixed(1) :
                  null;

                return (
                  <TableRow
                    key={`${price.supplier_id}-${price.date}-${index}`}
                    sx={{
                      ...(price.is_promotion && { bgcolor: 'warning.lighter' }),
                      ...(isWinningPrice && {
                        bgcolor: 'success.lighter',
                        '& > td': { fontWeight: 'bold' },
                      }),
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon fontSize="small" color="action" />
                        <Typography>{price.supplier_name}</Typography>
                        {isWinningPrice && (
                          <Chip
                            label="Best Price"
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        onClick={() => handlePriceClick(price)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                          },
                          p: 1,
                        }}
                      >
                        <Stack spacing={0.5}>
                          <Typography>{formatEurPrice(priceEur)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            = {formatIlsPrice(ilsPrice)}
                          </Typography>
                        </Stack>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {price.discount_percentage > 0 && (
                        <Typography color="success.main">
                          {price.discount_percentage.toFixed(1)}%
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {delta && (
                        <Typography color="info.main">
                          {delta}%
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={price.status || 'Unknown'}
                        color={getStatusColor(price.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {price.is_promotion && (
                        <Chip
                          label={price.promotion_name || 'Promotion'}
                          color="secondary"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
      
      {hasMore && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button onClick={onLoadMore} disabled={loading}>
            Load More
          </Button>
        </Box>
      )}

      {/* Price History Dialog */}
      <SupplierPriceHistoryDialog
        open={Boolean(selectedPrice)}
        onClose={() => setSelectedPrice(null)}
        itemId={item?.item_id}
        supplierId={selectedPrice?.supplier_id}
        supplierName={selectedPrice?.supplier_name}
      />
    </Box>
  );
}

export default SupplierPricingTile;
