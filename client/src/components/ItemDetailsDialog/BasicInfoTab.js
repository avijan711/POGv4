import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Divider,
  Chip
} from '@mui/material';
import { formatIlsPrice } from '../../utils/priceUtils';
import { API_BASE_URL } from '../../config';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  RemoveCircleOutline as NoChangeIcon
} from '@mui/icons-material';

function BasicInfoTab({ itemDetails }) {
  if (!itemDetails) return null;

  const salesTrend = itemDetails.soldThisYear > itemDetails.soldLastYear ? 'up' :
                    itemDetails.soldThisYear < itemDetails.soldLastYear ? 'down' : 'same';

  const getTrendIcon = () => {
    switch(salesTrend) {
      case 'up': return <TrendingUpIcon color="success" />;
      case 'down': return <TrendingDownIcon color="error" />;
      default: return <NoChangeIcon color="action" />;
    }
  };

  const getSalesTrendLabel = () => {
    const diff = itemDetails.soldThisYear - itemDetails.soldLastYear;
    const percentChange = ((diff / itemDetails.soldLastYear) * 100).toFixed(1);
    return diff === 0 ? 'No Change' : 
           `${diff > 0 ? '+' : ''}${percentChange}% vs Last Year`;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Left Column - Basic Information */}
        <Grid item xs={6}>
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" color="text.secondary">Item ID</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {itemDetails.itemID}
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" color="text.secondary">Hebrew Description</Typography>
              <Typography variant="body1" dir="rtl" sx={{ mt: 1 }}>
                {itemDetails.hebrewDescription}
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" color="text.secondary">English Description</Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {itemDetails.englishDescription || 'Not specified'}
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">HS Code</Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    {itemDetails.hsCode || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Origin</Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    {itemDetails.origin || 'Not specified'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {itemDetails.notes && (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                  {itemDetails.notes}
                </Typography>
              </Paper>
            )}
          </Stack>
        </Grid>

        {/* Right Column - Numbers and Status */}
        <Grid item xs={6}>
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" color="text.secondary">Current Price</Typography>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1 }}>
                <Typography variant="h6">
                  {formatIlsPrice(itemDetails.retailPrice) || 'No Price Set'}
                </Typography>
                {itemDetails.lastPriceUpdate && (
                  <Typography variant="caption" color="text.secondary">
                    Updated: {new Date(itemDetails.lastPriceUpdate).toLocaleDateString()}
                  </Typography>
                )}
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" color="text.secondary">Import Markup</Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {itemDetails.importMarkup.toFixed(2)} ({((itemDetails.importMarkup - 1) * 100).toFixed(0)}%)
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" color="text.secondary">Stock Information</Typography>
              <Box sx={{ mt: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Current Stock</Typography>
                    <Typography variant="h6">{itemDetails.qtyInStock}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Status</Typography>
                    <Chip 
                      label={itemDetails.qtyInStock > 0 ? 'In Stock' : 'Out of Stock'}
                      color={itemDetails.qtyInStock > 0 ? 'success' : 'error'}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" color="text.secondary">Sales Information</Typography>
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">This Year</Typography>
                    <Typography variant="h6">{itemDetails.soldThisYear}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Last Year</Typography>
                    <Typography variant="h6">{itemDetails.soldLastYear}</Typography>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getTrendIcon()}
                  <Typography variant="body2" color="text.secondary">
                    {getSalesTrendLabel()}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {itemDetails.image && (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Product Image
                </Typography>
                <Box
                  component="img"
                  src={`${API_BASE_URL}/uploads/${itemDetails.image}`}
                  alt={itemDetails.itemID}
                  sx={{
                    width: '100%',
                    height: 200,
                    objectFit: 'contain',
                    mt: 1
                  }}
                />
              </Paper>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default BasicInfoTab;
