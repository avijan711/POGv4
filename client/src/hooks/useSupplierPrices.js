import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const ITEMS_PER_PAGE = 10;

export function useSupplierPrices(itemId) {
    const [prices, setPrices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [filters, setFilters] = useState({
        fromDate: '',
        supplierId: ''
    });

    const loadPrices = useCallback(async (reset = false) => {
        if (!itemId) return;

        const currentOffset = reset ? 0 : offset;
        
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                limit: ITEMS_PER_PAGE,
                offset: currentOffset
            });

            if (filters.fromDate) {
                params.append('fromDate', filters.fromDate);
            }
            if (filters.supplierId) {
                params.append('supplierId', filters.supplierId);
            }

            const response = await axios.get(
                `${API_BASE_URL}/api/items/${itemId}/supplier-prices?${params}`
            );

            setPrices(prevPrices => {
                if (reset) return response.data.prices;
                return [...prevPrices, ...response.data.prices];
            });
            setHasMore(response.data.hasMore);
            
            if (reset) {
                setOffset(ITEMS_PER_PAGE);
            } else {
                setOffset(currentOffset + ITEMS_PER_PAGE);
            }
        } catch (err) {
            console.error('Error loading supplier prices:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [itemId, offset, filters]);

    const loadSuppliers = useCallback(async () => {
        if (!itemId) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/api/items/${itemId}/suppliers`);
            setSuppliers(response.data);
        } catch (err) {
            console.error('Error loading suppliers:', err);
            // Don't set error state here as it's not critical
        }
    }, [itemId]);

    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    useEffect(() => {
        loadPrices(true);
    }, [itemId, filters]); // Reset and reload when filters change

    const updateFilters = useCallback((newFilters) => {
        setFilters(prev => ({
            ...prev,
            ...newFilters
        }));
    }, []);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            loadPrices();
        }
    }, [loading, hasMore, loadPrices]);

    return {
        prices,
        suppliers,
        loading,
        error,
        hasMore,
        loadMore,
        updateFilters,
        filters
    };
}
