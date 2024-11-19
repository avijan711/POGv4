import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TablePagination,
  CircularProgress,
  Alert,
} from '@mui/material';
import ItemDialog from './ItemDialog';
import ItemDetailsDialog from './ItemDetailsDialog';
import ItemTable from './InventoryList/ItemTable';
import SearchBar from './InventoryList/SearchBar';
import useInventoryData from '../hooks/useInventoryData';
import inventoryUtils from '../utils/inventoryUtils';

function InventoryList() {
  const {
    items,
    loading,
    error,
    selectedItem,
    itemDetails,
    loadingDetails,
    fetchItems,
    saveItem,
    deleteItem,
    loadItemDetails,
    setSelectedItem,
    clearSelection,
    setError
  } = useInventoryData();

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItem = () => {
    setSelectedItem(null);
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleEditItem = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItem(inventoryUtils.formatItemForForm(item));
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleSaveItem = async (itemData) => {
    const success = await saveItem(itemData, dialogMode);
    if (success) {
      setDialogOpen(false);
      clearSelection();
    }
  };

  const handleDeleteItem = async (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await deleteItem(itemId);
    if (success) {
      clearSelection();
    }
  };

  const handleRowClick = async (item) => {
    const success = await loadItemDetails(item);
    if (success) {
      setDetailsOpen(true);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleItemClick = async (item) => {
    const success = await loadItemDetails(item);
    if (success) {
      setDetailsOpen(true);
    }
  };

  const filteredItems = inventoryUtils.filterItems(items, searchTerm);
  const displayedItems = filteredItems.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        height: 'calc(100vh - 64px)', // Subtract app bar height
        display: 'flex',
        flexDirection: 'column',
        p: 2
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Inventory Items</Typography>
        <SearchBar 
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onAddItem={handleAddItem}
        />
      </Box>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Table container with flex-grow */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <ItemTable 
          items={items}
          displayedItems={displayedItems}
          getChangeSource={inventoryUtils.getChangeSource}
          onRowClick={handleRowClick}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
        />
      </Box>
      
      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredItems.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      {/* Dialogs */}
      <ItemDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          clearSelection();
        }}
        item={selectedItem}
        onSave={handleSaveItem}
        mode={dialogMode}
      />

      <ItemDetailsDialog
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          clearSelection();
        }}
        item={itemDetails}
        onItemClick={handleItemClick}
      />

      {/* Loading overlay */}
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
    </Box>
  );
}

export default InventoryList;
