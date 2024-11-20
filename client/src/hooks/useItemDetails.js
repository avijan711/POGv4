import { useState, useEffect, useMemo } from 'react';
import { uiDebug, dataDebug } from '../utils/debug';
import inventoryUtils from '../utils/inventoryUtils';
import axios from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Custom hook for managing item details
 * @param {Object} item - Item data from API
 * @param {boolean} open - Whether the dialog is open
 */
export const useItemDetails = (item, open) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);

  // Fetch full item details when dialog opens
  useEffect(() => {
    if (open && item?.itemID) {
      const fetchItemDetails = async () => {
        setLoading(true);
        try {
          const response = await axios.get(`${API_BASE_URL}/api/items/${item.itemID}`);
          setItemDetails(response.data);
          setError(null);
        } catch (err) {
          console.error('Error fetching item details:', err);
          setError('Failed to load item details');
        } finally {
          setLoading(false);
        }
      };
      fetchItemDetails();
    } else {
      setItemDetails(null);
    }
  }, [open, item?.itemID]);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) {
      uiDebug.log('ItemDetailsDialog opened, resetting tab');
      setTabValue(0);
    }
  }, [open]);

  // Process item data
  const itemData = useMemo(() => {
    if (!open || !itemDetails) {
      return null;
    }

    dataDebug.logData('Processing item data', itemDetails);

    // Parse JSON fields if they're strings
    const parseJsonField = (field) => {
      if (!field) return [];
      return typeof field === 'string' ? JSON.parse(field) : field;
    };

    // Process reference change
    const referenceChange = itemDetails.referenceChange ? 
      (typeof itemDetails.referenceChange === 'string' ? 
        JSON.parse(itemDetails.referenceChange) : 
        itemDetails.referenceChange) : null;

    // Process arrays
    const priceHistory = parseJsonField(itemDetails.priceHistory);
    const supplierPrices = parseJsonField(itemDetails.supplierPrices);
    const promotions = parseJsonField(itemDetails.promotions);
    const referencingItems = parseJsonField(itemDetails.referencingItems);

    // Create the result structure that ItemDetailsDialog expects
    const result = {
      item: {
        itemID: itemDetails.itemID,
        hebrewDescription: itemDetails.hebrewDescription,
        englishDescription: itemDetails.englishDescription,
        importMarkup: parseFloat(itemDetails.importMarkup) || 1.30,
        hsCode: itemDetails.hsCode || '',
        image: itemDetails.image,
        retailPrice: itemDetails.retailPrice !== null && itemDetails.retailPrice !== undefined ? 
          parseFloat(itemDetails.retailPrice) : null,
        qtyInStock: parseInt(itemDetails.qtyInStock) || 0,
        soldThisYear: parseInt(itemDetails.soldThisYear) || 0,
        soldLastYear: parseInt(itemDetails.soldLastYear) || 0,
        lastUpdated: itemDetails.lastUpdated,
        referenceChange: referenceChange,
        referencingItems: referencingItems
      },
      priceHistory,
      supplierPrices,
      promotions,
      hasReferenceChange: itemDetails.hasReferenceChange || referenceChange !== null,
      isReferencedBy: itemDetails.isReferencedBy || referencingItems.length > 0,
      referenceChange,
      referencingItems,
      getChangeSource: inventoryUtils.getChangeSource,
      getBackgroundColor: () => inventoryUtils.getBackgroundColor(itemDetails)
    };

    dataDebug.logData('Processed item data', result);
    return result;
  }, [itemDetails, open]);

  // Compute loading state
  const isLoading = useMemo(() => {
    const loadingState = loading || (open && !itemData && !error);
    uiDebug.log('Loading state:', loadingState);
    return loadingState;
  }, [loading, open, itemData, error]);

  // Compute error state
  const hasError = useMemo(() => {
    const errorState = Boolean(error);
    uiDebug.log('Error state:', errorState);
    return errorState;
  }, [error]);

  return {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError
  };
};
