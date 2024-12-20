import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Link,
  Stack,
  Alert,
  Tooltip,
  Button,
  Grid
} from '@mui/material';
import {
  Store as StoreIcon,
  Person as PersonIcon,
  SwapHoriz as SwapHorizIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { formatIlsPrice } from '../../utils/priceUtils';
import { API_BASE_URL } from '../../config';

// Rest of the file content remains exactly the same
function ReplacementPanel({ 
  type, 
  mainItemId,
  connectedItemId,
  source,
  supplierName,
  changeDate,
  description,
  connectedDescription,
  onItemClick
}) {
  const getSourceIcon = () => {
    if (source === 'supplier') {
      return (
        <Tooltip title={`Changed by ${supplierName || 'supplier'}`}>
          <StoreIcon fontSize="small" color="warning" />
        </Tooltip>
      );
    }
    if (source === 'user') {
      return (
        <Tooltip title="Changed by user">
          <PersonIcon fontSize="small" color="warning" />
        </Tooltip>
      );
    }
    return null;
  };

  const isReplacement = type === 'replacement';
  
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2,
        backgroundColor: isReplacement ? '#fff3e0' : '#e8f5e9',
        border: theme => `1px solid ${isReplacement ? theme.palette.warning.light : theme.palette.success.light}`,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Pattern */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '30%',
        opacity: 0.1,
        background: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          rgba(0,0,0,0.1) 10px,
          rgba(0,0,0,0.1) 20px
        )`
      }} />

      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography 
            variant="subtitle1" 
            color={isReplacement ? "warning.dark" : "success.dark"} 
            sx={{ fontWeight: 'medium' }}
          >
            {isReplacement ? 'Replacement Information' : 'Original Item Reference'}
          </Typography>
          <SwapHorizIcon color={isReplacement ? "warning" : "success"} />
        </Stack>

        {/* Connection Visual */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 1.5,
            backgroundColor: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(0,0,0,0.1)'
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
              <Stack>
                <Button
                  variant="outlined"
                  color={isReplacement ? "warning" : "success"}
                  onClick={() => onItemClick(mainItemId)}
                  startIcon={isReplacement ? <ArrowBackIcon /> : null}
                  endIcon={!isReplacement ? <ArrowForwardIcon /> : null}
                >
                  {mainItemId}
                </Button>
                {description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, direction: 'rtl' }}>
                    {description}
                  </Typography>
                )}
              </Stack>
              <SwapHorizIcon color={isReplacement ? "warning" : "success"} />
              <Stack>
                <Button
                  variant="contained"
                  color={isReplacement ? "warning" : "success"}
                  onClick={() => onItemClick(connectedItemId)}
                  startIcon={!isReplacement ? <ArrowBackIcon /> : null}
                  endIcon={isReplacement ? <ArrowForwardIcon /> : null}
                >
                  {connectedItemId}
                </Button>
                {connectedDescription && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, direction: 'rtl' }}>
                    {connectedDescription}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Stack>
        </Paper>

        {/* Details */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip
            icon={getSourceIcon()}
            label={source === 'supplier' ? `Changed by ${supplierName || 'supplier'}` : 'Changed by user'}
            color={isReplacement ? "warning" : "success"}
            variant="outlined"
            size="small"
          />
          {changeDate && (
            <Chip
              icon={<InfoIcon />}
              label={`Changed on ${new Date(changeDate).toLocaleDateString()}`}
              color={isReplacement ? "warning" : "success"}
              variant="outlined"
              size="small"
            />
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function GeneralInfoPanel({ 
  itemDetails, 
  hasReferenceChange, 
  isReferencedBy, 
  referenceChange,
  referencingItems,
  onItemClick
}) {
  const formatImportMarkup = (markup) => {
    if (markup === null || markup === undefined) return 'N/A';
    const numMarkup = parseFloat(markup);
    return isNaN(numMarkup) ? 'N/A' : numMarkup.toFixed(2);
  };

  // Parse reference_change if it's a string
  let parsedReferenceChange = null;
  try {
    parsedReferenceChange = referenceChange ? 
      (typeof referenceChange === 'string' ? 
        JSON.parse(referenceChange) : 
        referenceChange) : 
      null;
  } catch (e) {
    console.error('Error parsing reference_change:', e);
  }

  // Get referencing items
  const parsedReferencingItems = referencingItems ? 
    (typeof referencingItems === 'string' ? 
      referencingItems.split(',').map(id => ({ item_id: id })) : 
      referencingItems) : 
    [];

  if (!itemDetails) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">No item details available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Replacement Information Section */}
        {(hasReferenceChange || isReferencedBy) && (
          <Box>
            {hasReferenceChange && parsedReferenceChange && (
              <ReplacementPanel
                type="replacement"
                mainItemId={itemDetails.item_id}
                connectedItemId={parsedReferenceChange.new_reference_id}
                source={parsedReferenceChange.source}
                supplierName={parsedReferenceChange.supplier_name}
                changeDate={parsedReferenceChange.change_date}
                description={itemDetails.hebrew_description}
                connectedDescription={parsedReferenceChange.new_description}
                onItemClick={onItemClick}
              />
            )}
            {isReferencedBy && parsedReferencingItems?.length > 0 && (
              <Box sx={{ mt: hasReferenceChange ? 2 : 0 }}>
                {parsedReferencingItems.map((itemId, index) => (
                  <Box key={itemId} sx={{ mt: index > 0 ? 2 : 0 }}>
                    <ReplacementPanel
                      type="referenced"
                      mainItemId={itemId}
                      connectedItemId={itemDetails.item_id}
                      source="user"
                      changeDate={new Date().toISOString()}
                      description={itemDetails.hebrew_description}
                      onItemClick={onItemClick}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Rest of the component remains exactly the same... */}
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Basic Information
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Item ID</Typography>
                    <Typography variant="body1">{itemDetails.item_id}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Hebrew Description</Typography>
                    <Typography variant="body1" sx={{ direction: 'rtl' }}>
                      {itemDetails.hebrew_description}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">English Description</Typography>
                    <Typography variant="body1">
                      {itemDetails.english_description || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">HS Code</Typography>
                    <Typography variant="body1">
                      {itemDetails.hs_code || 'N/A'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper 
                elevation={0}
                sx={{ 
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Stock Information
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Current Stock</Typography>
                    <Typography variant="h6">
                      {itemDetails.qty_in_stock || 0}
                      <Chip
                        label={itemDetails.qty_in_stock > 0 ? 'In Stock' : 'Out of Stock'}
                        color={itemDetails.qty_in_stock > 0 ? 'success' : 'error'}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Sold This Year</Typography>
                    <Typography variant="body1">{itemDetails.sold_this_year || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Sold Last Year</Typography>
                    <Typography variant="body1">{itemDetails.sold_last_year || 0}</Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Grid>

          {/* Pricing Information */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Pricing Information
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Current Price</Typography>
                    <Typography variant="h6">
                      {formatIlsPrice(itemDetails.retail_price) || 'No Price Set'}
                    </Typography>
                    {itemDetails.last_price_update && (
                      <Typography variant="caption" color="text.secondary">
                        Last updated: {new Date(itemDetails.last_price_update).toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Import Markup</Typography>
                    <Typography variant="body1">
                      {formatImportMarkup(itemDetails.import_markup)}
                      {itemDetails.import_markup && (
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          ({((itemDetails.import_markup - 1) * 100).toFixed(0)}%)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {itemDetails.image && (
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2,
                    bgcolor: 'background.default',
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Product Image
                  </Typography>
                  <Box
                    component="img"
                    src={`${API_BASE_URL}/uploads/${itemDetails.image}`}
                    alt={itemDetails.item_id}
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
      </Stack>
    </Box>
  );
}

export default GeneralInfoPanel;
