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
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);

  const processSupplierPrices = (prices) => {
    if (!prices) return [];

    try {
      // Handle supplier prices whether they're a string or array
      const parsedPrices = typeof prices === 'string'
        ? JSON.parse(prices)
        : Array.isArray(prices)
          ? prices
          : [];

      // Filter and process each price
      return parsedPrices
        .filter(price => 
          price && 
          typeof price === 'object' && 
          price.supplier_name && 
          typeof price.supplier_name === 'string' &&
          'price_quoted' in price &&
          typeof price.price_quoted === 'number',
        )
        .map(price => ({
          supplier_name: price.supplier_name,
          price_quoted: price.price_quoted,
          response_date: price.response_date ? new Date(price.response_date) : new Date(),
          status: price.status || 'unknown',
          is_promotion: Boolean(price.is_promotion),
          promotion_name: price.promotion_name || '',
          price_change: price.price_change || 0,
        }));
    } catch (e) {
      console.error('Error processing supplier prices:', e);
      return [];
    }
  };

  const handleEditItem = (item) => {
    if (!item) return;

    const formattedItem = {
      item_id: item.item_id,
      hebrew_description: item.hebrew_description,
      english_description: item.english_description,
      import_markup: item.import_markup?.toString(),
      hs_code: item.hs_code || '',
      retail_price: item.retail_price?.toString() || '0',
      qty_in_stock: item.qty_in_stock?.toString() || '0',
      image: item.image || null,
    };
    setSelectedItem(formattedItem);
    setDialogOpen(true);
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setAddItemDialogOpen(true);
  };

  const handleSaveItem = async (itemData) => {
    if (!itemData) return;

    try {
      await axios.put(`${API_BASE_URL}/api/items/${itemData.get('item_id')}`, itemData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await onRefresh();
      setDialogOpen(false);
      setSelectedItem(null);
      setAddItemDialogOpen(false);
      setError('');
    } catch (error) {
      console.error('Error saving item:', error);
      setError('Failed to save item. Please try again.');
    }
  };

  const handleViewItemDetails = async (item) => {
    if (!item) return;

    try {
      // Process supplier prices before setting in state
      const processedItem = {
        ...item,
        supplier_prices: processSupplierPrices(item.supplier_prices),
      };

      // Log the processed item for debugging
      console.log('Processed item details:', processedItem);
      console.log('Processed supplier prices:', processedItem.supplier_prices);

      setSelectedItemDetails(processedItem);
      setItemDetailsOpen(true);
    } catch (error) {
      console.error('Error processing item details:', error);
      setError('Failed to process item details. Please try again.');
    }
  };

  const handleDeleteInquiry = async (navigate) => {
    if (!inquiryId) {
      setError('No inquiry ID provided');
      return;
    }

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

  const getChangeSource = (reference_change) => {
    if (!reference_change) return '';
    if (reference_change.source === 'inquiry_item') return 'Reference from inquiry';
    if (reference_change.source === 'supplier') {
      return `Changed by ${reference_change.supplier_name || 'unknown supplier'}`;
    }
    return 'Changed by user';
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
    setAddItemDialogOpen(false);
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
    addItemDialogOpen,
    setDialogOpen,
    setItemDetailsOpen,
    setDeleteConfirmOpen,
    setItemToDelete,
    setDeleteInquiryConfirmOpen,
    setSupplierUploadOpen,
    setEditingQty,
    setAddItemDialogOpen,
    handleEditItem,
    handleAddItem,
    handleSaveItem,
    handleViewItemDetails,
    handleDeleteInquiry,
    getChangeSource,
    resetDialogs,
    setError,
  };
};
