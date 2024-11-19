import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { dataDebug } from '../utils/debug';
import inventoryUtils from '../utils/inventoryUtils';

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
     * Process items to ensure reference data is properly parsed and filtered
     */
    const processItems = (rawItems) => {
        return rawItems.map(item => {
            // Parse referenceChange if it's a string
            const referenceChange = item.referenceChange ? 
                (typeof item.referenceChange === 'string' ? 
                    JSON.parse(item.referenceChange) : 
                    item.referenceChange) : null;

            // Check for self-references
            const isSelfReferenced = referenceChange && 
                referenceChange.newReferenceID === item.itemID;

            // Find items that reference this item (excluding self-references)
            const referencingItems = rawItems.filter(otherItem => {
                const otherRef = otherItem.referenceChange ? 
                    (typeof otherItem.referenceChange === 'string' ? 
                        JSON.parse(otherItem.referenceChange) : 
                        otherItem.referenceChange) : null;
                return otherRef && 
                       otherRef.newReferenceID === item.itemID && 
                       otherItem.itemID !== item.itemID;
            });

            return {
                ...item,
                referenceChange: isSelfReferenced ? null : referenceChange,
                hasReferenceChange: !isSelfReferenced && referenceChange !== null,
                isReferencedBy: referencingItems.length > 0,
                referencingItems
            };
        });
    };

    /**
     * Fetch all inventory items
     */
    const fetchItems = useCallback(async () => {
        try {
            dataDebug.log('Fetching inventory items');
            const response = await axios.get(`${API_BASE_URL}/api/items`);
            const processedItems = processItems(response.data);
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
            dataDebug.log('Saving item:', itemData.get('itemID'));
            if (mode === 'add') {
                await axios.post(`${API_BASE_URL}/api/items`, itemData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await axios.put(`${API_BASE_URL}/api/items/${itemData.get('itemID')}`, itemData, {
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
            await axios.delete(`${API_BASE_URL}/api/items/${itemId}`);
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
            dataDebug.log('Loading item details for:', item.itemID);
            setLoadingDetails(true);
            
            const response = await axios.get(`${API_BASE_URL}/api/items/${item.itemID}`);
            const rawData = response.data;
            
            // Process the item details to ensure references are parsed and filtered
            const processedData = {
                ...rawData,
                referenceChange: rawData.referenceChange ? 
                    (typeof rawData.referenceChange === 'string' ? 
                        JSON.parse(rawData.referenceChange) : 
                        rawData.referenceChange) : null,
                referencingItems: items.filter(otherItem => {
                    const otherRef = otherItem.referenceChange ? 
                        (typeof otherItem.referenceChange === 'string' ? 
                            JSON.parse(otherItem.referenceChange) : 
                            otherItem.referenceChange) : null;
                    return otherRef && 
                           otherRef.newReferenceID === item.itemID && 
                           otherItem.itemID !== item.itemID;
                })
            };

            // Check for self-references
            if (processedData.referenceChange && 
                processedData.referenceChange.newReferenceID === item.itemID) {
                processedData.referenceChange = null;
                processedData.hasReferenceChange = false;
            }
            
            dataDebug.logData('Processed item details', processedData);
            setItemDetails(processedData);
            setError('');
            return true;
        } catch (error) {
            dataDebug.error('Error loading item details:', error);
            if (error.response?.status === 404) {
                setError(`Item ${item.itemID} not found. It may have been deleted.`);
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
