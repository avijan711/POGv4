import { useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '../config';
import { dataDebug, perfDebug } from '../utils/debug';
import { InquiryItem, SupplierResponse } from '../types/inquiry';

interface RawSupplierResponse {
  supplier_id?: string;
  supplier_name?: string;
  price_quoted?: number;
  response_date?: string;
  status?: string;
  is_promotion?: boolean;
  promotion_name?: string;
  notes?: string;
}

interface RawReferenceChange {
  source: 'supplier' | 'user' | 'inquiry_item';
  supplier_name?: string;
  change_date: string;
  notes?: string;
  new_reference_id: string;
  changeId?: string;
  changed_by_user?: boolean;
}

interface RawInquiryItem {
  item_id?: string;
  original_item_id?: string;
  hebrew_description?: string;
  english_description?: string;
  import_markup?: number;
  hs_code?: string;
  retail_price?: number;
  qty_in_stock?: number;
  requested_qty?: number;
  reference_change?: string | RawReferenceChange;
  has_reference_change?: string | boolean;
  is_referenced_by?: string | boolean;
  referencing_items?: string | any[];
  excel_row_index?: number;
  inquiry_item_id?: string;
  promotion_id?: string | null;
  promotion_name?: string;
  promotion_price?: number | null;
  promotion_start_date?: string | null;
  promotion_end_date?: string | null;
  supplier_responses?: string | RawSupplierResponse[];
  [key: string]: any;
}

interface InquiryData {
  status?: string;
  date?: string;
}

interface ApiResponse {
  inquiry: string | InquiryData;
  items?: string | RawInquiryItem[];
}

export const useInquiryItems = (inquiryId: string) => {
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [inquiryStatus, setInquiryStatus] = useState<string>('');
  const [inquiryDate, setInquiryDate] = useState<string>('');

  const processSupplierResponses = (responses: string | RawSupplierResponse[] | undefined): SupplierResponse[] => {
    if (!responses) return [];

    try {
      // Parse string responses if needed
      let parsedResponses: RawSupplierResponse[] = typeof responses === 'string' ? JSON.parse(responses) : responses;
      
      // Ensure we have an array
      if (!Array.isArray(parsedResponses)) {
        return [];
      }

      // Filter and process each response
      return parsedResponses
        .filter((response): response is Required<RawSupplierResponse> => 
          Boolean(response) && 
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
      const response = await axios.get<ApiResponse>(`${API_BASE_URL}/api/inquiries/${inquiryId}`);
      dataDebug.log('Fetch response:', response.data);
      
      let inquiryData: InquiryData = typeof response.data.inquiry === 'string' 
        ? JSON.parse(response.data.inquiry)
        : response.data.inquiry;

      let itemsData: RawInquiryItem[] = typeof response.data.items === 'string'
        ? JSON.parse(response.data.items)
        : response.data.items || [];

      // Ensure itemsData is an array
      if (!Array.isArray(itemsData)) {
        console.warn('Items data is not an array:', itemsData);
        itemsData = [];
      }

      // Track duplicates if not already tracked
      const itemIdCounts: Record<string, number> = {};
      const itemIdFirstIndex: Record<string, number> = {};
      itemsData.forEach((item, index) => {
        if (!item || !item.item_id) return;
        itemIdCounts[item.item_id] = (itemIdCounts[item.item_id] || 0) + 1;
        if (itemIdCounts[item.item_id] === 1) {
          itemIdFirstIndex[item.item_id] = index;
        }
      });
      
      const itemsWithDetails = itemsData.map((item, index) => {
        if (!item) return null;

        // Handle reference_change
        let reference_change: RawReferenceChange | null = null;
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
        let referencing_items: any[] = [];
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
        const itemId = item.item_id || '';
        const is_duplicate = Boolean(itemId && itemIdCounts[itemId] > 1 && index !== itemIdFirstIndex[itemId]);
        const original_row_index = is_duplicate ? itemIdFirstIndex[itemId] : null;

        // Handle promotion data
        const promotion_id = item.promotion_id || null;
        const promotion_name = item.promotion_name || '';
        const promotion_price = item.promotion_price || null;
        const promotion_start_date = item.promotion_start_date || null;
        const promotion_end_date = item.promotion_end_date || null;
        
        const processedItem: InquiryItem = {
          inquiryItemID: item.inquiry_item_id || '',
          itemID: itemId,
          item_id: itemId,
          original_item_id: item.original_item_id || itemId,
          hebrewDescription: item.hebrew_description || '',
          englishDescription: item.english_description || '',
          importMarkup: item.import_markup || 0,
          hsCode: item.hs_code || '',
          retailPrice: item.retail_price || 0,
          qtyInStock: item.qty_in_stock || 0,
          requestedQty: item.requested_qty || 0,
          referenceChange: reference_change ? {
            ...reference_change,
            source: reference_change.source || (reference_change.changed_by_user ? 'user' : 'supplier'),
            change_date: reference_change.change_date || new Date().toISOString(),
          } : undefined,
          hasReferenceChange: has_reference_change,
          isReferencedBy: is_referenced_by,
          referencingItems: referencing_items,
          status: inquiryData.status || 'New',
          date: inquiryData.date || new Date().toISOString(),
          excelRowIndex: item.excel_row_index || index,
          isDuplicate: is_duplicate,
          originalRowIndex: original_row_index,
          promotionId: promotion_id,
          promotionName: promotion_name,
          promotionPrice: promotion_price,
          promotionStartDate: promotion_start_date,
          promotionEndDate: promotion_end_date,
          supplierResponses: supplier_responses,
          supplierResponseId: item.supplier_response_id,
          isReplacement: Boolean(item.is_replacement),
          inquiryNumber: item.inquiry_number,
          customNumber: item.custom_number,
        };

        return processedItem;
      }).filter((item): item is InquiryItem => item !== null);

      // Sort by Excel row index by default
      const sortedItems = [...itemsWithDetails].sort((a, b) => 
        (a.excelRowIndex || 0) - (b.excelRowIndex || 0),
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
      if ((err as AxiosError)?.response?.status === 404) {
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

  const handleUpdateQuantity = async (inquiryItemId: string, newQty: number): Promise<boolean> => {
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

  const handleDeleteItem = async (itemToDelete: InquiryItem): Promise<boolean> => {
    if (!itemToDelete) return false;

    try {
      dataDebug.log('Deleting item:', itemToDelete.inquiryItemID);
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

  const handleAddItem = async (itemData: FormData): Promise<boolean> => {
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