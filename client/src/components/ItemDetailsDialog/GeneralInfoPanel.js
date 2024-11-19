import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Link,
  Stack,
  Alert
} from '@mui/material';
import {
  Store as StoreIcon,
  Person as PersonIcon,
  SwapHoriz as SwapHorizIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { formatIlsPrice } from '../../utils/priceUtils';

function GeneralInfoPanel({ 
  itemDetails, 
  hasReferenceChange, 
  isReferencedBy, 
  referenceChange,
  referencingItems,
  onItemClick // Add this prop to handle item clicks
}) {
  // Debug logging
  console.log('GeneralInfoPanel received:', {
    itemDetails,
    hasReferenceChange,
    isReferencedBy,
    referenceChange,
    referencingItems
  });

  const getSourceIcon = (source) => {
    if (source === 'supplier') return <StoreIcon fontSize="small" color="warning" />;
    if (source === 'user') return <PersonIcon fontSize="small" color="warning" />;
    if (source === 'inquiry_item') return <DescriptionIcon fontSize="small" color="warning" />;
    return null;
  };

  const getChangeSource = (refChange) => {
    if (!refChange) return '';
    
    if (refChange.source === 'supplier') {
      return `Changed by ${refChange.supplierName || 'supplier'}`;
    } else if (refChange.source === 'user') {
      return 'Changed by user';
    } else if (refChange.source === 'inquiry_item') {
      return 'Reference from inquiry';
    }
    return '';
  };

  const formatImportMarkup = (markup) => {
    if (markup === null || markup === undefined) return 'N/A';
    const numMarkup = parseFloat(markup);
    return isNaN(numMarkup) ? 'N/A' : numMarkup.toFixed(2);
  };

  // If no item details, show loading or error state
  if (!itemDetails) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">No item details available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* Replacement Information */}
      {hasReferenceChange && (
        <Alert 
          severity="warning" 
          icon={<SwapHorizIcon />}
          sx={{ mb: 1 }}
        >
          {referenceChange ? (
            <Typography variant="subtitle2">
              This item has been replaced by:{' '}
              <Link
                component="button"
                onClick={() => onItemClick(referenceChange.newReferenceID)}
                sx={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                {referenceChange.newReferenceID}
              </Link>
            </Typography>
          ) : (
            <Typography variant="subtitle2">
              This is a replacement item
            </Typography>
          )}
          {referenceChange?.notes && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {referenceChange.notes}
            </Typography>
          )}
        </Alert>
      )}
      {isReferencedBy && referencingItems?.length > 0 && (
        <Alert 
          severity="success" 
          icon={<SwapHorizIcon />}
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle2">
            This item replaces:{' '}
            {referencingItems.map((item, idx) => (
              <React.Fragment key={item.itemID}>
                <Link
                  component="button"
                  onClick={() => onItemClick(item.itemID)}
                  sx={{ textDecoration: 'none', cursor: 'pointer' }}
                >
                  {item.itemID}
                </Link>
                {idx < referencingItems.length - 1 ? ', ' : ''}
              </React.Fragment>
            ))}
          </Typography>
        </Alert>
      )}

      {/* Item Details Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2">Item ID</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography>{itemDetails.itemID}</Typography>
            {hasReferenceChange && referenceChange && (
              <Chip
                icon={getSourceIcon(referenceChange.source)}
                label={`→ ${referenceChange.newReferenceID}`}
                color="warning"
                variant="outlined"
                size="small"
                onClick={() => onItemClick(referenceChange.newReferenceID)}
                sx={{ cursor: 'pointer' }}
              />
            )}
          </Stack>
        </Box>
        <Box>
          <Typography variant="subtitle2">HS Code</Typography>
          <Typography>{itemDetails.hsCode}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2">Hebrew Description</Typography>
          {hasReferenceChange && referenceChange ? (
            <>
              <Typography sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                {itemDetails.hebrewDescription}
              </Typography>
              <Typography>
                {referenceChange.newHebrewDescription || 'unknown replacement part'}
              </Typography>
            </>
          ) : (
            <Typography>{itemDetails.hebrewDescription}</Typography>
          )}
        </Box>
        <Box>
          <Typography variant="subtitle2">English Description</Typography>
          {hasReferenceChange && referenceChange ? (
            <>
              <Typography sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                {itemDetails.englishDescription}
              </Typography>
              <Typography>
                {referenceChange.newEnglishDescription || 'unknown replacement part'}
              </Typography>
            </>
          ) : (
            <Typography>{itemDetails.englishDescription}</Typography>
          )}
        </Box>
        <Box>
          <Typography variant="subtitle2">Import Markup</Typography>
          <Typography>
            {formatImportMarkup(itemDetails.importMarkup)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2">Current Price</Typography>
          {formatIlsPrice(itemDetails.retailPrice) ? (
            <Typography>{formatIlsPrice(itemDetails.retailPrice)}</Typography>
          ) : (
            <Typography color="error">No Price</Typography>
          )}
        </Box>
        <Box>
          <Typography variant="subtitle2">Current Stock</Typography>
          <Typography>{itemDetails.qtyInStock || 0}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2">Sold This Year</Typography>
          <Typography>{itemDetails.soldThisYear || 0}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2">Sold Last Year</Typography>
          <Typography>{itemDetails.soldLastYear || 0}</Typography>
        </Box>
      </Box>

      {/* Replacement Details */}
      {hasReferenceChange && referenceChange && (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2,
            mt: 2,
            backgroundColor: '#fff3e0',
            border: '1px solid #FFE0B2'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" color="warning.main" sx={{ fontWeight: 'medium' }}>
              Replacement Details
            </Typography>
            <SwapHorizIcon color="warning" />
            <Chip 
              icon={getSourceIcon(referenceChange.source)}
              label={getChangeSource(referenceChange)}
              color="warning"
              variant="outlined"
              size="small"
            />
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                New Reference ID
              </Typography>
              <Link
                component="button"
                onClick={() => onItemClick(referenceChange.newReferenceID)}
                sx={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                {referenceChange.newReferenceID}
              </Link>
            </Box>
            {referenceChange.changeDate && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Changed On
                </Typography>
                <Typography variant="body1">
                  {new Date(referenceChange.changeDate).toLocaleDateString()}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Referenced By Details */}
      {isReferencedBy && referencingItems?.length > 0 && (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2,
            mt: 2,
            backgroundColor: '#e8f5e9',
            border: '1px solid #A5D6A7'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" color="success.main" sx={{ fontWeight: 'medium' }}>
              Original Items
            </Typography>
            <SwapHorizIcon color="success" />
            <Chip 
              label="New Reference Item"
              color="success"
              variant="outlined"
              size="small"
            />
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={2}>
            {referencingItems.map((item, index) => (
              <Box key={index}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Link
                    component="button"
                    onClick={() => onItemClick(item.itemID)}
                    sx={{ textDecoration: 'none', cursor: 'pointer' }}
                  >
                    {item.itemID}
                  </Link>
                  {getSourceIcon(item.referenceChange?.source)}
                  <Typography variant="body2" color="text.secondary">
                    {getChangeSource(item.referenceChange)}
                  </Typography>
                </Stack>
                {item.hebrewDescription && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {item.hebrewDescription}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

export default GeneralInfoPanel;
