import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export const useSupplierResponses = (inquiryId) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [responses, setResponses] = useState({});
    const [stats, setStats] = useState({
        totalResponses: 0,
        totalItems: 0,
        totalSuppliers: 0,
        respondedItems: 0,
        missingResponses: 0
    });

    // Use a ref to track if we're already fetching
    const fetchingRef = useRef(false);

    const fetchResponses = useCallback(async () => {
        if (!inquiryId || fetchingRef.current) return;

        try {
            setLoading(true);
            setError(null);
            fetchingRef.current = true;

            const response = await axios.get(`${API_BASE_URL}/api/supplier-responses/inquiry/${inquiryId}`);
            const responseData = response.data;

            // Log the response data for debugging
            console.log('Raw response data:', responseData);

            // Validate response structure
            if (!responseData) {
                throw new Error('No response data received');
            }

            // Extract data and stats from response
            const supplierData = responseData.data || {};
            const serverStats = responseData.stats || {};

            // Process supplier data to ensure missing items are properly parsed
            const processedSupplierData = Object.entries(supplierData).reduce((acc, [supplierId, data]) => {
                let missingItems = [];
                try {
                    if (typeof data.missingItems === 'string') {
                        console.log(`Missing items for supplier ${supplierId} is a string:`, data.missingItems);
                        missingItems = JSON.parse(data.missingItems);
                    } else if (Array.isArray(data.missingItems)) {
                        console.log(`Missing items for supplier ${supplierId} is an array:`, data.missingItems);
                        missingItems = data.missingItems;
                    }
                    // Filter out any null values
                    missingItems = missingItems.filter(Boolean);
                    console.log(`Processed missing items for supplier ${supplierId}:`, missingItems);
                } catch (e) {
                    console.error(`Error parsing missing items for supplier ${supplierId}:`, e);
                    missingItems = [];
                }

                acc[supplierId] = {
                    ...data,
                    missingItems
                };
                return acc;
            }, {});

            console.log('Processed supplier data:', processedSupplierData);

            // Set responses with processed data
            setResponses(processedSupplierData);

            // Set stats
            setStats(prev => {
                const newStats = {
                    ...prev,
                    totalResponses: serverStats.totalResponses || 0,
                    totalItems: serverStats.totalItems || 0,
                    totalSuppliers: serverStats.totalSuppliers || 0,
                    respondedItems: serverStats.respondedItems || 0,
                    missingResponses: serverStats.missingResponses || 0,
                    responsesBySupplier: Object.fromEntries(
                        Object.entries(processedSupplierData).map(([id, data]) => [
                            id,
                            {
                                totalItems: data.totalItems || 0,
                                promotionItems: data.promotionItems || 0,
                                averagePrice: data.averagePrice || 0,
                                missingItemsCount: data.missingItems?.length || 0
                            }
                        ])
                    )
                };
                console.log('Setting new stats:', newStats);
                return newStats;
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

    const updateStats = useCallback((newStats) => {
        setStats(prev => {
            // Only update if values are different
            const hasChanges = Object.entries(newStats).some(
                ([key, value]) => prev[key] !== value
            );
            return hasChanges ? { ...prev, ...newStats } : prev;
        });
    }, []); // Memoize the stats update function

    return {
        loading,
        error,
        responses,
        stats,
        fetchResponses,
        deleteResponse,
        deleteBulkResponses,
        setStats: updateStats
    };
};
