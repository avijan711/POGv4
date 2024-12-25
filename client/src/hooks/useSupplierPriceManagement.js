import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export function useSupplierPriceManagement(itemId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [prices, setPrices] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);

  // Load all suppliers from the system
  const loadAllSuppliers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/suppliers`);
      setAllSuppliers(response.data || []);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      setError('Failed to load suppliers');
      setAllSuppliers([]);
    }
  }, []);

  // Load prices for the current item
  const loadPrices = useCallback(async () => {
    if (!itemId) return;

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/items/${itemId}/supplier-prices`);
      setPrices(response.data.prices || []);
    } catch (err) {
      console.error('Error loading prices:', err);
      setError('Failed to load prices');
      setPrices([]);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  // Update available suppliers whenever prices or suppliers change
  useEffect(() => {
    const quotedSupplierIds = new Set(prices.map(p => p.supplier_id));
    const available = allSuppliers.filter(s => !quotedSupplierIds.has(s.supplier_id));
    setAvailableSuppliers(available);
  }, [allSuppliers, prices]);

  // Load initial data
  useEffect(() => {
    loadAllSuppliers();
    if (itemId) {
      loadPrices();
    }
  }, [itemId, loadAllSuppliers, loadPrices]);

  // Add or update a price
  const updatePrice = useCallback(async (supplierId, priceData) => {
    try {
      setLoading(true);
      setError(null);

      // Use the single update endpoint with source_type parameter
      await axios.post(`${API_BASE_URL}/api/prices/update/${supplierId}`, {
        items: [{
          item_id: itemId,
          price: priceData.price,
        }],
        source_type: priceData.is_permanent ? 'manual' : 'inquiry',
        notes: priceData.notes,
      });

      // Refresh prices after update
      await loadPrices();
      return true;
    } catch (err) {
      console.error('Error updating price:', err);
      setError(err.response?.data?.message || 'Failed to update price');
      return false;
    } finally {
      setLoading(false);
    }
  }, [itemId, loadPrices]);

  // Load price history for a supplier
  const loadPriceHistory = useCallback(async (supplierId) => {
    if (!itemId || !supplierId) return [];

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/prices/history/${itemId}/${supplierId}`,
      );
      return response.data || [];
    } catch (err) {
      console.error('Error loading price history:', err);
      return [];
    }
  }, [itemId]);

  // Get supplier details by ID
  const getSupplierById = useCallback((supplierId) => {
    return allSuppliers.find(s => s.supplier_id === supplierId);
  }, [allSuppliers]);

  // Check if a supplier has quoted prices
  const hasSupplierQuoted = useCallback((supplierId) => {
    return prices.some(p => p.supplier_id === supplierId);
  }, [prices]);

  return {
    loading,
    error,
    allSuppliers,         // All suppliers in the system
    prices,               // Current prices for the item
    availableSuppliers,   // Suppliers without prices
    updatePrice,          // Function to add/update price
    loadPriceHistory,     // Function to load price history
    getSupplierById,      // Function to get supplier details
    hasSupplierQuoted,    // Function to check if supplier has quoted
    refresh: loadPrices,  // Function to refresh prices
  };
}