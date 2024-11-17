import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Tab,
  Tabs
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import TabPanel from './ItemDetailsDialog/TabPanel';
import GeneralInfoPanel from './ItemDetailsDialog/GeneralInfoPanel';
import PriceHistoryPanel from './ItemDetailsDialog/PriceHistoryPanel';
import SupplierPricesPanel from './ItemDetailsDialog/SupplierPricesPanel';
import PromotionsPanel from './ItemDetailsDialog/PromotionsPanel';

function ItemDetailsDialog({ open, onClose, item, showReferenceDetails = false }) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    // Debug logs to check incoming data
    try {
      console.log('ItemDetailsDialog raw props:', JSON.stringify({
        open,
        showReferenceDetails,
        hasItem: !!item,
        itemId: item?.item?.itemID
      }, null, 2));
      
      if (item) {
        console.log('Item structure:', JSON.stringify({
          hasItem: !!item.item,
          hasPriceHistory: Array.isArray(item.priceHistory),
          hasSupplierPrices: Array.isArray(item.supplierPrices),
          hasPromotions: Array.isArray(item.promotions)
        }, null, 2));

        console.log('Item details:', JSON.stringify({
          itemDetails: item.item,
          priceHistory: item.priceHistory,
          supplierPrices: item.supplierPrices,
          promotions: item.promotions
        }, null, 2));

        if (item.item) {
          console.log('Reference data:', JSON.stringify({
            hasReferenceChange: item.hasReferenceChange,
            referenceChange: item.referenceChange,
            isReferencedBy: item.isReferencedBy,
            referencingItems: item.referencingItems
          }, null, 2));
        }
      }
    } catch (error) {
      console.error('Error logging item data:', error);
    }
  }, [item, open, showReferenceDetails]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  // Early return if no data
  if (!item || !item.item) {
    console.log('No item data available');
    return null;
  }

  // Log the data being passed to each panel
  try {
    console.log('Data passed to panels:', JSON.stringify({
      generalInfo: {
        itemDetails: item.item,
        hasReferenceChange: showReferenceDetails && item.hasReferenceChange,
        isReferencedBy: showReferenceDetails && item.isReferencedBy
      },
      priceHistory: {
        priceHistory: item.priceHistory,
        itemDetails: item.item
      },
      supplierPrices: {
        supplierPrices: item.supplierPrices,
        itemDetails: item.item
      },
      promotions: {
        promotions: item.promotions,
        itemDetails: item.item
      }
    }, null, 2));
  } catch (error) {
    console.error('Error logging panel data:', error);
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Item Details
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={value} onChange={handleChange} aria-label="item details tabs">
              <Tab label="General Info" />
              <Tab label="Price History" />
              <Tab label="Supplier Prices" />
              <Tab label="Promotions" />
            </Tabs>
          </Box>
          <TabPanel value={value} index={0}>
            <GeneralInfoPanel 
              itemDetails={item.item}
              hasReferenceChange={showReferenceDetails && item.hasReferenceChange}
              isReferencedBy={showReferenceDetails && item.isReferencedBy}
            />
          </TabPanel>
          <TabPanel value={value} index={1}>
            <PriceHistoryPanel 
              priceHistory={item.priceHistory}
            />
          </TabPanel>
          <TabPanel value={value} index={2}>
            <SupplierPricesPanel 
              supplierPrices={item.supplierPrices}
            />
          </TabPanel>
          <TabPanel value={value} index={3}>
            <PromotionsPanel 
              promotions={item.promotions}
            />
          </TabPanel>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default ItemDetailsDialog;
