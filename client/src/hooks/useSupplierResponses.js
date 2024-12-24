import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export const useSupplierResponses = (inquiryId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [responses, setResponses] = useState({});
  const [stats, setStats] = useState({
    total_responses: 0,
    total_items: 0,
    total_suppliers: 0,
    responded_items: 0,
    missing_responses: 0,
  });

  // Use a ref to track if we're already fetching
  const fetchingRef = useRef(false);

  const fetchResponses = useCallback(async () => {
    if (!inquiryId || fetchingRef.current) return;

    try {
      setLoading(true);
      setError(null);
      fetchingRef.current = true;

      console.log('Fetching responses for inquiry:', inquiryId);
      const response = await axios.get(`${API_BASE_URL}/api/supplier-responses/inquiry/${inquiryId}`);
      const responseData = response.data;

      // Log the raw response data
      console.log('Raw API response:', {
        data: responseData.data,
        stats: responseData.stats,
        firstSupplier: responseData.data[Object.keys(responseData.data)[0]],
      });

      // Validate response structure
      if (!responseData) {
        throw new Error('No response data received');
      }

      // Extract data and stats from response
      const supplierData = responseData.data || {};
      const serverStats = responseData.stats || {};

      // Log the extracted data
      console.log('Extracted data:', {
        supplierData,
        serverStats,
        firstSupplierRaw: supplierData[Object.keys(supplierData)[0]],
      });

      // Process supplier data
      const processedSupplierData = Object.entries(supplierData).reduce((acc, [supplierId, data]) => {
        console.log(`Processing supplier ${supplierId}:`, {
          rawData: data,
          hasResponses: !!data.responses,
          hasMissingItems: !!data.missing_items,
          itemCount: data.total_items,
          missingCount: data.missing_count,
          responsesType: typeof data.responses,
          missingItemsType: typeof data.missing_items,
          rawResponses: data.responses,
          rawMissingItems: data.missing_items,
        });

        // Get counts from server data
        const item_count = data.total_items || 0;
        const missing_count = data.missing_count || 0;
        const total_expected = serverStats.totalItems || 0;

        // Parse responses if needed
        let responses = [];
        if (data.responses) {
          if (Array.isArray(data.responses)) {
            responses = data.responses;
          } else if (typeof data.responses === 'string') {
            try {
              responses = JSON.parse(data.responses);
            } catch (e) {
              console.error('Error parsing responses JSON:', e);
            }
          }
        }

        // Use missing items directly from server
        // Server now handles all parsing of missing items
        const missing_items = Array.isArray(data.missing_items) ? 
          data.missing_items : [];

        console.log(`Final counts for supplier ${supplierId}:`, {
          item_count,
          missing_count,
          total_expected,
          responses_length: responses.length,
          missing_items_length: missing_items.length,
          missing_items_sample: missing_items[0],
        });

        acc[supplierId] = {
          ...data,
          supplier_id: supplierId,
          supplier_name: data.supplier_name,
          responses,
          missing_items,
          latest_response: data.latest_response,
          total_expected_items: total_expected,
          item_count: item_count,
          missing_count: missing_count,
          average_price: parseFloat(data.average_price) || 0,
          is_promotion: data.is_promotion === 1,
        };

        console.log(`Processed data for supplier ${supplierId}:`, {
          ...acc[supplierId],
          missing_items_length: acc[supplierId].missing_items.length,
          missing_items_sample: acc[supplierId].missing_items[0],
        });
        return acc;
      }, {});

      console.log('Final processed data:', {
        suppliers: Object.keys(processedSupplierData),
        sample: processedSupplierData[Object.keys(processedSupplierData)[0]],
        rawSample: supplierData[Object.keys(supplierData)[0]],
      });

      // Set responses with processed data
      setResponses(processedSupplierData);

      // Set stats
      setStats({
        total_responses: parseInt(serverStats.totalResponses, 10) || 0,
        total_items: parseInt(serverStats.totalItems, 10) || 0,
        total_suppliers: parseInt(serverStats.totalSuppliers, 10) || 0,
        responded_items: parseInt(serverStats.respondedItems, 10) || 0,
        missing_responses: parseInt(serverStats.total_missing_items, 10) || 0,
      });

    } catch (err) {
      console.error('Error fetching supplier responses:', err);
      setError('Failed to load supplier responses');
      setResponses({});
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [inquiryId]);

  const fetchMissingItems = useCallback(async (supplierId) => {
    if (!inquiryId || !supplierId) return [];

    try {
      console.log('Fetching missing items:', { inquiryId, supplierId });
      const response = await axios.get(`${API_BASE_URL}/api/supplier-responses/inquiry/${inquiryId}/supplier/${supplierId}/missing`);
      const items = response.data?.items || [];
            
      console.log('Missing items response:', {
        count: items.length,
        sample: items[0],
      });

      return items;
    } catch (err) {
      console.error('Error fetching missing items:', err);
      return [];
    }
  }, [inquiryId]);

  // Fetch responses when inquiryId changes
  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const deleteResponse = useCallback(async (responseId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/supplier-responses/${responseId}`);
      await fetchResponses(); // Refresh the list
      return true;
    } catch (err) {
      console.error('Error deleting supplier response:', err);
      setError('Failed to delete response');
      return false;
    }
  }, [fetchResponses]);

  const deleteBulkResponses = useCallback(async (date, supplierId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/supplier-responses/bulk/${date}/${supplierId}`);
      await fetchResponses(); // Refresh the list
      return true;
    } catch (err) {
      console.error('Error deleting bulk responses:', err);
      setError('Failed to delete responses');
      return false;
    }
  }, [fetchResponses]);

  return {
    loading,
    error,
    responses,
    stats,
    fetchResponses,
    fetchMissingItems,
    deleteResponse,
    deleteBulkResponses,
  };
};
