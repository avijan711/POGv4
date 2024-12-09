import { useState, useCallback } from 'react';
import axios from '../utils/axiosConfig';
import { useSnackbar } from './useSnackbar';

export function usePriceHistory() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showError, showSuccess } = useSnackbar();

    const getPriceHistory = useCallback(async (itemId, supplierId, dateRange = null) => {
        setLoading(true);
        setError(null);
        try {
            let url = `/api/prices/history/${itemId}/${supplierId}`;
            if (dateRange) {
                url += `?start_date=${dateRange.start}&end_date=${dateRange.end}`;
            }
            const response = await axios.get(url);
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to fetch price history';
            setError(message);
            showError(message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [showError]);

    const getCurrentPrice = useCallback(async (itemId, supplierId) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`/api/prices/current/${itemId}/${supplierId}`);
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to fetch current price';
            setError(message);
            showError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    const getSupplierPriceList = useCallback(async (supplierId, includePromotions = true) => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/prices/list/${supplierId}?include_promotions=${includePromotions}`;
            const response = await axios.get(url);
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to fetch supplier price list';
            setError(message);
            showError(message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [showError]);

    const updatePrices = useCallback(async (supplierId, items, sourceType, sourceId = null) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(`/api/prices/update/${supplierId}`, {
                items,
                source_type: sourceType,
                source_id: sourceId
            });
            showSuccess('Prices updated successfully');
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to update prices';
            setError(message);
            showError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [showError, showSuccess]);

    const cleanupPromotions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post('/api/prices/cleanup-promotions');
            showSuccess('Expired promotions cleaned up successfully');
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to cleanup promotions';
            setError(message);
            showError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [showError, showSuccess]);

    return {
        loading,
        error,
        getPriceHistory,
        getCurrentPrice,
        getSupplierPriceList,
        updatePrices,
        cleanupPromotions
    };
}
