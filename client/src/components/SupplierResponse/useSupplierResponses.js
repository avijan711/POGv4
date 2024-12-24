import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { perfDebug } from '../../utils/debug';

export const useSupplierResponses = (inquiryId, initialResponses = []) => {
  const [responses] = useState(initialResponses);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
          itemType: item.itemType ? String(item.itemType) : 'regular',
        };
      }).filter(Boolean) : [];

      return {
        ...response,
        items: safeItems,
        itemCount: typeof response.itemCount === 'number' ? response.itemCount : 0,
        extraItemsCount: typeof response.extraItemsCount === 'number' ? response.extraItemsCount : 0,
        replacementsCount: typeof response.replacementsCount === 'number' ? response.replacementsCount : 0,
        isPromotion: safeItems.some(item => item.itemType === 'promotion'),
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
          `${API_BASE_URL}/api/supplier-responses/bulk/${encodedDate}/${itemToDelete.supplierId}`,
        );
      }
      
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
      setError(null);
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err.response?.data?.message || 'Failed to delete. Please try again.');
    } finally {
      perfDebug.timeEnd(timerId);
      setIsDeleting(false);
    }
  }, [deleteType, itemToDelete]);

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
    }
  }, [isDeleting]);

  return {
    processedResponses,
    deleteDialogOpen,
    deleteType,
    itemToDelete,
    error,
    isDeleting,
    isLoading,
    handleDeleteClick,
    handleDeleteConfirm,
    closeDeleteDialog,
    setError,
  };
};
