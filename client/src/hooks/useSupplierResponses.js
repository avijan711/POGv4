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
        missing_responses: 0
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
                let missing_items = [];
                try {
                    if (typeof data.missing_items === 'string') {
                        console.log(`Missing items for supplier ${supplierId} is a string:`, data.missing_items);
                        missing_items = JSON.parse(data.missing_items);
                    } else if (Array.isArray(data.missing_items)) {
                        console.log(`Missing items for supplier ${supplierId} is an array:`, data.missing_items);
                        missing_items = data.missing_items;
                    }
                    // Filter out any null values
                    missing_items = missing_items.filter(Boolean);
                    console.log(`Processed missing items for supplier ${supplierId}:`, missing_items);
                } catch (e) {
                    console.error(`Error parsing missing items for supplier ${supplierId}:`, e);
                    missing_items = [];
                }

                // Ensure responses are sorted by date (most recent first)
                const sortedResponses = Array.isArray(data.responses) 
                    ? [...data.responses].sort((a, b) => {
                        return new Date(b.response_date) - new Date(a.response_date);
                    })
                    : [];

                // Get the latest response date from sorted responses
                const latest_response = sortedResponses.length > 0 
                    ? sortedResponses[0].response_date 
                    : data.latest_response;

                acc[supplierId] = {
                    ...data,
                    responses: sortedResponses,
                    missing_items,
                    latest_response
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
                    total_responses: serverStats.totalResponses || 0,
                    total_items: serverStats.totalItems || 0,
                    total_suppliers: serverStats.totalSuppliers || 0,
                    responded_items: serverStats.respondedItems || 0,
                    missing_responses: serverStats.missingResponses || 0,
                    responses_by_supplier: Object.fromEntries(
                        Object.entries(processedSupplierData).map(([id, data]) => [
                            id,
                            {
                                total_items: data.total_items || 0,
                                promotion_items: data.promotion_items || 0,
                                average_price: data.average_price || 0,
                                missing_items_count: data.missing_items?.length || 0
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
