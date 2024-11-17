import React, { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';

import { useItemDetails } from '../../hooks/useItemDetails';
import { uiDebug, perfDebug } from '../../utils/debug';
import DialogHeader from './DialogHeader';
import TabPanel from './TabPanel';
import GeneralInfoPanel from './GeneralInfoPanel';
import PriceHistoryPanel from './PriceHistoryPanel';
import SupplierPricesPanel from './SupplierPricesPanel';
import PromotionsPanel from './PromotionsPanel';

// Separate loading dialog component
function LoadingDialog({ open, onClose }) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
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

// Separate error dialog component
function ErrorDialog({ open, onClose }) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
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
            Unable to load item details. Please try again.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ItemDetailsDialog({ open, onClose, item, loading = false }) {
  // Log received props for debugging
  uiDebug.log('ItemDetailsDialog received:', { open, loading, item });
  perfDebug.time('ItemDetailsDialog render');

  const {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError
  } = useItemDetails(item, open);

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
    return <LoadingDialog open={open} onClose={onClose} />;
  }

  // Show error state
  if (hasError || !itemData) {
    return <ErrorDialog open={open} onClose={onClose} />;
  }

  // Extract all required data with defaults
  const {
    itemDetails,
    priceHistory = [],
    supplierPrices = [],
    promotions = [],
    hasReferenceChange = false,
    isReferencedBy = false,
    getChangeSource,
    getBackgroundColor
  } = itemData;

  perfDebug.timeEnd('ItemDetailsDialog render');

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      TransitionProps={{
        onExited: () => {
          // Reset tab value when dialog closes
          setTabValue(0);
        }
      }}
    >
      <DialogHeader
        itemDetails={itemDetails}
        hasReferenceChange={hasReferenceChange}
        isReferencedBy={isReferencedBy}
        getChangeSource={getChangeSource}
        getBackgroundColor={getBackgroundColor}
        onClose={onClose}
      />
      <DialogContent>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          aria-label="item details tabs"
        >
          <Tab label="General Info" id="tab-0" aria-controls="tabpanel-0" />
          <Tab label="Price History" id="tab-1" aria-controls="tabpanel-1" />
          <Tab label="Supplier Prices" id="tab-2" aria-controls="tabpanel-2" />
          <Tab label="Promotions" id="tab-3" aria-controls="tabpanel-3" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <GeneralInfoPanel 
            itemDetails={itemDetails}
            hasReferenceChange={hasReferenceChange}
            isReferencedBy={isReferencedBy}
            getChangeSource={getChangeSource}
            getBackgroundColor={getBackgroundColor}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PriceHistoryPanel priceHistory={priceHistory} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <SupplierPricesPanel 
            supplierPrices={supplierPrices}
            itemDetails={itemDetails}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <PromotionsPanel promotions={promotions} />
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
