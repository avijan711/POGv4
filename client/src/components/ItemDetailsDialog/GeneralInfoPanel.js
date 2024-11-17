import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Link,
  Stack
} from '@mui/material';
import {
  Store as StoreIcon,
  Person as PersonIcon,
  SwapHoriz as SwapHorizIcon
} from '@mui/icons-material';
import { formatIlsPrice } from '../../utils/priceUtils';

function GeneralInfoPanel({ itemDetails, hasReferenceChange, isReferencedBy }) {
  const getSourceIcon = (source) => {
    if (source === 'supplier') return <StoreIcon fontSize="small" color="warning" />;
    if (source === 'user') return <PersonIcon fontSize="small" color="warning" />;
    return null;
  };

  const getChangeSource = (referenceChange) => {
    if (!referenceChange) return '';
    
    if (referenceChange.source === 'supplier') {
      return `Changed by ${referenceChange.supplierName || 'supplier'}`;
    } else if (referenceChange.source === 'user') {
      return 'Changed by user';
    }
    return '';
  };

  const getBackgroundColor = () => {
    if (hasReferenceChange) {
      return 'rgba(255, 243, 224, 0.5)'; // Light orange for items with reference changes
    } else if (isReferencedBy) {
      return 'rgba(232, 245, 233, 0.5)'; // Light green for new reference items
    }
    return 'inherit';
  };

  const formatImportMarkup = (markup) => {
    if (markup === null || markup === undefined) return 'N/A';
    const numMarkup = parseFloat(markup);
    return isNaN(numMarkup) ? 'N/A' : numMarkup.toFixed(2);
  };

  return (
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: 2,
      backgroundColor: getBackgroundColor(),
      p: 2,
      borderRadius: 1
    }}>
      <Box>
        <Typography variant="subtitle2">Item ID</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>{itemDetails?.itemID}</Typography>
          {hasReferenceChange && itemDetails?.referenceChange && (
            <Chip
              icon={getSourceIcon(itemDetails.referenceChange.source)}
              label={itemDetails.referenceChange.newReferenceID}
              color="warning"
              variant="outlined"
              size="small"
            />
          )}
        </Stack>
      </Box>
      <Box>
        <Typography variant="subtitle2">HS Code</Typography>
        <Typography>{itemDetails?.hsCode}</Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">Hebrew Description</Typography>
        {hasReferenceChange && itemDetails?.referenceChange ? (
          <>
            <Typography sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
              {itemDetails.referenceChange.originalDescription}
            </Typography>
            <Typography>
              {itemDetails.referenceChange.newDescription}
            </Typography>
          </>
        ) : (
          <Typography>{itemDetails?.hebrewDescription}</Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2">English Description</Typography>
        <Typography>{itemDetails?.englishDescription}</Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">Import Markup</Typography>
        <Typography>
          {formatImportMarkup(itemDetails?.importMarkup)}
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">Current Price</Typography>
        {formatIlsPrice(itemDetails?.retailPrice) ? (
          <Typography>{formatIlsPrice(itemDetails?.retailPrice)}</Typography>
        ) : (
          <Typography color="error">No Price</Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2">Current Stock</Typography>
        <Typography>{itemDetails?.qtyInStock || 0}</Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">Sold This Year</Typography>
        <Typography>{itemDetails?.soldThisYear || 0}</Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">Sold Last Year</Typography>
        <Typography>{itemDetails?.soldLastYear || 0}</Typography>
      </Box>

      {hasReferenceChange && itemDetails?.referenceChange && (
        <Paper 
          elevation={0} 
          sx={{ 
            gridColumn: '1 / -1',
            p: 2,
            mt: 2,
            backgroundColor: 'rgba(255, 243, 224, 0.9)',
            border: '1px solid #FFE0B2'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" color="warning.main" sx={{ fontWeight: 'medium' }}>
              Reference Change Details
            </Typography>
            <SwapHorizIcon color="warning" />
            <Chip 
              icon={getSourceIcon(itemDetails.referenceChange.source)}
              label={getChangeSource(itemDetails.referenceChange)}
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
                variant="body1"
                onClick={() => window.location.reload()}
                sx={{ textDecoration: 'none' }}
              >
                {itemDetails.referenceChange.newReferenceID}
              </Link>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Changed On
              </Typography>
              <Typography variant="body1">
                {new Date(itemDetails.referenceChange.changeDate).toLocaleDateString()}
              </Typography>
            </Box>
            {itemDetails.referenceChange.notes && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notes
                </Typography>
                <Typography variant="body1">
                  {itemDetails.referenceChange.notes}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {isReferencedBy && itemDetails?.referencingItems?.length > 0 && (
        <Paper 
          elevation={0} 
          sx={{ 
            gridColumn: '1 / -1',
            p: 2,
            mt: 2,
            backgroundColor: '#e8f5e9',
            border: '1px solid #A5D6A7'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" color="success.main" sx={{ fontWeight: 'medium' }}>
              Reference Change Details
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Replaces Items
              </Typography>
              <Stack spacing={1}>
                {itemDetails.referencingItems.map((item, index) => (
                  <Box key={index}>
                    <Link
                      component="button"
                      variant="body1"
                      onClick={() => window.location.reload()}
                      sx={{ textDecoration: 'none' }}
                    >
                      {item.itemID}
                    </Link>
                    {item.referenceChange?.originalDescription && (
                      <Typography variant="body2" color="text.secondary">
                        {item.referenceChange.originalDescription}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
            {itemDetails.referencingItems[0]?.referenceChange?.changeDate && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Changed On
                </Typography>
                <Typography variant="body1">
                  {new Date(itemDetails.referencingItems[0].referenceChange.changeDate).toLocaleDateString()}
                </Typography>
              </Box>
            )}
            {itemDetails.referencingItems.map((refItem, index) => (
              <Box key={index} sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Change Source
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {getSourceIcon(refItem.referenceChange?.source)}
                  <Typography variant="body1">
                    {getChangeSource(refItem.referenceChange)}
                  </Typography>
                </Stack>
              </Box>
            ))}
            {itemDetails.referencingItems[0]?.referenceChange?.notes && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notes
                </Typography>
                <Typography variant="body1">
                  {itemDetails.referencingItems[0].referenceChange.notes}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default GeneralInfoPanel;
