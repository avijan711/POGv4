import { useState, useEffect, useMemo } from 'react';
import { uiDebug, dataDebug } from '../utils/debug';
import inventoryUtils from '../utils/inventoryUtils';

/**
 * Custom hook for managing item details
 * @param {Object} item - Item data from API
 * @param {boolean} open - Whether the dialog is open
 */
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
    if (!open || !item) {
      return null;
    }

    dataDebug.logData('Processing item data', item);

    // Parse JSON fields if they're strings
    const parseJsonField = (field) => {
      if (!field) return [];
      return typeof field === 'string' ? JSON.parse(field) : field;
    };

    // Process reference change
    const referenceChange = item.referenceChange ? 
      (typeof item.referenceChange === 'string' ? 
        JSON.parse(item.referenceChange) : 
        item.referenceChange) : null;

    // Process arrays
    const priceHistory = parseJsonField(item.priceHistory);
    const supplierPrices = parseJsonField(item.supplierPrices);
    const promotions = parseJsonField(item.promotions);
    const referencingItems = parseJsonField(item.referencingItems);

    // Create the result structure that ItemDetailsDialog expects
    const result = {
      item: {
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
        referenceChange: referenceChange,
        referencingItems: referencingItems
      },
      priceHistory,
      supplierPrices,
      promotions,
      hasReferenceChange: item.hasReferenceChange || referenceChange !== null,
      isReferencedBy: item.isReferencedBy || referencingItems.length > 0,
      referenceChange,
      referencingItems,
      getChangeSource: inventoryUtils.getChangeSource,
      getBackgroundColor: () => inventoryUtils.getBackgroundColor(item)
    };

    dataDebug.logData('Processed item data', result);
    return result;
  }, [item, open]);

  // Compute loading state
  const isLoading = useMemo(() => {
    const loading = open && !itemData && !item;
    uiDebug.log('Loading state:', loading);
    return loading;
  }, [open, itemData, item]);

  // Compute error state
  const hasError = useMemo(() => {
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
