import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export const useInquiryDialogs = (inquiryId, onRefresh) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteInquiryConfirmOpen, setDeleteInquiryConfirmOpen] = useState(false);
  const [supplierUploadOpen, setSupplierUploadOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');
  const [editingQty, setEditingQty] = useState(null);

  const handleEditItem = (item) => {
    const formattedItem = {
      itemID: item.itemID,
      hebrewDescription: item.hebrewDescription,
      englishDescription: item.englishDescription,
      importMarkup: item.importMarkup?.toString(),
      hsCode: item.hsCode || '',
      retailPrice: item.retailPrice?.toString() || '0',
      qtyInStock: item.qtyInStock?.toString() || '0',
      image: item.image || null,
    };
    setSelectedItem(formattedItem);
    setDialogOpen(true);
  };

  const handleSaveItem = async (itemData) => {
    try {
      await axios.put(`${API_BASE_URL}/api/items/${itemData.get('itemID')}`, itemData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await onRefresh();
      setDialogOpen(false);
      setSelectedItem(null);
      setError('');
    } catch (error) {
      console.error('Error saving item:', error);
      setError('Failed to save item. Please try again.');
    }
  };

  const handleViewItemDetails = async (item) => {
    setSelectedItemDetails(item);
    setItemDetailsOpen(true);
  };

  const handleDeleteInquiry = async (navigate) => {
    try {
      setIsDeleting(true);
      await axios.delete(`${API_BASE_URL}/api/inquiries/${inquiryId}`);
      setDeleteInquiryConfirmOpen(false);
      navigate('/inquiries');
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      setIsDeleting(false);
      setDeleteInquiryConfirmOpen(false);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details || 
                          error.response?.data?.message || 
                          error.message || 
                          'An unknown error occurred';
      
      if (error.response?.status === 404) {
        setError('Inquiry not found. It may have been deleted.');
        navigate('/inquiries');
      } else {
        setError(`Failed to delete inquiry: ${errorMessage}`);
      }
    }
  };

  const resetDialogs = () => {
    setDialogOpen(false);
    setSelectedItem(null);
    setItemDetailsOpen(false);
    setSelectedItemDetails(null);
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
    setDeleteInquiryConfirmOpen(false);
    setSupplierUploadOpen(false);
    setEditingQty(null);
    setError('');
  };

  return {
    dialogOpen,
    selectedItem,
    itemDetailsOpen,
    selectedItemDetails,
    deleteConfirmOpen,
    itemToDelete,
    deleteInquiryConfirmOpen,
    supplierUploadOpen,
    isDeleting,
    loadingDetails,
    error,
    editingQty,
    setDialogOpen,
    setItemDetailsOpen,
    setDeleteConfirmOpen,
    setItemToDelete,
    setDeleteInquiryConfirmOpen,
    setSupplierUploadOpen,
    setEditingQty,
    handleEditItem,
    handleSaveItem,
    handleViewItemDetails,
    handleDeleteInquiry,
    resetDialogs,
    setError
  };
};
