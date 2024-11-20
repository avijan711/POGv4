import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { dataDebug, perfDebug } from '../utils/debug';

export const useInquiryItems = (inquiryId) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inquiryStatus, setInquiryStatus] = useState('');
  const [inquiryDate, setInquiryDate] = useState('');

  const fetchItems = useCallback(async () => {
    if (!inquiryId) return;
    
    const timerId = `fetchInquiries_${inquiryId}`;
    try {
      setLoading(true);
      setError('');
      perfDebug.time(timerId);
      
      console.log('Fetching inquiry items for ID:', inquiryId);
      const response = await axios.get(`${API_BASE_URL}/api/inquiries/${inquiryId}`);
      console.log('Fetch response:', response.data);
      
      let inquiryData = response.data.inquiry;
      let itemsData = response.data.items || [];

      // Handle different response formats
      if (typeof inquiryData === 'string') {
        try {
          inquiryData = JSON.parse(inquiryData);
        } catch (e) {
          console.error('Error parsing inquiry data:', e);
          inquiryData = {
            status: 'New',
            date: new Date().toISOString()
          };
        }
      }

      if (typeof itemsData === 'string') {
        try {
          itemsData = JSON.parse(itemsData);
        } catch (e) {
          console.error('Error parsing items data:', e);
          itemsData = [];
        }
      }

      // Ensure itemsData is an array
      if (!Array.isArray(itemsData)) {
        console.warn('Items data is not an array:', itemsData);
        itemsData = [];
      }

      // Track duplicates if not already tracked
      const itemIdCounts = {};
      const itemIdFirstIndex = {};
      itemsData.forEach((item, index) => {
        if (!item) return;
        const itemId = item.itemID;
        if (itemId) {
          itemIdCounts[itemId] = (itemIdCounts[itemId] || 0) + 1;
          if (itemIdCounts[itemId] === 1) {
            itemIdFirstIndex[itemId] = index;
          }
        }
      });
      
      const itemsWithDetails = itemsData.map((item, index) => {
        if (!item) return null;

        // Handle referenceChange
        let referenceChange = null;
        if (item.referenceChange && item.referenceChange !== 'null') {
          if (typeof item.referenceChange === 'string') {
            try {
              referenceChange = JSON.parse(item.referenceChange);
            } catch (e) {
              console.error('Error parsing referenceChange:', e);
            }
          } else if (typeof item.referenceChange === 'object') {
            referenceChange = item.referenceChange;
          }
        }

        // Handle referencingItems
        let referencingItems = [];
        if (item.referencingItems && item.referencingItems !== '[]') {
          if (typeof item.referencingItems === 'string') {
            try {
              referencingItems = JSON.parse(item.referencingItems);
            } catch (e) {
              console.error('Error parsing referencingItems:', e);
            }
          } else if (Array.isArray(item.referencingItems)) {
            referencingItems = item.referencingItems;
          }
        }

        // Determine if item has reference changes
        const hasReferenceChange = Boolean(
          item.newReferenceID || 
          (referenceChange && referenceChange.newReferenceID) ||
          (item.hasReferenceChange && item.hasReferenceChange !== '0')
        );

        // Determine if item is referenced by others
        const isReferencedBy = Boolean(
          referencingItems.length > 0 ||
          (item.isReferencedBy && item.isReferencedBy !== '0')
        );

        // Determine if item is a duplicate
        const isDuplicate = item.itemID && itemIdCounts[item.itemID] > 1 && index !== itemIdFirstIndex[item.itemID];
        const originalRowIndex = isDuplicate ? itemIdFirstIndex[item.itemID] : null;

        // Handle promotion data
        const promotion_id = item.promotion_id || null;
        const promotion_name = item.promotion_name || '';
        const promotion_price = item.promotion_price || null;
        const promotion_start_date = item.promotion_start_date || null;
        const promotion_end_date = item.promotion_end_date || null;
        
        return {
          ...item,
          itemID: item.itemID || '',
          originalItemID: item.originalItemID || item.itemID || '',
          hebrewDescription: item.hebrewDescription || '',
          englishDescription: item.englishDescription || '',
          importMarkup: item.importMarkup || 0,
          hsCode: item.hsCode || '',
          retailPrice: item.retailPrice || 0,
          qtyInStock: item.qtyInStock || 0,
          requestedQty: item.requestedQty || 0,
          referenceChange: referenceChange ? {
            ...referenceChange,
            source: referenceChange.source || (referenceChange.changedByUser ? 'user' : 'supplier')
          } : null,
          hasReferenceChange,
          isReferencedBy,
          referencingItems,
          status: inquiryData.status || 'New',
          date: inquiryData.date || new Date().toISOString(),
          // Add Excel order and duplicate tracking
          excelRowIndex: item.excelRowIndex || index,
          isDuplicate,
          originalRowIndex,
          // Add promotion data
          promotion_id,
          promotion_name,
          promotion_price,
          promotion_start_date,
          promotion_end_date
        };
      }).filter(Boolean); // Remove any null items

      // Sort by Excel row index by default
      const sortedItems = [...itemsWithDetails].sort((a, b) => 
        (a.excelRowIndex || 0) - (b.excelRowIndex || 0)
      );

      if (sortedItems && sortedItems.length > 0) {
        console.log('Setting items:', sortedItems.length);
        setItems(sortedItems);
        setInquiryStatus(inquiryData.status || 'New');
        setInquiryDate(new Date(inquiryData.date || new Date()).toLocaleDateString());
      } else {
        console.log('No items found');
        setItems([]);
        setInquiryStatus('New');
        setInquiryDate(new Date().toLocaleDateString());
      }

      dataDebug.log('Fetched inquiries:', sortedItems.length);
      setError('');
    } catch (err) {
      console.error('Error fetching inquiry items:', err);
      if (err.response?.status === 404) {
        setError('Inquiry not found. It may have been deleted.');
        setItems([]);
      } else {
        setError('Failed to load inquiry items. Please try again later.');
      }
    } finally {
      perfDebug.timeEnd(timerId);
      setLoading(false);
    }
  }, [inquiryId]);

  const handleUpdateQuantity = async (inquiryItemId, newQty) => {
    try {
      console.log('Updating quantity:', { inquiryItemId, newQty });
      await axios.put(`${API_BASE_URL}/api/inquiries/inquiry-items/${inquiryItemId}/quantity`, {
        requestedQty: newQty
      });
      console.log('Quantity update successful');
      await fetchItems();
      setError('');
      return true;
    } catch (error) {
      console.error('Error updating quantity:', error);
      setError('Failed to update quantity. Please try again.');
      return false;
    }
  };

  const handleDeleteItem = async (itemToDelete) => {
    if (!itemToDelete) return false;

    try {
      console.log('Deleting item:', itemToDelete.inquiryItemID);
      await axios.delete(`${API_BASE_URL}/api/inquiries/inquiry-items/${itemToDelete.inquiryItemID}`);
      await fetchItems();
      setError('');
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item. Please try again.');
      return false;
    }
  };

  return {
    items,
    loading,
    error,
    inquiryStatus,
    inquiryDate,
    fetchItems,
    handleUpdateQuantity,
    handleDeleteItem,
    setError
  };
};
