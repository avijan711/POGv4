import React, { useCallback } from 'react';
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
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  SwapHoriz as SwapHorizIcon,
  Store as StoreIcon,
  Info as InfoIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';

import { useItemDetails } from '../../hooks/useItemDetails';
import { uiDebug, perfDebug } from '../../utils/debug';
import BasicInfoTab from './BasicInfoTab';
import PriceHistoryTab from './PriceHistoryTab';
import SupplierPricesTab from './SupplierPricesTab';
import ReferenceChangesTab from './ReferenceChangesTab';

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
  // Log received props for debugging
  uiDebug.log('ItemDetailsDialog received:', { open, loading, item });
  perfDebug.time('ItemDetailsDialog render');

  const {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError,
    error
  } = useItemDetails(item, open, 'view');

  const handleTabChange = useCallback((e, newValue) => {
    uiDebug.log('Tab changed', { from: tabValue, to: newValue });
    setTabValue(newValue);
  }, [tabValue, setTabValue]);

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

  const {
    itemDetails,
    priceHistory,
    supplierPrices,
    referenceChanges,
    hasReferenceChange,
    isReferencedBy
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

      {/* Dialog Header */}
      <AppBar 
        position="static" 
        color="default" 
        elevation={1}
        sx={{
          borderBottom: hasReferenceChange || isReferencedBy ? 2 : 1,
          borderColor: isReferencedBy ? 'success.main' : hasReferenceChange ? 'warning.main' : 'divider'
        }}
      >
        <Toolbar variant="dense">
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {itemDetails.itemID}
            </Typography>
            
            {hasReferenceChange && (
              <Chip
                icon={<SwapHorizIcon />}
                label="Has Reference Change"
                color="warning"
                variant="filled"
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            )}
            
            {isReferencedBy && (
              <Chip
                icon={<StoreIcon />}
                label="Referenced By Others"
                color="success"
                variant="filled"
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            )}

            <Chip
              icon={<InfoIcon />}
              label={`Last Updated: ${new Date(itemDetails.lastUpdated).toLocaleDateString()}`}
              variant="outlined"
              size="small"
            />
          </Stack>
          
          <IconButton edge="end" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Toolbar>

        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          aria-label="item details tabs"
          sx={{ 
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
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
            icon={supplierPrices.length ? <Chip size="small" label={supplierPrices.length} /> : null}
            iconPosition="end"
          />
          <Tab 
            label="Reference Changes" 
            id="item-tab-3" 
            aria-controls="item-tabpanel-3"
            icon={referenceChanges.length ? (
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
      </AppBar>

      {/* Dialog Content */}
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TabPanel value={tabValue} index={0}>
          <BasicInfoTab itemDetails={itemDetails} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PriceHistoryTab priceHistory={priceHistory} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <SupplierPricesTab 
            supplierPrices={supplierPrices}
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
