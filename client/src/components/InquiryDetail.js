import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';

import InquiryItemsTable from './InquiryItemsTable';
import InquiryHeader from './InquiryHeader';
import SupplierResponseList from './SupplierResponseList';
import InquiryDialogs from './InquiryDialogs';
import ItemDialog from './ItemDialog';
import { useInquiryItems } from '../hooks/useInquiryItems';
import { useInquiryFilters } from '../hooks/useInquiryFilters';
import { useInquiryDialogs } from '../hooks/useInquiryDialogs';

function InquiryDetail() {
  const { id: inquiryId } = useParams();
  const navigate = useNavigate();

  // Custom hooks - must be called at the top level
  const {
    items,
    loading,
    error,
    inquiryStatus,
    inquiryDate,
    fetchItems,
    handleUpdateQuantity,
    handleDeleteItem,
    handleAddItem,
    setError
  } = useInquiryItems(inquiryId || '');

  // Ensure items is always an array before passing to useInquiryFilters
  const safeItems = Array.isArray(items) ? items : [];
  
  const {
    searchTerm,
    setSearchTerm,
    showDuplicates,
    showReplacements,
    sortConfig,
    toggleDuplicates,
    toggleReplacements,
    handleSort,
    filteredAndSortedItems
  } = useInquiryFilters(safeItems);

  const dialogStates = useInquiryDialogs(inquiryId || '', fetchItems);

  // Statistics calculation
  const statistics = React.useMemo(() => {
    if (!safeItems.length) return {};

    const uniqueItems = new Set(safeItems.map(item => item.item_id)).size;
    
    // Safely extract supplier names, filtering out any null/undefined responses or names
    const uniqueSuppliers = new Set(safeItems.flatMap(item => {
      const responses = item.supplier_responses || [];
      return responses
        .filter(resp => resp && resp.supplier_name) // Filter out null/undefined responses and ensure supplier_name exists
        .map(resp => resp.supplier_name);
    })).size;

    const startDate = new Date(inquiryDate);
    const today = new Date();
    const daysActive = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    const totalSuppliers = uniqueSuppliers + 2;
    const responseRate = Math.round((uniqueSuppliers / totalSuppliers) * 100);

    return {
      unique_items: uniqueItems,
      suppliers_responded: uniqueSuppliers,
      total_suppliers: totalSuppliers,
      days_active: daysActive,
      response_rate: responseRate
    };
  }, [safeItems, inquiryDate]);

  // Calculate total expected items (total unique items that should have responses)
  const totalExpectedItems = React.useMemo(() => {
    return safeItems.length;
  }, [safeItems]);

  // Handle quantity updates
  const handleQtyUpdate = async (itemId, newQty) => {
    const success = await handleUpdateQuantity(itemId, newQty);
    if (success) {
      dialogStates.setEditingQty(null);
    }
    return success;
  };

  // Handle item deletion
  const handleItemDelete = async (item) => {
    if (!item) return false;
    
    const success = await handleDeleteItem(item);
    if (success) {
      dialogStates.setDeleteConfirmOpen(false);
      dialogStates.setItemToDelete(null);
    }
    return success;
  };

  // Handle inquiry deletion
  const handleInquiryDelete = async () => {
    try {
      await dialogStates.handleDeleteInquiry(navigate);
      return true;
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      setError('Failed to delete inquiry. Please try again.');
      return false;
    }
  };

  // Handle delete action
  const handleDelete = async (target) => {
    if (target === 'inquiry') {
      return handleInquiryDelete();
    } else {
      return handleItemDelete(target);
    }
  };

  // Handle adding new item
  const handleSaveNewItem = async (itemData) => {
    const success = await handleAddItem(itemData);
    if (success) {
      dialogStates.setAddItemDialogOpen(false);
    }
    return success;
  };

  // Effects must be at the top level
  useEffect(() => {
    if (!inquiryId) {
      navigate('/inquiries');
    }
  }, [inquiryId, navigate]);

  useEffect(() => {
    if (inquiryId) {
      fetchItems();
    }
  }, [inquiryId, fetchItems]);

  // Early return if no ID
  if (!inquiryId) {
    return null;
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
          onToggleDuplicates={toggleDuplicates}
          showReplacements={showReplacements}
          onToggleReplacements={toggleReplacements}
          onUploadResponse={() => dialogStates.setSupplierUploadOpen(true)}
          onViewBestPrices={() => navigate(`/comparisons/${inquiryId}`)}
          onDeleteInquiry={() => dialogStates.setDeleteInquiryConfirmOpen(true)}
          onAddItem={() => dialogStates.handleAddItem()}
          error={error}
          statistics={statistics}
        />

        <Box sx={{ mb: 3 }}>
          <SupplierResponseList 
            inquiryId={inquiryId}
            totalExpectedItems={totalExpectedItems}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <InquiryItemsTable
          items={filteredAndSortedItems}
          editingQty={dialogStates.editingQty}
          onEditQty={dialogStates.setEditingQty}
          onUpdateQty={handleQtyUpdate}
          onViewDetails={dialogStates.handleViewItemDetails}
          onEditItem={dialogStates.handleEditItem}
          onDeleteItem={(item) => {
            dialogStates.setItemToDelete(item);
            dialogStates.setDeleteConfirmOpen(true);
          }}
          sortConfig={sortConfig}
          onSort={handleSort}
          onRefresh={fetchItems}
          getChangeSource={dialogStates.getChangeSource}
        />

        <InquiryDialogs
          dialogStates={dialogStates}
          onClose={dialogStates.resetDialogs}
          onSave={dialogStates.handleSaveItem}
          onDelete={handleDelete}
          onUploadSuccess={fetchItems}
          inquiryId={inquiryId}
        />

        <ItemDialog
          open={dialogStates.addItemDialogOpen}
          onClose={() => dialogStates.setAddItemDialogOpen(false)}
          onSave={handleSaveNewItem}
          mode="add"
        />
      </Paper>
    </Box>
  );
}

export default InquiryDetail;
