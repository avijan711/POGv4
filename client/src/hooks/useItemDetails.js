import { useState, useEffect, useMemo } from 'react';
import { uiDebug, perfDebug } from '../utils/debug';

export const useItemDetails = (item, open) => {
  const [tabValue, setTabValue] = useState(0);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) {
      uiDebug.log('ItemDetailsDialog opened, resetting tab');
      setTabValue(0);
    }
  }, [open]);

  // Process item data
  const itemData = useMemo(() => {
    perfDebug.time('itemData calculation');
    
    // Return null if dialog is not open
    if (!open) {
      perfDebug.timeEnd('itemData calculation');
      return null;
    }

    // Return null if no item data
    if (!item) {
      perfDebug.timeEnd('itemData calculation');
      return null;
    }

    // Log the received item data for debugging
    uiDebug.log('Processing item data:', item);

    // Process the item details
    const processedItemDetails = {
      itemID: item.itemID,
      hebrewDescription: item.hebrewDescription,
      englishDescription: item.englishDescription,
      importMarkup: parseFloat(item.importMarkup) || 1.30,
      hsCode: item.hsCode || '',
      image: item.image,
      retailPrice: item.retailPrice !== null && item.retailPrice !== undefined ? 
        parseFloat(item.retailPrice) : null,
      qtyInStock: parseInt(item.qtyInStock) || 0,
      soldThisYear: parseInt(item.soldThisYear) || 0,
      soldLastYear: parseInt(item.soldLastYear) || 0,
      lastUpdated: item.lastUpdated,
      referenceChange: item.referenceChange ? JSON.parse(item.referenceChange) : null,
      referencedBy: item.referencedBy ? JSON.parse(item.referencedBy) : null
    };

    // Parse JSON arrays
    const priceHistory = item.priceHistory ? JSON.parse(item.priceHistory) : [];
    const supplierPrices = item.supplierPrices ? JSON.parse(item.supplierPrices) : [];
    const promotions = item.promotions ? JSON.parse(item.promotions) : [];

    // Determine reference change status
    const hasReferenceChange = processedItemDetails.referenceChange !== null;
    const isReferencedBy = processedItemDetails.referencedBy !== null;

    const result = {
      itemDetails: processedItemDetails,
      priceHistory,
      supplierPrices,
      promotions,
      hasReferenceChange,
      isReferencedBy,
      getChangeSource: (refChange) => {
        if (!refChange) return '';
        
        if (refChange.source === 'supplier') {
          return `Changed by supplier ${refChange.supplierName || ''}`;
        } else if (refChange.source === 'user') {
          return 'Changed by user';
        }
        return '';
      },
      getBackgroundColor: () => {
        if (hasReferenceChange) {
          return 'rgba(255, 243, 224, 0.9)';
        }
        if (isReferencedBy) {
          return '#e8f5e9';
        }
        return 'transparent';
      }
    };

    perfDebug.timeEnd('itemData calculation');
    uiDebug.log('Processed item data:', result);
    return result;
  }, [item, open]);

  // Compute loading state
  const isLoading = useMemo(() => {
    // We're loading if the dialog is open and we have no data yet
    const loading = open && !itemData && !item;
    uiDebug.log('Loading state:', loading);
    return loading;
  }, [open, itemData, item]);

  // Compute error state
  const hasError = useMemo(() => {
    // We have an error if the dialog is open and item is explicitly null
    const error = open && !itemData && item === null;
    uiDebug.log('Error state:', error);
    return error;
  }, [open, itemData, item]);

  return {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError
  };
};
