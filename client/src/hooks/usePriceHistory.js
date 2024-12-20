import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useSnackbar } from './useSnackbar';

export const usePriceHistory = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showSnackbar } = useSnackbar();

  const getPriceHistory = async (itemId, supplierId, dateRange = null) => {
    try {
      setLoading(true);
      setError(null);

      let url = `${API_BASE_URL}/items/${itemId}/price-history`;
      const params = {
        supplier_id: supplierId,
        ...(dateRange && {
          start_date: dateRange.start,
          end_date: dateRange.end
        })
      };

      const response = await axios.get(url, { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching price history:', err);
      const errorMessage = err.response?.data?.message || 'Failed to load price history';
      setError(errorMessage);
      showSnackbar(errorMessage, 'error');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPrice = async (itemId, supplierId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/items/${itemId}/current-price`, {
        params: { supplier_id: supplierId }
      });
      return response.data;
    } catch (err) {
      console.error('Error fetching current price:', err);
      const errorMessage = err.response?.data?.message || 'Failed to load current price';
      setError(errorMessage);
      showSnackbar(errorMessage, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getPriceHistory,
    getCurrentPrice
  };
};

export default usePriceHistory;
