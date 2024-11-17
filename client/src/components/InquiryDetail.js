import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import axios from 'axios';

import ItemDialog from './ItemDialog';
import ItemDetailsDialog from './ItemDetailsDialog';
import SupplierResponseUpload from './SupplierResponseUpload';
import InquiryItemsTable from './InquiryItemsTable';
import InquiryHeader from './InquiryHeader';
import SupplierResponseList from './SupplierResponseList';
import { API_BASE_URL } from '../config';

function InquiryDetail() {
  const { id: inquiryId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showReplacements, setShowReplacements] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [inquiryStatus, setInquiryStatus] = useState('');
  const [inquiryDate, setInquiryDate] = useState('');
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [editingQty, setEditingQty] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteInquiryConfirmOpen, setDeleteInquiryConfirmOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ field: 'itemID', direction: 'asc' });
  const [supplierUploadOpen, setSupplierUploadOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [supplierResponses, setSupplierResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [showResponses, setShowResponses] = useState(true);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!items.length) return {};

    // Get unique items count
    const uniqueItems = new Set(items.map(item => item.itemID)).size;

    // Get suppliers responded count
    const uniqueSuppliers = new Set(supplierResponses.map(response => response.supplierName)).size;

    // Calculate days active
    const startDate = new Date(inquiryDate);
    const today = new Date();
    const daysActive = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    // Calculate response rate
    const totalSuppliers = uniqueSuppliers + 2; // Adding buffer for potential suppliers
    const responseRate = Math.round((uniqueSuppliers / totalSuppliers) * 100);

    return {
      uniqueItems,
      suppliersResponded: uniqueSuppliers,
      totalSuppliers,
      daysActive,
      responseRate
    };
  }, [items, supplierResponses, inquiryDate]);

  const getChangeSource = (referenceChange) => {
    if (!referenceChange) return '';
    
    if (referenceChange.source === 'supplier') {
      return `Changed by supplier ${referenceChange.supplierName || ''}`;
    } else if (referenceChange.source === 'user') {
      return 'Changed by user';
    }
    return '';
  };

  const fetchItems = useCallback(async () => {
    if (!inquiryId) return;
    
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_BASE_URL}/api/inquiries/${inquiryId}`);
      
      let inquiryData = response.data;
      let itemsData = [];
      
      if (Array.isArray(response.data)) {
        itemsData = response.data;
        inquiryData = {
          status: 'New',
          date: new Date().toISOString()
        };
      } else if (response.data.inquiry && response.data.items) {
        inquiryData = response.data.inquiry;
        itemsData = response.data.items;
      } else {
        throw new Error('Invalid response format');
      }
      
      const itemsWithDetails = itemsData.map(item => {
        const referencingItems = itemsData.filter(otherItem => 
          otherItem.referenceChange && 
          otherItem.referenceChange.newReferenceID === item.itemID &&
          otherItem.referenceChange.newReferenceID != null
        );
        
        return {
          ...item,
          referenceChange: item.referenceChange ? {
            ...item.referenceChange,
            source: item.referenceChange.source || (item.referenceChange.changedByUser ? 'user' : 'supplier')
          } : null,
          hasReferenceChange: item.referenceChange && 
                            item.referenceChange.newReferenceID != null,
          isReferencedBy: referencingItems.length > 0,
          referencingItems: referencingItems.map(refItem => ({
            ...refItem,
            referenceChange: refItem.referenceChange ? {
              ...refItem.referenceChange,
              source: refItem.referenceChange.source || (refItem.referenceChange.changedByUser ? 'user' : 'supplier')
            } : null
          })),
          status: inquiryData.status,
          date: inquiryData.date
        };
      });

      if (itemsWithDetails && itemsWithDetails.length > 0) {
        setItems(itemsWithDetails);
        setInquiryStatus(inquiryData.status);
        setInquiryDate(new Date(inquiryData.date).toLocaleDateString());
      }
      setError('');
    } catch (err) {
      console.error('Error fetching inquiry items:', err);
      if (err.response?.status === 404) {
        setError('Inquiry not found. It may have been deleted.');
        setItems([]);
      } else {
        setError('Failed to load inquiry items. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  const fetchSupplierResponses = useCallback(async () => {
    if (!inquiryId) return;

    try {
      setLoadingResponses(true);
      const response = await axios.get(`${API_BASE_URL}/api/supplier-responses/inquiry/${inquiryId}`);
      setSupplierResponses(response.data);
    } catch (err) {
      console.error('Error fetching supplier responses:', err);
      setError('Failed to load supplier responses');
    } finally {
      setLoadingResponses(false);
    }
  }, [inquiryId]);

  const handleStartComparison = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/inquiries/${inquiryId}/status`, {
        status: 'in_comparison'
      });
      navigate(`/comparisons/${inquiryId}`);
    } catch (error) {
      console.error('Error starting comparison:', error);
      setError('Failed to start comparison process. Please try again.');
    }
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

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
      await fetchItems();
      setDialogOpen(false);
      setSelectedItem(null);
      setError('');
    } catch (error) {
      console.error('Error saving item:', error);
      setError('Failed to save item. Please try again.');
    }
  };

  const handleUpdateQuantity = async (inquiryItemId, newQty) => {
    try {
      await axios.put(`${API_BASE_URL}/api/inquiries/inquiry-items/${inquiryItemId}/quantity`, {
        requestedQty: newQty
      });
      await fetchItems();
      setEditingQty(null);
      setError('');
    } catch (error) {
      console.error('Error updating quantity:', error);
      setError('Failed to update quantity. Please try again.');
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/inquiries/inquiry-items/${itemToDelete.inquiryItemID}`);
      await fetchItems();
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      setError('');
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item. Please try again.');
    }
  };

  const handleDeleteInquiry = async () => {
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

  async function handleViewItemDetails(item) {
    try {
      setLoadingDetails(true);
      const response = await axios.get(`${API_BASE_URL}/api/items/${item.itemID}`);
      const fullDetails = response.data;
      
      const mergedData = {
        ...fullDetails,
        item: {
          ...fullDetails.item,
          requestedQty: item.requestedQty,
          inquiryItemID: item.inquiryItemID,
          referenceChange: item.referenceChange,
          hasReferenceChange: item.hasReferenceChange,
          isReferencedBy: item.isReferencedBy,
          referencingItems: item.referencingItems
        }
      };
      
      setSelectedItemDetails(mergedData);
      setItemDetailsOpen(true);
    } catch (error) {
      console.error('Error fetching item details:', error);
      setError('Failed to load item details: ' + error.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      fetchItems(),
      fetchSupplierResponses()
    ]);
  }, [fetchItems, fetchSupplierResponses]);

  useEffect(() => {
    fetchItems();
    fetchSupplierResponses();
  }, [fetchItems, fetchSupplierResponses]);

  // Filter and sort items
  const filteredItems = items.filter(item =>
    Object.values(item).some(value =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const duplicateItems = items.reduce((acc, item) => {
    const key = item.itemID;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  let displayedItems = filteredItems;
  if (showDuplicates) {
    displayedItems = displayedItems.filter(item => duplicateItems[item.itemID].length > 1);
  } else if (showReplacements) {
    displayedItems = displayedItems.filter(item => item.hasReferenceChange || item.isReferencedBy);
  }

  // Sort items
  displayedItems = [...displayedItems].sort((a, b) => {
    let aValue = a[sortConfig.field];
    let bValue = b[sortConfig.field];

    if (['importMarkup', 'qtyInStock', 'requestedQty', 'retailPrice'].includes(sortConfig.field)) {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue?.toLowerCase();
    }

    if (aValue === bValue) return 0;
    return sortConfig.direction === 'asc'
      ? aValue > bValue ? 1 : -1
      : aValue < bValue ? 1 : -1;
  });

  if (!inquiryId) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No inquiry selected</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Paper sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <InquiryHeader
          inquiryStatus={inquiryStatus}
          inquiryDate={inquiryDate}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          showDuplicates={showDuplicates}
          onToggleDuplicates={() => {
            setShowDuplicates(!showDuplicates);
            if (showReplacements) setShowReplacements(false);
          }}
          showReplacements={showReplacements}
          onToggleReplacements={() => {
            setShowReplacements(!showReplacements);
            if (showDuplicates) setShowDuplicates(false);
          }}
          onUploadResponse={() => setSupplierUploadOpen(true)}
          onViewBestPrices={handleStartComparison}
          onDeleteInquiry={() => setDeleteInquiryConfirmOpen(true)}
          error={error}
          statistics={statistics}
        />

        <Box sx={{ mb: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 1,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
            borderRadius: 1,
            p: 1
          }}
          onClick={() => setShowResponses(!showResponses)}
        >
            <Typography variant="h6" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Supplier Responses
              {showResponses ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Typography>
          </Box>

          {showResponses && (
            loadingResponses ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <SupplierResponseList 
                responses={supplierResponses}
                onRefresh={handleRefresh}
              />
            )
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        <InquiryItemsTable
          items={displayedItems}
          editingQty={editingQty}
          onEditQty={(id, qty) => {
            setEditingQty(id);
            setItems(items.map(i => 
              i.inquiryItemID === id 
                ? { ...i, requestedQty: qty }
                : i
            ));
          }}
          onUpdateQty={handleUpdateQuantity}
          onViewDetails={handleViewItemDetails}
          onEditItem={handleEditItem}
          onDeleteItem={(item) => {
            setItemToDelete(item);
            setDeleteConfirmOpen(true);
          }}
          sortConfig={sortConfig}
          onSort={handleSort}
          getChangeSource={getChangeSource}
          onRefresh={handleRefresh}
        />

        <ItemDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
          onSave={handleSaveItem}
          mode="edit"
        />

        <ItemDetailsDialog
          open={itemDetailsOpen}
          onClose={() => {
            setItemDetailsOpen(false);
            setSelectedItemDetails(null);
          }}
          item={selectedItemDetails}
        />

        <Dialog
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
          }}
        >
          <DialogTitle>Delete Item</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this item from the inquiry?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => {
                setDeleteConfirmOpen(false);
                setItemToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteItem} 
              color="error" 
              variant="contained"
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={deleteInquiryConfirmOpen}
          onClose={() => !isDeleting && setDeleteInquiryConfirmOpen(false)}
        >
          <DialogTitle>Delete Inquiry</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this entire inquiry? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setDeleteInquiryConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteInquiry} 
              color="error" 
              variant="contained"
              disabled={isDeleting}
              startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
            >
              {isDeleting ? 'Deleting...' : 'Delete Inquiry'}
            </Button>
          </DialogActions>
        </Dialog>

        <SupplierResponseUpload
          open={supplierUploadOpen}
          onClose={() => setSupplierUploadOpen(false)}
          inquiryId={inquiryId}
          onUploadSuccess={handleRefresh}
        />

        {loadingDetails && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
            }}
          >
            <CircularProgress />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default InquiryDetail;
