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

  const processSupplierResponses = (responses) => {
    if (!responses) return [];

    try {
      // Parse string responses if needed
      let parsedResponses = typeof responses === 'string' ? JSON.parse(responses) : responses;
      
      // Ensure we have an array
      if (!Array.isArray(parsedResponses)) {
        return [];
      }

      // Filter and process each response
      return parsedResponses
        .filter(response => 
          response && 
          typeof response === 'object' && 
          'supplier_name' in response && 
          'price_quoted' in response,
        )
        .map(response => ({
          supplier_id: response.supplier_id,
          supplier_name: response.supplier_name || 'Unknown Supplier',
          price_quoted: response.price_quoted || 0,
          response_date: response.response_date ? new Date(response.response_date) : new Date(),
          status: response.status || 'unknown',
          is_promotion: Boolean(response.is_promotion),
          promotion_name: response.promotion_name || '',
          notes: response.notes || '',
        }));
    } catch (e) {
      console.error('Error processing supplier responses:', e);
      return [];
    }
  };

  const fetchItems = useCallback(async () => {
    // Don't fetch if no ID is provided
    if (!inquiryId) {
      setLoading(false);
      setItems([]);
      setError('');
      return;
    }
    
    const timerId = `fetchInquiries_${inquiryId}`;
    try {
      setLoading(true);
      setError('');
      perfDebug.time(timerId);
      
      dataDebug.log('Fetching inquiry items for ID:', inquiryId);
      const response = await axios.get(`${API_BASE_URL}/api/inquiries/${inquiryId}`);
      dataDebug.log('Fetch response:', response.data);
      
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
            date: new Date().toISOString(),
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
        const itemId = item.item_id;
        if (itemId) {
          itemIdCounts[itemId] = (itemIdCounts[itemId] || 0) + 1;
          if (itemIdCounts[itemId] === 1) {
            itemIdFirstIndex[itemId] = index;
          }
        }
      });
      
      const itemsWithDetails = itemsData.map((item, index) => {
        if (!item) return null;

        // Handle reference_change
        let reference_change = null;
        if (item.reference_change && item.reference_change !== 'null') {
          if (typeof item.reference_change === 'string') {
            try {
              reference_change = JSON.parse(item.reference_change);
            } catch (e) {
              console.error('Error parsing reference_change:', e);
            }
          } else if (typeof item.reference_change === 'object') {
            reference_change = item.reference_change;
          }
        }

        // Handle referencing_items
        let referencing_items = [];
        if (item.referencing_items && item.referencing_items !== '[]') {
          if (typeof item.referencing_items === 'string') {
            try {
              referencing_items = JSON.parse(item.referencing_items);
            } catch (e) {
              console.error('Error parsing referencing_items:', e);
            }
          } else if (Array.isArray(item.referencing_items)) {
            referencing_items = item.referencing_items;
          }
        }

        // Process supplier responses using the dedicated function
        const supplier_responses = processSupplierResponses(item.supplier_responses);

        // Determine if item has reference changes
        const has_reference_change = Boolean(
          item.new_reference_id || 
          (reference_change && reference_change.new_reference_id) ||
          (item.has_reference_change && item.has_reference_change !== '0'),
        );

        // Determine if item is referenced by others
        const is_referenced_by = Boolean(
          referencing_items.length > 0 ||
          (item.is_referenced_by && item.is_referenced_by !== '0'),
        );

        // Determine if item is a duplicate
        const is_duplicate = item.item_id && itemIdCounts[item.item_id] > 1 && index !== itemIdFirstIndex[item.item_id];
        const original_row_index = is_duplicate ? itemIdFirstIndex[item.item_id] : null;

        // Handle promotion data
        const promotion_id = item.promotion_id || null;
        const promotion_name = item.promotion_name || '';
        const promotion_price = item.promotion_price || null;
        const promotion_start_date = item.promotion_start_date || null;
        const promotion_end_date = item.promotion_end_date || null;
        
        return {
          ...item,
          item_id: item.item_id || '',
          original_item_id: item.original_item_id || item.item_id || '',
          hebrew_description: item.hebrew_description || '',
          english_description: item.english_description || '',
          import_markup: item.import_markup || 0,
          hs_code: item.hs_code || '',
          retail_price: item.retail_price || 0,
          qty_in_stock: item.qty_in_stock || 0,
          requested_qty: item.requested_qty || 0,
          reference_change: reference_change ? {
            ...reference_change,
            source: reference_change.source || (reference_change.changed_by_user ? 'user' : 'supplier'),
          } : null,
          has_reference_change,
          is_referenced_by,
          referencing_items,
          status: inquiryData.status || 'New',
          date: inquiryData.date || new Date().toISOString(),
          // Add Excel order and duplicate tracking
          excel_row_index: item.excel_row_index || index,
          is_duplicate,
          original_row_index,
          // Add promotion data
          promotion_id,
          promotion_name,
          promotion_price,
          promotion_start_date,
          promotion_end_date,
          // Add supplier responses
          supplier_responses,
        };
      }).filter(Boolean); // Remove any null items

      // Sort by Excel row index by default
      const sortedItems = [...itemsWithDetails].sort((a, b) => 
        (a.excel_row_index || 0) - (b.excel_row_index || 0),
      );

      if (sortedItems && sortedItems.length > 0) {
        dataDebug.log('Setting items:', sortedItems.length);
        setItems(sortedItems);
        setInquiryStatus(inquiryData.status || 'New');
        setInquiryDate(new Date(inquiryData.date || new Date()).toLocaleDateString());
      } else {
        dataDebug.log('No items found');
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
      dataDebug.log('Updating quantity:', { inquiryItemId, newQty });
      await axios.put(`${API_BASE_URL}/api/inquiries/inquiry-items/${inquiryItemId}/quantity`, {
        requested_qty: newQty,
      });
      dataDebug.log('Quantity update successful');
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
      dataDebug.log('Deleting item:', itemToDelete.inquiry_item_id);
      await axios.delete(`${API_BASE_URL}/api/inquiries/inquiry-items/${itemToDelete.inquiry_item_id}`);
      await fetchItems();
      setError('');
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item. Please try again.');
      return false;
    }
  };

  const handleAddItem = async (itemData) => {
    if (!inquiryId) return false;

    try {
      dataDebug.log('Adding item to inquiry:', { inquiryId, itemData });
      await axios.post(`${API_BASE_URL}/api/inquiries/${inquiryId}/items`, itemData);
      await fetchItems();
      setError('');
      return true;
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add item. Please try again.');
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
    handleAddItem,
    setError,
  };
};
