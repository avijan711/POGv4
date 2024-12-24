import { useState, useCallback } from 'react';
import { dataDebug } from '../utils/debug';
import inventoryUtils from '../utils/inventoryUtils';
import axiosInstance from '../utils/axiosConfig';

/**
 * Custom hook for managing inventory data and operations
 */
export const useInventoryData = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  /**
     * Process items to ensure reference data is properly handled
     */
  const processItems = (rawItems) => {
    // Filter out invalid items first
    return rawItems
      .filter(item => {
        // Validate item_id
        if (!item?.item_id || typeof item.item_id !== 'string' || !item.item_id.trim()) {
          dataDebug.warn('Filtered out invalid item:', item);
          return false;
        }
        return true;
      })
      .map(item => {
        // Parse reference_change if it's a string
        let referenceChange = null;
        try {
          referenceChange = item.reference_change ? 
            (typeof item.reference_change === 'string' ? 
              JSON.parse(item.reference_change) : 
              item.reference_change) : 
            null;
        } catch (e) {
          console.error('Error parsing reference_change:', e);
        }

        // Convert boolean-like values to actual booleans
        const hasReferenceChange = Boolean(item.has_reference_change) || 
                    (referenceChange && Object.keys(referenceChange).length > 0);
        const isReferencedBy = Boolean(item.is_referenced_by);

        // Get referencing items
        let referencingItems = [];
        if (item.referencing_items) {
          try {
            // Handle both string and array formats
            const referencingIds = Array.isArray(item.referencing_items) ? 
              item.referencing_items : 
              item.referencing_items.split(',');
                        
            referencingItems = rawItems.filter(otherItem => 
              referencingIds.includes(otherItem.item_id),
            );
          } catch (e) {
            console.error('Error processing referencing_items:', e);
          }
        }

        // Process reference data
        const processedItem = {
          ...item,
          reference_change: referenceChange,
          has_reference_change: hasReferenceChange,
          is_referenced_by: isReferencedBy,
          referencing_items: referencingItems,
        };

        // Debug log the processed item
        dataDebug.log('Processed item:', {
          itemId: item.item_id,
          hasReferenceChange,
          isReferencedBy,
          referenceChange,
          referencingItemsCount: referencingItems.length,
        });

        return processedItem;
      });
  };

  /**
     * Fetch all inventory items
     */
  const fetchItems = useCallback(async () => {
    try {
      dataDebug.log('Fetching inventory items');
      const response = await axiosInstance.get('/api/items');
      const processedItems = processItems(response.data);
      dataDebug.log('Processed items:', processedItems);
      setItems(processedItems);
      setError('');
    } catch (err) {
      dataDebug.error('Error fetching items:', err);
      setError('Failed to load inventory items. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
     * Save item (create or update)
     * @param {FormData} itemData - Form data for item
     * @param {string} mode - 'add' or 'edit'
     */
  const saveItem = async (itemData, mode) => {
    try {
      dataDebug.log('Saving item:', itemData.get('item_id'), {
        mode,
        referenceId: itemData.get('reference_id'),
        hebrewDescription: itemData.get('hebrew_description'),
      });

      if (mode === 'add') {
        const response = await axiosInstance.post('/api/items', itemData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        dataDebug.log('Item created:', response.data);
      } else {
        const response = await axiosInstance.put(`/api/items/${itemData.get('item_id')}`, itemData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        dataDebug.log('Item updated:', response.data);
      }
      await fetchItems();
      setError('');
      return true;
    } catch (error) {
      dataDebug.error('Error saving item:', error);
      if (error.response?.data?.error) {
        // Use the server's error message if available
        setError(`${error.response.data.error}: ${error.response.data.details}`);
      } else {
        setError('Failed to save item. Please try again.');
      }
      return false;
    }
  };

  /**
     * Delete item
     * @param {string} itemId - ID of item to delete
     */
  const deleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return false;
    }

    try {
      dataDebug.log('Deleting item:', itemId);
      await axiosInstance.delete(`/api/items/${itemId}`);
      await fetchItems();
      return true;
    } catch (error) {
      dataDebug.error('Error deleting item:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete item. Please try again.';
      setError(errorMessage);
      return false;
    }
  };

  /**
     * Load item details
     * @param {Object} item - Item to load details for
     */
  const loadItemDetails = async (item) => {
    try {
      // Validate item ID
      if (!item?.item_id || !item.item_id.trim()) {
        setError('Invalid item ID');
        return false;
      }

      dataDebug.log('Loading item details for:', item.item_id);
      setLoadingDetails(true);
            
      const response = await axiosInstance.get(`/api/items/${item.item_id}`);
      const rawData = response.data;
            
      // Parse reference_change if it's a string
      let referenceChange = null;
      try {
        referenceChange = rawData.reference_change ? 
          (typeof rawData.reference_change === 'string' ? 
            JSON.parse(rawData.reference_change) : 
            rawData.reference_change) : 
          null;
      } catch (e) {
        console.error('Error parsing reference_change:', e);
      }

      // Process the item details
      const processedData = {
        ...rawData,
        reference_change: referenceChange,
        has_reference_change: Boolean(rawData.has_reference_change) || 
                    (referenceChange && Object.keys(referenceChange).length > 0),
        is_referenced_by: Boolean(rawData.is_referenced_by),
        referencing_items: rawData.referencing_items ? 
          items.filter(otherItem => 
            rawData.referencing_items.split(',').includes(otherItem.item_id),
          ) : [],
      };
            
      dataDebug.logData('Processed item details', processedData);
      setItemDetails(processedData);
      setError('');
      return true;
    } catch (error) {
      dataDebug.error('Error loading item details:', error);
      if (error.response?.status === 404) {
        setError(`Item ${item.item_id} not found. It may have been deleted.`);
      } else {
        setError('Failed to load item details. Please try again.');
      }
      return false;
    } finally {
      setLoadingDetails(false);
    }
  };

  /**
     * Clear selected item and error state
     */
  const clearSelection = useCallback(() => {
    setSelectedItem(null);
    setItemDetails(null);
    setError('');
  }, []);

  return {
    // State
    items,
    loading,
    error,
    selectedItem,
    itemDetails,
    loadingDetails,

    // Actions
    fetchItems,
    saveItem,
    deleteItem,
    loadItemDetails,
    setSelectedItem,
    clearSelection,
    setError,
  };
};

export default useInventoryData;
