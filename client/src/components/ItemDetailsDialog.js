import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Typography,
  Paper
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useItemDetails } from '../hooks/useItemDetails';
import { dataDebug } from '../utils/debug';

import TabPanel from './ItemDetailsDialog/TabPanel';
import GeneralInfoPanel from './ItemDetailsDialog/GeneralInfoPanel';
import PriceHistoryPanel from './ItemDetailsDialog/PriceHistoryPanel';
import SupplierPricesPanel from './ItemDetailsDialog/SupplierPricesPanel';
import PromotionsPanel from './ItemDetailsDialog/PromotionsPanel';

function ItemDetailsDialog({ open, onClose, item, onItemClick }) {
  dataDebug.logData('ItemDetailsDialog received item', item);
  
  const { itemData, isLoading, hasError } = useItemDetails(item, open);
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (itemData) {
      dataDebug.logData('ItemDetailsDialog processed data', itemData);
    }
  }, [itemData]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleItemClick = async (itemId) => {
    onClose();
    if (onItemClick) {
      onItemClick({ itemID: itemId });
    }
  };

  const getBackgroundColor = () => {
    if (!itemData?.item) return '#ffffff';
    
    if (itemData.hasReferenceChange) {
      return '#fff3e0'; // Lighter orange background for old/replaced items
    }
    if (itemData.isReferencedBy) {
      return '#e8f5e9'; // Lighter green background for new/replacement items
    }
    return '#ffffff';
  };

  const getDialogTitle = () => {
    if (!itemData?.item) return 'Item Details';
    
    const { itemID, hebrewDescription, englishDescription } = itemData.item;
    return `${itemID} - ${hebrewDescription || ''} - ${englishDescription || ''}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        elevation: 24,
        style: {
          backgroundColor: getBackgroundColor()
        }
      }}
    >
      <Paper 
        elevation={0} 
        sx={{ 
          backgroundColor: 'inherit',
          '& .MuiDialogTitle-root': {
            backgroundColor: 'inherit'
          },
          '& .MuiDialogContent-root': {
            backgroundColor: 'inherit'
          }
        }}
      >
        <DialogTitle sx={{ 
          m: 0, 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {getDialogTitle()}
          </Typography>
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
        <DialogContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : hasError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              No item data available. Please try again.
            </Alert>
          ) : itemData && itemData.item ? (
            <Box sx={{ width: '100%' }}>
              {itemData.hasReferenceChange && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {itemData.referenceChange ? (
                    <Typography variant="subtitle2">
                      This item has been replaced by: {itemData.referenceChange.newReferenceID}
                    </Typography>
                  ) : (
                    <Typography variant="subtitle2">
                      This is a replacement item
                    </Typography>
                  )}
                </Alert>
              )}
              {itemData.isReferencedBy && itemData.referencingItems?.length > 0 && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    This item replaces: {itemData.referencingItems.map(i => i.itemID).join(', ')}
                  </Typography>
                </Alert>
              )}
              <Paper elevation={0} sx={{ backgroundColor: '#ffffff', mb: 2 }}>
                <Tabs value={value} onChange={handleChange} aria-label="item details tabs">
                  <Tab label="General Info" />
                  <Tab label="Price History" />
                  <Tab label="Supplier Prices" />
                  <Tab label="Promotions" />
                </Tabs>
              </Paper>
              <Paper elevation={0} sx={{ backgroundColor: '#ffffff', p: 2, borderRadius: 1 }}>
                <TabPanel value={value} index={0}>
                  <GeneralInfoPanel 
                    itemDetails={itemData.item}
                    hasReferenceChange={itemData.hasReferenceChange}
                    isReferencedBy={itemData.isReferencedBy}
                    referenceChange={itemData.referenceChange}
                    referencingItems={itemData.referencingItems}
                    onItemClick={handleItemClick}
                  />
                </TabPanel>
                <TabPanel value={value} index={1}>
                  <PriceHistoryPanel 
                    priceHistory={itemData.priceHistory}
                    itemDetails={itemData.item}
                  />
                </TabPanel>
                <TabPanel value={value} index={2}>
                  <SupplierPricesPanel 
                    supplierPrices={itemData.supplierPrices}
                    itemDetails={itemData.item}
                  />
                </TabPanel>
                <TabPanel value={value} index={3}>
                  <PromotionsPanel 
                    promotions={itemData.promotions}
                    itemDetails={itemData.item}
                  />
                </TabPanel>
              </Paper>
            </Box>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No item data structure available
            </Alert>
          )}
        </DialogContent>
      </Paper>
    </Dialog>
  );
}

export default ItemDetailsDialog;
