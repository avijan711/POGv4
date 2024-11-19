import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { perfDebug } from '../../utils/debug';

export const useSupplierResponses = (inquiryId, initialResponses = []) => {
  const [responses, setResponses] = useState(initialResponses);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize] = useState(50);

  // Fetch supplier responses with pagination and improved error handling
  const fetchResponses = useCallback(async (pageNum = 1) => {
    if (!inquiryId) {
      setError('No inquiry ID provided');
      return;
    }

    const timerId = `fetchResponses_${inquiryId}_${pageNum}`;
    try {
      setIsLoading(true);
      perfDebug.time(timerId);

      const response = await axios.get(`${API_BASE_URL}/api/supplier-responses/inquiry/${inquiryId}`, {
        params: {
          page: pageNum,
          pageSize
        }
      });

      // Get pagination info from headers
      const currentPage = parseInt(response.headers['x-page']) || pageNum;
      const hasMoreItems = response.headers['x-has-more'] === 'true';

      // Ensure response.data is always an array and process it safely
      const responseData = Array.isArray(response.data) ? response.data.map(item => {
        if (!item) return null;

        // Ensure all string fields are actually strings
        return {
          ...item,
          date: item.date || '',
          supplierId: item.supplierId ? String(item.supplierId) : '',
          supplierName: item.supplierName ? String(item.supplierName) : '',
          itemCount: typeof item.itemCount === 'number' ? item.itemCount : 0,
          extraItemsCount: typeof item.extraItemsCount === 'number' ? item.extraItemsCount : 0,
          replacementsCount: typeof item.replacementsCount === 'number' ? item.replacementsCount : 0,
          items: Array.isArray(item.items) ? item.items.map(subItem => {
            if (!subItem) return null;
            return {
              ...subItem,
              itemId: subItem.itemId ? String(subItem.itemId) : '',
              hebrewDescription: subItem.hebrewDescription ? String(subItem.hebrewDescription) : '',
              englishDescription: subItem.englishDescription ? String(subItem.englishDescription) : '',
              status: subItem.status ? String(subItem.status) : 'pending',
              itemType: subItem.itemType ? String(subItem.itemType) : 'regular',
              priceQuoted: typeof subItem.priceQuoted === 'number' ? subItem.priceQuoted : 0
            };
          }).filter(Boolean) : []
        };
      }).filter(Boolean) : [];

      if (pageNum === 1) {
        setResponses(responseData);
      } else {
        setResponses(prev => [...prev, ...responseData]);
      }

      setPage(currentPage);
      setHasMore(hasMoreItems);
      setError(null);
    } catch (err) {
      console.error('Error fetching responses:', err);
      
      // Handle specific error cases
      if (!inquiryId) {
        setError('Invalid inquiry ID');
      } else if (err.response?.status === 404) {
        setError('No responses found for this inquiry');
        setResponses([]);
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || 'Failed to load responses');
      }

      // Clear responses on error for current page
      if (pageNum === 1) {
        setResponses([]);
      }
      setHasMore(false);
    } finally {
      perfDebug.timeEnd(timerId);
      setIsLoading(false);
    }
  }, [inquiryId, pageSize]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchResponses(page + 1);
    }
  }, [fetchResponses, isLoading, hasMore, page]);

  // Process responses efficiently with proper type checking
  const processedResponses = useMemo(() => {
    return responses.map(response => {
      if (!response) return null;
      
      // Ensure items is an array and all fields are properly typed
      const safeItems = Array.isArray(response.items) ? response.items.map(item => {
        if (!item) return null;
        return {
          ...item,
          itemId: item.itemId ? String(item.itemId) : '',
          priceQuoted: typeof item.priceQuoted === 'number' ? item.priceQuoted : 0,
          status: item.status ? String(item.status) : 'pending',
          itemType: item.itemType ? String(item.itemType) : 'regular'
        };
      }).filter(Boolean) : [];

      return {
        ...response,
        items: safeItems,
        itemCount: typeof response.itemCount === 'number' ? response.itemCount : 0,
        extraItemsCount: typeof response.extraItemsCount === 'number' ? response.extraItemsCount : 0,
        replacementsCount: typeof response.replacementsCount === 'number' ? response.replacementsCount : 0,
        isPromotion: safeItems.some(item => item.itemType === 'promotion')
      };
    }).filter(Boolean);
  }, [responses]);

  const handleDeleteClick = useCallback((e, item, type) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setItemToDelete(item);
    setDeleteType(type);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return;

    const timerId = `deleteResponse_${itemToDelete.responseId || itemToDelete.changeId}`;
    try {
      setIsDeleting(true);
      perfDebug.time(timerId);

      if (deleteType === 'response') {
        await axios.delete(`${API_BASE_URL}/api/supplier-responses/${itemToDelete.responseId}`);
      } else if (deleteType === 'reference') {
        const changeId = itemToDelete.changeId;
        if (!changeId) {
          throw new Error('Change ID not found');
        }
        await axios.delete(`${API_BASE_URL}/api/supplier-responses/reference-change/${changeId}`);
      } else if (deleteType === 'bulk') {
        const encodedDate = encodeURIComponent(itemToDelete.date);
        await axios.delete(
          `${API_BASE_URL}/api/supplier-responses/bulk/${encodedDate}/${itemToDelete.supplierId}`
        );
      }
      
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
      setError(null);
      
      // Refresh the data
      await fetchResponses(1);
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err.response?.data?.message || 'Failed to delete. Please try again.');
    } finally {
      perfDebug.timeEnd(timerId);
      setIsDeleting(false);
    }
  }, [deleteType, itemToDelete, fetchResponses]);

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
    }
  }, [isDeleting]);

  // Initial load
  const refresh = useCallback(() => {
    fetchResponses(1);
  }, [fetchResponses]);

  return {
    processedResponses,
    deleteDialogOpen,
    deleteType,
    itemToDelete,
    error,
    isDeleting,
    isLoading,
    hasMore,
    handleDeleteClick,
    handleDeleteConfirm,
    closeDeleteDialog,
    handleLoadMore,
    refresh,
    setError
  };
};
