import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TablePagination,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ItemDialog from './ItemDialog';
import ItemDetailsDialogWrapper from './ItemDetailsDialogWrapper';
import ItemTable from './InventoryList/ItemTable';
import SearchBar from './InventoryList/SearchBar';
import ExportHeadersDialog from './ExportHeadersDialog';
import useInventoryData from '../hooks/useInventoryData';
import inventoryUtils from '../utils/inventoryUtils';
import axiosInstance from '../utils/axiosConfig';

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
    setError,
  } = useInventoryData();

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItem = () => {
    setSelectedItem(null);
    setDialogMode('add');
    setError(''); // Clear any existing errors
    setDialogOpen(true);
  };

  const handleEditItem = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItem(inventoryUtils.formatItemForForm(item));
    setDialogMode('edit');
    setError(''); // Clear any existing errors
    setDialogOpen(true);
  };

  const handleSaveItem = async (itemData) => {
    console.log('Saving item:', {
      itemId: itemData.get('item_id'),
      referenceId: itemData.get('reference_id'),
      hebrewDescription: itemData.get('hebrew_description'),
    });

    const success = await saveItem(itemData, dialogMode);
    if (success) {
      setDialogOpen(false);
      clearSelection();
      await fetchItems(); // Refresh the list
    }
  };

  const handleDeleteItem = async (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await deleteItem(itemId);
    if (success) {
      clearSelection();
      await fetchItems(); // Refresh the list
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

  const handleItemClick = async (itemId) => {
    // Find the item in the current items list
    const item = items.find(i => i.item_id === itemId);
    if (item) {
      const success = await loadItemDetails(item);
      if (success) {
        setDetailsOpen(true);
      }
    }
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleExportConfirm = async (selectedHeaders) => {
    try {
      const response = await axiosInstance.get('/api/items/export', {
        params: { headers: selectedHeaders.join(',') },
        responseType: 'blob',
      });

      // Create a blob from the response data
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      });
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory.xlsx');
      
      // Append link to body, click it, and remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      window.URL.revokeObjectURL(url);
      
      setExportDialogOpen(false);
    } catch (err) {
      console.error('Error exporting inventory:', err);
      setError('Failed to export inventory. Please try again.');
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    clearSelection();
    setError(''); // Clear any existing errors
  };

  const filteredItems = inventoryUtils.filterItems(items, searchTerm);
  const displayedItems = filteredItems.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
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
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Inventory Items</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
          >
            Export
          </Button>
          <SearchBar 
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onAddItem={handleAddItem}
          />
        </Box>
      </Box>

      {/* Error message */}
      {error && !dialogOpen && (
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
        onClose={handleCloseDialog}
        item={selectedItem}
        onSave={handleSaveItem}
        mode={dialogMode}
        error={error}
      />

      <ItemDetailsDialogWrapper
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          clearSelection();
        }}
        item={itemDetails}
        onItemClick={handleItemClick}
        loading={loadingDetails}
      />

      <ExportHeadersDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onConfirm={handleExportConfirm}
      />
    </Box>
  );
}

export default InventoryList;
