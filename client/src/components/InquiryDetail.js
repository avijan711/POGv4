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
import { useInquiryItems } from '../hooks/useInquiryItems';
import { useInquiryFilters } from '../hooks/useInquiryFilters';
import { useInquiryDialogs } from '../hooks/useInquiryDialogs';

function InquiryDetail() {
  const { id: inquiryId } = useParams();
  const navigate = useNavigate();

  // Custom hooks
  const {
    items,
    loading,
    error,
    inquiryStatus,
    inquiryDate,
    fetchItems,
    handleUpdateQuantity,
    handleDeleteItem,
    setError
  } = useInquiryItems(inquiryId);

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

  const dialogStates = useInquiryDialogs(inquiryId, fetchItems);

  // Statistics calculation
  const statistics = React.useMemo(() => {
    if (!safeItems.length) return {};

    const uniqueItems = new Set(safeItems.map(item => item.itemID)).size;
    const uniqueSuppliers = new Set(safeItems.flatMap(item => 
      item.supplierResponses?.map(resp => resp.supplierName) || []
    )).size;

    const startDate = new Date(inquiryDate);
    const today = new Date();
    const daysActive = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    const totalSuppliers = uniqueSuppliers + 2;
    const responseRate = Math.round((uniqueSuppliers / totalSuppliers) * 100);

    return {
      uniqueItems,
      suppliersResponded: uniqueSuppliers,
      totalSuppliers,
      daysActive,
      responseRate
    };
  }, [safeItems, inquiryDate]);

  // Helper function to get change source text
  const getChangeSource = (referenceChange) => {
    if (!referenceChange) return '';
    if (referenceChange.source === 'inquiry_item') return 'Reference from inquiry';
    if (referenceChange.source === 'supplier') {
      return `Changed by ${referenceChange.supplierName || 'unknown supplier'}`;
    }
    return 'Changed by user';
  };

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

  useEffect(() => {
    if (inquiryId) {
      fetchItems();
    }
  }, [inquiryId, fetchItems]);

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
          onToggleDuplicates={toggleDuplicates}
          showReplacements={showReplacements}
          onToggleReplacements={toggleReplacements}
          onUploadResponse={() => dialogStates.setSupplierUploadOpen(true)}
          onViewBestPrices={() => navigate(`/comparisons/${inquiryId}`)}
          onDeleteInquiry={() => dialogStates.setDeleteInquiryConfirmOpen(true)}
          error={error}
          statistics={statistics}
        />

        <Box sx={{ mb: 3 }}>
          <SupplierResponseList 
            responses={safeItems.filter(item => item?.supplierResponses?.length > 0)}
            onRefresh={fetchItems}
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
          getChangeSource={getChangeSource}
        />

        <InquiryDialogs
          dialogStates={dialogStates}
          onClose={dialogStates.resetDialogs}
          onSave={dialogStates.handleSaveItem}
          onDelete={handleDelete}
          onUploadSuccess={fetchItems}
          inquiryId={inquiryId}
        />
      </Paper>
    </Box>
  );
}

export default InquiryDetail;
