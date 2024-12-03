import { useState, useEffect, useMemo } from 'react';
import { uiDebug, dataDebug } from '../utils/debug';
import inventoryUtils from '../utils/inventoryUtils';
import axiosInstance from '../utils/axiosConfig';

/**
 * Custom hook for managing item details in both edit and view modes
 * @param {Object} item - Item data from API
 * @param {boolean} open - Whether the dialog is open
 * @param {string} mode - Either 'edit' or 'view' (default: 'view')
 */
export const useItemDetails = (item, open, mode = 'view') => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fullItemData, setFullItemData] = useState(null);

  // Fetch complete item data when dialog opens
  useEffect(() => {
    const fetchFullItemData = async () => {
      if (!open || !item?.item_id) return;

      try {
        setLoading(true);
        dataDebug.log('Fetching full item data for:', item.item_id);

        const [
          itemDetailsResponse,
          priceHistoryResponse,
          supplierPricesResponse,
          referenceChangesResponse
        ] = await Promise.all([
          axiosInstance.get(`/api/items/${item.item_id}`),
          axiosInstance.get(`/api/items/${item.item_id}/price-history`),
          axiosInstance.get(`/api/items/${item.item_id}/supplier-prices`),
          axiosInstance.get(`/api/items/${item.item_id}/reference-changes`)
        ]);

        setFullItemData({
          details: itemDetailsResponse.data,
          priceHistory: priceHistoryResponse.data,
          supplierPrices: supplierPricesResponse.data,
          referenceChanges: referenceChangesResponse.data
        });

        setError(null);
      } catch (err) {
        console.error('Error fetching item data:', err);
        setError(err.response?.data?.message || 'Error loading item data');
        setFullItemData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFullItemData();
  }, [open, item?.item_id]);

  // Process item data based on mode
  const itemData = useMemo(() => {
    if (!open || !fullItemData) {
      return null;
    }

    dataDebug.logData('Processing item data', { fullItemData, mode });

    try {
      const { details, priceHistory, supplierPrices, referenceChanges } = fullItemData;

      // Base item details
      const baseDetails = {
        itemID: details.item_id,
        hebrewDescription: details.hebrew_description || '',
        englishDescription: details.english_description || '',
        importMarkup: parseFloat(details.import_markup) || 1.30,
        hsCode: details.hs_code || '',
        image: details.image,
        notes: details.notes || '',
        origin: details.origin || '',
        retailPrice: details.retail_price !== null ? parseFloat(details.retail_price) : null,
        qtyInStock: parseInt(details.current_stock) || 0,
        soldThisYear: parseInt(details.current_year_sales) || 0,
        soldLastYear: parseInt(details.last_year_sales) || 0,
        lastUpdated: details.last_updated,
        lastPriceUpdate: details.last_price_update
      };

      // Process price history
      const processedPriceHistory = priceHistory.map(record => ({
        date: new Date(record.date),
        retailPrice: record.ils_retail_price,
        qtyInStock: record.qty_in_stock,
        soldThisYear: record.qty_sold_this_year,
        soldLastYear: record.qty_sold_last_year
      }));

      // Process supplier prices - Keep snake_case to match API response
      const processedSupplierPrices = supplierPrices.map(price => ({
        supplier_name: price.supplier_name || 'Unknown Supplier',
        price_quoted: price.price_quoted,
        response_date: new Date(price.response_date),
        status: price.status,
        is_promotion: Boolean(price.is_promotion),
        promotion_name: price.promotion_name,
        price_change: price.price_change || 0
      }));

      // Process reference changes - Keep snake_case to match API response
      const processedReferenceChanges = referenceChanges.map(change => ({
        original_item_id: change.original_item_id,
        new_reference_id: change.new_reference_id,
        supplier_name: change.supplier_name,
        change_date: new Date(change.change_date),
        notes: change.notes,
        changed_by_user: Boolean(change.changed_by_user),
        source: change.supplier_name ? 'supplier' : 'user'
      }));

      // For edit mode, return form-ready data
      if (mode === 'edit') {
        return {
          ...baseDetails,
          supplierPrices: processedSupplierPrices
        };
      }

      // For view mode, include all data
      return {
        itemDetails: baseDetails,
        priceHistory: processedPriceHistory,
        supplierPrices: processedSupplierPrices,
        referenceChanges: processedReferenceChanges,
        hasReferenceChange: processedReferenceChanges.length > 0,
        isReferencedBy: details.is_referenced_by || false,
        getChangeSource: inventoryUtils.getChangeSource,
        getBackgroundColor: () => inventoryUtils.getBackgroundColor(details)
      };

    } catch (err) {
      console.error('Error processing item data:', err);
      setError('Error processing item data');
      return null;
    }
  }, [fullItemData, open, mode]);

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
    hasError,
    error
  };
};
