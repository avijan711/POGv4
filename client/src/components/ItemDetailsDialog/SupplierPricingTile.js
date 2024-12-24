import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  LocalOffer as LocalOfferIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  History as HistoryIcon,
  FilterList as FilterListIcon,
  Settings as SettingsIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useSettings } from '../../hooks/useSettings';
import ExchangeRateDialog from './ExchangeRateDialog';

function formatPrice(price, currency = 'ILS') {
  if (price === null || price === undefined) return '-';
  return currency === 'EUR' 
    ? `€${Number(price).toFixed(2)}`
    : `₪${Number(price).toFixed(2)}`;
}

function formatDate(date) {
  if (!date) return '';
  try {
    return format(new Date(date), 'dd/MM/yyyy');
  } catch (err) {
    console.error('Error formatting date:', err);
    return date;
  }
}

function formatDiscount(discount) {
  if (discount === null || discount === undefined) return '-';
  return `${Number(discount).toFixed(1)}%`;
}

export default function SupplierPricingTile({ 
  item,
  supplierPrices = [],
  suppliers = [],
  onLoadMore,
  hasMore = false,
  loading = false,
  onUpdateFilters,
  filters = {},
}) {
  const [showExchangeRate, setShowExchangeRate] = useState(false);
  const { settings, getSettingValue } = useSettings();
  const eurIlsRate = getSettingValue('eur_ils_rate', 3.75);

  const handleCopyItemId = async () => {
    try {
      await navigator.clipboard.writeText(item.item_id);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Validate and sort supplier prices
  const validSupplierPrices = React.useMemo(() => {
    if (!Array.isArray(supplierPrices)) {
      console.error('Invalid supplier prices:', supplierPrices);
      return [];
    }

    return supplierPrices
      .filter(price => 
        price && 
                typeof price === 'object' &&
                price.supplier_name &&
                typeof price.supplier_name === 'string' &&
                'price_eur' in price &&
                typeof price.price_eur === 'number',
      )
      .map(price => ({
        ...price,
        date: price.date || new Date().toISOString(),
        discount_percentage: price.discount_percentage || 0,
        cost_ils: price.cost_ils || 0,
        is_promotion: !!price.is_promotion,
        promotion_name: price.promotion_name || null,
        status: price.status || 'active',
      }));
  }, [supplierPrices]);

  const bestPrice = validSupplierPrices[0]; // Already sorted by discount on server

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="div">
            {item.item_id}
          </Typography>
          <Tooltip title="Copy Item ID">
            <IconButton size="small" onClick={handleCopyItemId}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1}>
          {/* Exchange Rate Button */}
          <Tooltip title="Update Exchange Rate">
            <IconButton 
              size="small"
              onClick={() => setShowExchangeRate(true)}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          {/* Date Filter */}
          <TextField
            type="date"
            size="small"
            label="From Date"
            value={filters.fromDate || ''}
            onChange={(e) => onUpdateFilters({ fromDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          {/* Supplier Filter */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Supplier</InputLabel>
            <Select
              value={filters.supplierId || ''}
              label="Supplier"
              onChange={(e) => onUpdateFilters({ supplierId: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              {suppliers.map(supplier => (
                <MenuItem key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {/* Exchange Rate Info */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
                    Current Exchange Rate: €1 = ₪{eurIlsRate.toFixed(2)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
                    Last Updated: {settings.eur_ils_rate?.updatedAt ? 
            format(new Date(settings.eur_ils_rate.updatedAt), 'dd/MM/yyyy HH:mm') : 
            'Never'}
        </Typography>
      </Box>

      {/* Best Price Summary */}
      {bestPrice && (
        <Box sx={{ 
          mb: 2, 
          p: 2, 
          bgcolor: 'success.light',
          borderRadius: 1,
          color: 'success.contrastText',
        }}>
          <Typography variant="subtitle2" gutterBottom>
                        Best Price
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6">
              {formatPrice(bestPrice.price_eur, 'EUR')}
            </Typography>
            <Chip 
              icon={<TrendingUpIcon />}
              label={formatDiscount(bestPrice.discount_percentage)}
              color="success"
              variant="filled"
            />
            <Typography>
                            from {bestPrice.supplier_name}
              {bestPrice.is_promotion && ' (Promotion)'}
            </Typography>
            <Typography variant="body2">
                            on {formatDate(bestPrice.date)}
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Prices Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Supplier</TableCell>
              <TableCell align="right">Price (EUR)</TableCell>
              <TableCell align="right">Cost (ILS)</TableCell>
              <TableCell align="right">Discount</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {validSupplierPrices.map((price, index) => (
              <TableRow 
                key={`${price.supplier_id}-${price.date}-${index}`}
                sx={price === bestPrice ? { 
                  bgcolor: 'success.light',
                  '& > *': { color: 'success.contrastText' },
                } : {}}
              >
                <TableCell>{price.supplier_name}</TableCell>
                <TableCell align="right">
                  {formatPrice(price.price_eur, 'EUR')}
                </TableCell>
                <TableCell align="right">
                  {formatPrice(price.cost_ils)}
                </TableCell>
                <TableCell align="right">
                  <Chip
                    size="small"
                    label={formatDiscount(price.discount_percentage)}
                    color={price === bestPrice ? 'success' : 'default'}
                    variant={price === bestPrice ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>
                  {price.is_promotion ? (
                    <Chip
                      size="small"
                      icon={<LocalOfferIcon />}
                      label={price.promotion_name || 'Promotion'}
                      color="secondary"
                    />
                  ) : 'Regular'}
                </TableCell>
                <TableCell>{formatDate(price.date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Load More Button */}
      {hasMore && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            onClick={onLoadMore}
            startIcon={loading ? <CircularProgress size={20} /> : <HistoryIcon />}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </Box>
      )}

      {/* Exchange Rate Dialog */}
      <ExchangeRateDialog
        open={showExchangeRate}
        onClose={() => setShowExchangeRate(false)}
      />
    </Paper>
  );
}
