import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { dataDebug } from '../utils/debug';  // Import named export

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
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState(null);

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

            dataDebug.log('Fetching supplier prices with params:', {
                itemId,
                params: params.toString()
            });

            const response = await axios.get(
                `${API_BASE_URL}/api/items/${itemId}/supplier-prices?${params}`
            );

            dataDebug.log('Supplier prices response:', {
                status: response.status,
                data: response.data
            });

            // Validate response data
            if (!response.data || !Array.isArray(response.data.prices)) {
                throw new Error('Invalid response format');
            }

            // Normalize price data
            const normalizedPrices = response.data.prices.map(price => ({
                ...price,
                price_eur: price.price_eur || price.price_quoted || 0,
                date: price.date || price.response_date || new Date().toISOString(),
                supplier_name: price.supplier_name || 'Unknown Supplier',
                is_promotion: !!price.is_promotion,
                promotion_name: price.promotion_name || null,
                cost_ils: price.cost_ils || 0,
                discount_percentage: price.discount_percentage || 0,
                status: price.status || 'active'
            }));

            setPrices(prevPrices => {
                if (reset) return normalizedPrices;
                return [...prevPrices, ...normalizedPrices];
            });

            setHasMore(response.data.hasMore || false);
            
            if (reset) {
                setOffset(ITEMS_PER_PAGE);
            } else {
                setOffset(currentOffset + ITEMS_PER_PAGE);
            }

            dataDebug.log('Updated prices state:', {
                priceCount: normalizedPrices.length,
                hasMore: response.data.hasMore,
                newOffset: currentOffset + ITEMS_PER_PAGE,
                firstPrice: normalizedPrices[0]
            });
        } catch (err) {
            dataDebug.error('Error loading supplier prices:', {
                error: err,
                response: err.response,
                itemId,
                params: filters
            });
            setError(err.message);
            setPrices([]);  // Clear prices on error
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [itemId, offset, filters]);

    const loadSuppliers = useCallback(async () => {
        if (!itemId) return;

        try {
            dataDebug.log('Fetching suppliers for item:', itemId);
            const response = await axios.get(`${API_BASE_URL}/api/items/${itemId}/suppliers`);
            
            // Validate response data
            if (!response.data || !Array.isArray(response.data)) {
                throw new Error('Invalid suppliers response format');
            }

            // Normalize supplier data
            const normalizedSuppliers = response.data.map(supplier => ({
                supplier_id: supplier.supplier_id,
                name: supplier.name || 'Unknown Supplier'
            }));

            dataDebug.log('Loaded suppliers:', normalizedSuppliers);
            setSuppliers(normalizedSuppliers);
        } catch (err) {
            dataDebug.error('Error loading suppliers:', {
                error: err,
                response: err.response,
                itemId
            });
            setSuppliers([]);  // Clear suppliers on error
        }
    }, [itemId]);

    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    useEffect(() => {
        if (itemId) {
            dataDebug.log('Resetting and reloading prices due to itemId or filters change:', {
                itemId,
                filters
            });
            loadPrices(true);
        }
    }, [itemId, filters]); // Reset and reload when filters change

    const updateFilters = useCallback((newFilters) => {
        dataDebug.log('Updating filters:', newFilters);
        setFilters(prev => ({
            ...prev,
            ...newFilters
        }));
    }, []);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            dataDebug.log('Loading more prices');
            loadPrices();
        }
    }, [loading, hasMore, loadPrices]);

    const updatePrice = useCallback(async (supplierId, price, sourceType = 'manual') => {
        if (!itemId || !supplierId) return;

        try {
            setUpdating(true);
            setUpdateError(null);

            dataDebug.log('Updating price:', {
                itemId,
                supplierId,
                price,
                sourceType
            });

            // Call the price update API
            await axios.post(`${API_BASE_URL}/api/prices/update/${supplierId}`, {
                items: [{
                    item_id: itemId,
                    price: price
                }],
                source_type: sourceType
            });

            // Optimistically update the local state
            setPrices(prevPrices =>
                prevPrices.map(p =>
                    p.supplier_id === supplierId
                        ? {
                            ...p,
                            price_eur: price,
                            date: new Date().toISOString()
                        }
                        : p
                )
            );

            // Reload prices to ensure consistency
            await loadPrices(true);

            dataDebug.log('Price updated successfully');
            return true;
        } catch (err) {
            dataDebug.error('Error updating price:', {
                error: err,
                response: err.response,
                itemId,
                supplierId
            });
            setUpdateError(err.message);
            return false;
        } finally {
            setUpdating(false);
        }
    }, [itemId, loadPrices]);

    return {
        prices,
        suppliers,
        loading,
        error,
        hasMore,
        loadMore,
        updateFilters,
        filters,
        updatePrice,
        updating,
        updateError
    };
}
