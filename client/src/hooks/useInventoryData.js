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
        return rawItems.map(item => {
            // No need to parse reference_change as it's already a JSON object from server
            const referenceChange = item.reference_change;
            const hasReferenceChange = item.has_reference_change === 1;
            const isReferencedBy = item.is_referenced_by === 1;

            // Get referencing items from the referencing_items string if it exists
            let referencingItems = [];
            if (item.referencing_items) {
                const referencingIds = item.referencing_items.split(',');
                referencingItems = rawItems.filter(otherItem => 
                    referencingIds.includes(otherItem.item_id)
                );
            }

            return {
                ...item,
                reference_change: referenceChange,
                has_reference_change: hasReferenceChange,
                is_referenced_by: isReferencedBy,
                referencing_items: referencingItems,
                // Add background color based on reference status
                backgroundColor: hasReferenceChange ? 
                    'rgba(244, 67, 54, 0.1)' :  // Light red for items with reference changes
                    isReferencedBy ? 
                        'rgba(76, 175, 80, 0.1)' :  // Light green for items referenced by others
                        'inherit'
            };
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
            dataDebug.log('Saving item:', itemData.get('item_id'));
            if (mode === 'add') {
                await axiosInstance.post('/api/items', itemData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await axiosInstance.put(`/api/items/${itemData.get('item_id')}`, itemData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            await fetchItems();
            setError('');
            return true;
        } catch (error) {
            dataDebug.error('Error saving item:', error);
            setError('Failed to save item. Please try again.');
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
            dataDebug.log('Loading item details for:', item.item_id);
            setLoadingDetails(true);
            
            const response = await axiosInstance.get(`/api/items/${item.item_id}`);
            const rawData = response.data;
            
            // Process the item details
            const processedData = {
                ...rawData,
                reference_change: rawData.reference_change,
                has_reference_change: rawData.has_reference_change === 1,
                is_referenced_by: rawData.is_referenced_by === 1,
                referencing_items: rawData.referencing_items ? 
                    items.filter(otherItem => 
                        rawData.referencing_items.split(',').includes(otherItem.item_id)
                    ) : []
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
        setError
    };
};

export default useInventoryData;
