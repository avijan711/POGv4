import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { uiDebug, dataDebug, perfDebug } from '../utils/debug';

export function usePromotionManagement() {
    const [promotions, setPromotions] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState('');

    const fetchPromotions = async () => {
        perfDebug.time('fetchPromotions');
        try {
            setLoading(true);
            setError(null);
            dataDebug.log('Fetching promotions...');
            
            const response = await fetch(`${API_BASE_URL}/api/promotions`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch promotions');
            }
            const data = await response.json();
            dataDebug.log('Fetched promotions:', data);
            
            // Ensure data is an array and has required properties
            const processedData = Array.isArray(data) ? data.map(promotion => ({
                PromotionGroupID: promotion.id,
                Name: promotion.name,
                SupplierName: promotion.SupplierName,
                StartDate: promotion.start_date,
                EndDate: promotion.end_date,
                IsActive: promotion.is_active,
                ItemCount: promotion.ItemCount || 0
            })) : [];

            setPromotions(processedData);
            
        } catch (error) {
            dataDebug.error('Error fetching promotions:', error);
            setError(error.message);
            setPromotions([]); // Reset to empty array on error
        } finally {
            perfDebug.timeEnd('fetchPromotions');
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        perfDebug.time('fetchSuppliers');
        try {
            dataDebug.log('Fetching suppliers...');
            setLoadingSuppliers(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/api/suppliers`);
            dataDebug.log('Suppliers API response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch suppliers');
            }
            
            const data = await response.json();
            dataDebug.log('Fetched suppliers count:', data.length);
            
            // Ensure data is an array
            const supplierArray = Array.isArray(data) ? data : [];
            
            if (supplierArray.length === 0) {
                dataDebug.warn('No suppliers found');
                setError('No suppliers found. Please add suppliers before creating promotions.');
            }
            
            setSuppliers(supplierArray);
        } catch (error) {
            dataDebug.error('Error fetching suppliers:', error);
            setError(error.message);
            setSuppliers([]);
        } finally {
            perfDebug.timeEnd('fetchSuppliers');
            setLoadingSuppliers(false);
        }
    };

    const handleUpload = async (formData) => {
        try {
            setLoading(true);
            setError(null);
            setUploadProgress(0);
            setProcessingStatus('Starting upload...');
            perfDebug.time('uploadPromotion');

            // Upload the file and get the upload ID
            const uploadResponse = await fetch(`${API_BASE_URL}/api/promotions/upload`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.message || 'Failed to start upload');
            }

            const { uploadId } = await uploadResponse.json();
            dataDebug.log('Upload started with ID:', uploadId);

            // Set up SSE connection for progress updates
            const eventSource = new EventSource(`${API_BASE_URL}/api/promotions/progress/${uploadId}`);

            return new Promise((resolve, reject) => {
                eventSource.onmessage = (event) => {
                    const progress = JSON.parse(event.data);
                    setUploadProgress(progress.progress);
                    setProcessingStatus(progress.status);

                    if (progress.progress === 100) {
                        eventSource.close();
                        dataDebug.log('Upload completed successfully');
                        perfDebug.timeEnd('uploadPromotion');
                        fetchPromotions();
                        resolve(true);
                    } else if (progress.status.startsWith('Error:')) {
                        eventSource.close();
                        reject(new Error(progress.status));
                    }
                };

                eventSource.onerror = (error) => {
                    eventSource.close();
                    dataDebug.error('Error in SSE connection:', error);
                    reject(new Error('Lost connection to server'));
                };
            });
        } catch (error) {
            dataDebug.error('Error creating promotion:', error);
            setError(error.message);
            setProcessingStatus('Error: ' + error.message);
            return false;
        } finally {
            setLoading(false);
            setUploadProgress(0);
            setTimeout(() => setProcessingStatus(''), 3000); // Clear status after 3 seconds
        }
    };

    const handleUpdatePromotion = async (groupId, isActive) => {
        try {
            setLoading(true);
            setError(null);
            perfDebug.time('updatePromotion');

            const promotion = promotions.find(p => p.PromotionGroupID === groupId);
            if (!promotion) {
                throw new Error('Promotion not found');
            }

            dataDebug.log('Updating promotion:', { groupId, isActive });
            
            const response = await fetch(`${API_BASE_URL}/api/promotions/${groupId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: promotion.Name,
                    startDate: promotion.StartDate,
                    endDate: promotion.EndDate,
                    isActive
                })
            });

            if (response.status === 404) {
                throw new Error('Promotion not found. It may have been deleted.');
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update promotion');
            }

            dataDebug.log('Promotion updated successfully');
            perfDebug.timeEnd('updatePromotion');
            await fetchPromotions();
            return true;
        } catch (error) {
            dataDebug.error('Error updating promotion:', error);
            setError(error.message);
            await fetchPromotions();
            return false;
        } finally {
            setLoading(false);
        }
    };

    const getPromotionDetails = async (groupId, page = 1, pageSize = 100) => {
        try {
            setLoading(true);
            setError(null);
            perfDebug.time('viewPromotionDetails');

            dataDebug.log('Fetching promotion details:', { groupId, page });
            const response = await fetch(`${API_BASE_URL}/api/promotions/${groupId}?page=${page}&pageSize=${pageSize}`);
            
            if (response.status === 404) {
                throw new Error('Promotion not found. It may have been deleted.');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch promotion details');
            }

            const details = await response.json();
            
            // Ensure items is always an array
            const processedDetails = {
                ...details,
                items: Array.isArray(details.items) ? details.items : []
            };

            dataDebug.log('Fetched promotion details:', { 
                name: processedDetails.Name, 
                itemCount: processedDetails.items.length 
            });
            
            perfDebug.timeEnd('viewPromotionDetails');
            return processedDetails;
        } catch (error) {
            dataDebug.error('Error fetching promotion details:', error);
            setError(error.message);
            await fetchPromotions();
            return null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromotions();
        fetchSuppliers();
    }, []);

    return {
        promotions,
        suppliers,
        loading,
        loadingSuppliers,
        error,
        uploadProgress,
        processingStatus,
        setError,
        handleUpload,
        handleUpdatePromotion,
        getPromotionDetails,
        refreshPromotions: fetchPromotions
    };
}
