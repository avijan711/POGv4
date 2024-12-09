import React, { useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Stack,
  Chip,
  Alert,
  Paper,
  Tooltip,
  Snackbar,
  Button
} from '@mui/material';
import {
  Close as CloseIcon,
  SwapHoriz as SwapHorizIcon,
  Store as StoreIcon,
  Info as InfoIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import axios from 'axios';

import { useItemDetails } from '../../hooks/useItemDetails';
import { uiDebug, perfDebug } from '../../utils/debug';
import BasicInfoTab from './BasicInfoTab';
import PriceHistoryTab from './PriceHistoryTab';
import SupplierPricesTab from './SupplierPricesTab';
import ReferenceChangesTab from './ReferenceChangesTab';
import { API_BASE_URL } from '../../config';

// Loading dialog component
function LoadingDialog({ open }) {
  return (
    <Dialog 
      open={open} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '200px' }
      }}
    >
      <DialogContent>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%',
          p: 4 
        }}>
          <CircularProgress />
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// Error dialog component
function ErrorDialog({ open, error, onClose }) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '200px' }
      }}
    >
      <DialogContent>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%',
          p: 4 
        }}>
          <Typography color="error">
            {error || 'Unable to load item details. Please try again.'}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function TabPanel({ children, value, index }) {
  return (
    <Box 
      role="tabpanel"
      hidden={value !== index}
      id={`item-tabpanel-${index}`}
      aria-labelledby={`item-tab-${index}`}
      sx={{ 
        flex: 1,
        overflow: 'auto',
        height: 'calc(100vh - 200px)'  // Adjust for AppBar and Tabs height
      }}
    >
      {value === index && children}
    </Box>
  );
}

function ItemDetailsDialog({ open, onClose, item, onItemClick, loading = false }) {
  const [showCopySuccess, setShowCopySuccess] = React.useState(false);

  // Log received props for debugging
  uiDebug.log('ItemDetailsDialog received:', { open, loading, item });
  perfDebug.time('ItemDetailsDialog render');

  const {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError,
    error,
    refreshItemData
  } = useItemDetails(item, open, 'view');

  const handleTabChange = useCallback((e, newValue) => {
    uiDebug.log('Tab changed', { from: tabValue, to: newValue });
    setTabValue(newValue);
  }, [tabValue, setTabValue]);

  const handleUpdateNotes = async (notes) => {
    try {
      await axios.patch(`${API_BASE_URL}/items/${itemData.itemDetails.itemID}`, {
        notes: notes
      });
      refreshItemData();
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  const handleCopyItemId = async () => {
    try {
      await navigator.clipboard.writeText(itemData?.itemDetails?.itemID);
      setShowCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Process supplier prices
  const processedSupplierPrices = useMemo(() => {
    if (!itemData?.supplierPrices) return [];

    const prices = Array.isArray(itemData.supplierPrices) 
      ? itemData.supplierPrices 
      : typeof itemData.supplierPrices === 'string'
        ? JSON.parse(itemData.supplierPrices)
        : [];

    return prices
      .filter(price => 
        price && 
        typeof price === 'object' && 
        'supplier_name' in price && 
        'price_quoted' in price &&
        typeof price.price_quoted === 'number'
      )
      .map(price => ({
        supplier_name: price.supplier_name || 'Unknown Supplier',
        price_quoted: price.price_quoted || 0,
        response_date: price.response_date ? new Date(price.response_date) : new Date(),
        status: price.status || 'unknown',
        is_promotion: Boolean(price.is_promotion),
        promotion_name: price.promotion_name || '',
        price_change: price.price_change || 0
      }));
  }, [itemData?.supplierPrices]);

  // Don't render anything if dialog is closed
  if (!open) {
    perfDebug.timeEnd('ItemDetailsDialog render');
    return null;
  }

  // Show loading state
  if (loading || isLoading) {
    return <LoadingDialog open={open} />;
  }

  // Show error state
  if (hasError || !itemData) {
    return <ErrorDialog open={open} error={error} onClose={onClose} />;
  }

  // Get data from itemData, with safe defaults
  const {
    itemDetails = {},
    priceHistory = [],
    referenceChanges = [],
    hasReferenceChange = false,
    isReferencedBy = false
  } = itemData;

  perfDebug.timeEnd('ItemDetailsDialog render');

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          m: 1  // Add margin around dialog
        }
      }}
    >
      {/* Reference Change Alert */}
      {(hasReferenceChange || isReferencedBy) && (
        <Alert 
          severity={isReferencedBy ? "success" : "warning"}
          icon={isReferencedBy ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
          sx={{ 
            borderRadius: 0,
            py: 1,
            fontWeight: 'bold',
            fontSize: '1rem',
            backgroundColor: isReferencedBy ? 'success.light' : 'warning.light',
            color: '#fff'
          }}
        >
          {isReferencedBy 
            ? "This is a new replacement item"
            : "This item has been replaced by a new item"
          }
        </Alert>
      )}

      {/* Enhanced Header */}
      <Box sx={{ 
        background: 'linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%)',
        borderBottom: hasReferenceChange || isReferencedBy ? 2 : 1,
        borderColor: isReferencedBy ? 'success.main' : hasReferenceChange ? 'warning.main' : 'divider',
        p: 3  // Increased padding
      }}>
        {/* Item ID and Description */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  bgcolor: 'grey.100', 
                  p: 2, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'grey.300'
                }}>
                  <Typography variant="h3" component="div" sx={{ 
                    fontWeight: 'bold',
                    color: 'primary.main',
                    letterSpacing: '0.5px'
                  }}>
                    {itemDetails.itemID}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyItemId}
                    size="large"
                    sx={{ 
                      ml: 2,
                      minWidth: 130,
                      bgcolor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.dark'
                      }
                    }}
                  >
                    Copy ID
                  </Button>
                </Box>
              </Stack>
              <Typography variant="h4" sx={{ 
                mt: 2, 
                color: 'text.primary',
                fontWeight: 500,
                fontSize: '1.75rem',
                direction: 'rtl'  // Right-to-left for Hebrew
              }}>
                {itemDetails.hebrewDescription}
              </Typography>
              {itemDetails.englishDescription && (
                <Typography variant="body1" sx={{ mt: 1, color: 'text.secondary' }}>
                  {itemDetails.englishDescription}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              {hasReferenceChange && (
                <Chip
                  icon={<SwapHorizIcon />}
                  label="Has Reference Change"
                  color="warning"
                  variant="filled"
                  size="medium"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
              
              {isReferencedBy && (
                <Chip
                  icon={<StoreIcon />}
                  label="Referenced By Others"
                  color="success"
                  variant="filled"
                  size="medium"
                  sx={{ fontWeight: 'bold' }}
                />
              )}

              <Chip
                icon={<InfoIcon />}
                label={`Last Updated: ${new Date(itemDetails.lastUpdated || Date.now()).toLocaleDateString()}`}
                variant="outlined"
                size="medium"
              />

              <IconButton edge="end" onClick={onClose} aria-label="close">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        {/* Tabs */}
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          aria-label="item details tabs"
          sx={{ 
            px: 2,
            '& .MuiTab-root': {
              fontWeight: 'bold'
            }
          }}
        >
          <Tab label="Basic Info" id="item-tab-0" aria-controls="item-tabpanel-0" />
          <Tab label="Price History" id="item-tab-1" aria-controls="item-tabpanel-1" />
          <Tab 
            label="Supplier Prices" 
            id="item-tab-2" 
            aria-controls="item-tabpanel-2"
            icon={processedSupplierPrices?.length ? <Chip size="small" label={processedSupplierPrices.length} /> : null}
            iconPosition="end"
          />
          <Tab 
            label="Reference Changes" 
            id="item-tab-3" 
            aria-controls="item-tabpanel-3"
            icon={referenceChanges?.length ? (
              <Chip 
                size="small" 
                label={referenceChanges.length} 
                color={hasReferenceChange ? "warning" : "default"}
                sx={{ fontWeight: 'bold' }}
              />
            ) : null}
            iconPosition="end"
            sx={hasReferenceChange ? {
              color: 'warning.main',
              '&.Mui-selected': {
                color: 'warning.dark'
              }
            } : {}}
          />
        </Tabs>
      </Box>

      {/* Dialog Content */}
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TabPanel value={tabValue} index={0}>
          <BasicInfoTab 
            itemDetails={itemDetails} 
            onUpdateNotes={handleUpdateNotes}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PriceHistoryTab priceHistory={priceHistory} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <SupplierPricesTab 
            supplierPrices={processedSupplierPrices}
            itemDetails={itemDetails}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <ReferenceChangesTab 
            referenceChanges={referenceChanges}
            onItemClick={onItemClick}
          />
        </TabPanel>
      </DialogContent>

      {/* Copy Success Snackbar */}
      <Snackbar
        open={showCopySuccess}
        autoHideDuration={2000}
        onClose={() => setShowCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Item ID copied to clipboard
        </Alert>
      </Snackbar>
    </Dialog>
  );
}

// Prevent unnecessary re-renders
export default React.memo(ItemDetailsDialog, (prevProps, nextProps) => {
  // Only re-render if these props change
  const shouldUpdate = (
    prevProps.open !== nextProps.open ||
    prevProps.loading !== nextProps.loading ||
    prevProps.item !== nextProps.item
  );
  
  // Log re-render decision for debugging
  uiDebug.log('ItemDetailsDialog shouldUpdate:', { 
    shouldUpdate,
    prevProps,
    nextProps
  });
  
  // Return true if props are equal (no update needed)
  return !shouldUpdate;
});
