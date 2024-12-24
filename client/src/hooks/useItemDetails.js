import { useState, useEffect, useMemo, useCallback } from 'react';
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

  // Process supplier prices consistently
  const processSupplierPrices = (prices) => {
    if (!prices) return [];

    try {
      // Handle supplier prices whether they're a string or array
      const parsedPrices = typeof prices === 'string'
        ? JSON.parse(prices)
        : Array.isArray(prices)
          ? prices
          : [];

      // Filter out invalid entries and ensure required properties exist
      return parsedPrices
        .filter(price => 
          price && 
          typeof price === 'object' && 
          price.supplier_name && 
          typeof price.supplier_name === 'string' &&
          'price_quoted' in price &&
          typeof price.price_quoted === 'number',
        )
        .map(price => ({
          supplier_name: price.supplier_name,
          price_quoted: price.price_quoted,
          response_date: price.response_date ? new Date(price.response_date) : new Date(),
          status: price.status || 'unknown',
          is_promotion: Boolean(price.is_promotion),
          promotion_name: price.promotion_name || '',
          price_change: price.price_change || 0,
        }));
    } catch (e) {
      console.error('Error processing supplier prices:', e);
      return [];
    }
  };

  // Process reference change data
  const processReferenceChange = (data) => {
    if (!data) return null;
    try {
      // Handle reference_change whether it's a string or object
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (!parsed || typeof parsed !== 'object') return null;

      return {
        original_item_id: parsed.original_item_id,
        new_reference_id: parsed.new_reference_id,
        supplier_name: parsed.supplier_name || '',
        change_date: parsed.change_date ? new Date(parsed.change_date) : new Date(),
        notes: parsed.notes || '',
        changed_by_user: Boolean(parsed.changed_by_user),
        source: parsed.supplier_name ? 'supplier' : 'user',
        new_description: parsed.new_description || '',
        new_english_description: parsed.new_english_description || '',
      };
    } catch (e) {
      console.error('Error processing reference change:', e);
      return null;
    }
  };

  // Process referencing items
  const processReferencingItems = (data) => {
    if (!data) return [];
    try {
      // Handle referencing_items whether it's a string or array
      return typeof data === 'string' ? data.split(',') : Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error processing referencing items:', e);
      return [];
    }
  };

  // Fetch item data function
  const fetchFullItemData = useCallback(async () => {
    if (!open || !item?.item_id) return;

    try {
      setLoading(true);
      dataDebug.log('Fetching full item data for:', item.item_id);

      const [
        itemDetailsResponse,
        priceHistoryResponse,
        supplierPricesResponse,
        referenceChangesResponse,
      ] = await Promise.all([
        axiosInstance.get(`/api/items/${item.item_id}`),
        axiosInstance.get(`/api/items/${item.item_id}/price-history`),
        axiosInstance.get(`/api/items/${item.item_id}/supplier-prices`),
        axiosInstance.get(`/api/items/${item.item_id}/reference-changes`),
      ]);

      // Process supplier prices immediately when setting full item data
      const processedSupplierPrices = processSupplierPrices(supplierPricesResponse.data);

      setFullItemData({
        details: itemDetailsResponse.data,
        priceHistory: priceHistoryResponse.data,
        supplierPrices: processedSupplierPrices,
        referenceChanges: referenceChangesResponse.data,
      });

      setError(null);
    } catch (err) {
      console.error('Error fetching item data:', err);
      setError(err.response?.data?.message || 'Error loading item data');
    } finally {
      setLoading(false);
    }
  }, [open, item?.item_id]);

  // Fetch complete item data when dialog opens
  useEffect(() => {
    if (mode === 'edit') {
      fetchFullItemData();
    }
  }, [fetchFullItemData, mode]);

  // Process item data based on mode
  const itemData = useMemo(() => {
    if (!open) {
      return null;
    }

    try {
      // Use either fetched data or initial item data
      const details = fullItemData?.details || item || {};
      const priceHistory = fullItemData?.priceHistory || [];
      const supplierPrices = fullItemData?.supplierPrices || (item && item.supplier_prices ? processSupplierPrices(item.supplier_prices) : []);
      const referenceChanges = fullItemData?.referenceChanges || [];

      dataDebug.logData('Processing item data', { details, mode });

      // Process reference data
      const referenceChange = processReferenceChange(details.reference_change);
      const referencingItems = processReferencingItems(details.referencing_items);
      const hasReferenceChange = Boolean(referenceChange);
      const isReferencedBy = referencingItems.length > 0;

      // Base item details using snake_case consistently
      const baseDetails = {
        item_id: details.item_id || '',
        hebrew_description: details.hebrew_description || '',
        english_description: details.english_description || '',
        import_markup: parseFloat(details.import_markup) || 1.30,
        hs_code: details.hs_code || '',
        image: details.image,
        notes: details.notes || '',
        origin: details.origin || '',
        retail_price: details.retail_price !== null ? parseFloat(details.retail_price) : null,
        qty_in_stock: parseInt(details.qty_in_stock) || 0,
        sold_this_year: parseInt(details.sold_this_year) || 0,
        sold_last_year: parseInt(details.sold_last_year) || 0,
        last_updated: details.last_updated,
        last_price_update: details.last_price_update,
        reference_change: referenceChange,
        referencing_items: referencingItems,
        has_reference_change: hasReferenceChange,
        is_referenced_by: isReferencedBy,
      };

      // Process price history
      const processedPriceHistory = (priceHistory || [])
        .filter(record => record !== null)
        .map(record => ({
          date: new Date(record.date),
          retail_price: record.ils_retail_price,
          qty_in_stock: record.qty_in_stock,
          sold_this_year: record.sold_this_year,
          sold_last_year: record.sold_last_year,
        }));

      // Process reference changes - Keep snake_case to match API response
      const processedReferenceChanges = (referenceChanges || [])
        .filter(change => {
          // Ensure change object exists and has required properties
          if (!change || typeof change !== 'object') return false;
          return true;
        })
        .map(change => ({
          original_item_id: change.original_item_id,
          new_reference_id: change.new_reference_id,
          supplier_name: change.supplier_name || '',
          change_date: change.change_date ? new Date(change.change_date) : new Date(),
          notes: change.notes || '',
          changed_by_user: Boolean(change.changed_by_user),
          source: change.supplier_name ? 'supplier' : 'user',
        }));

      // For edit mode, return form-ready data
      if (mode === 'edit') {
        return {
          ...baseDetails,
          supplierPrices,
        };
      }

      // For view mode, include all data
      return {
        itemDetails: baseDetails,
        priceHistory: processedPriceHistory,
        supplierPrices,
        referenceChanges: processedReferenceChanges,
        hasReferenceChange,
        isReferencedBy,
        getChangeSource: inventoryUtils.getChangeSource,
        getBackgroundColor: () => inventoryUtils.getBackgroundColor(details),
      };

    } catch (err) {
      console.error('Error processing item data:', err);
      setError('Error processing item data');
      return null;
    }
  }, [fullItemData, open, mode, item]);

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

  // Function to refresh item data
  const refreshItemData = useCallback(() => {
    fetchFullItemData();
  }, [fetchFullItemData]);

  return {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError,
    error,
    refreshItemData,
  };
};
