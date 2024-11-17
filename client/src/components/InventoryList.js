import React from 'react';
import {
  Box,
  Typography,
  TablePagination,
  CircularProgress,
  Alert,
} from '@mui/material';
import axios from 'axios';
import ItemDialog from './ItemDialog';
import ItemDetailsDialog from './ItemDetailsDialog';
import { API_BASE_URL } from '../config';
import { uiDebug, dataDebug } from '../utils/debug';
import { useState, useEffect } from 'react';

// Import modular components
import ItemTable from './InventoryList/ItemTable';
import SearchBar from './InventoryList/SearchBar';

function InventoryList() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dialogMode, setDialogMode] = useState('add');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      dataDebug.log('Fetching inventory items');
      const response = await axios.get(`${API_BASE_URL}/api/items`);
      const itemsList = response.data;
      
      // Process items to identify references
      const itemsWithDetails = itemsList.map(item => {
        // Find items that reference this item as their new reference
        const referencingItems = itemsList.filter(otherItem => 
          otherItem.referenceChange && 
          otherItem.referenceChange.newReferenceID === item.itemID
        );

        // Process reference change data
        const processedItem = {
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
          }))
        };
        
        return processedItem;
      });
      
      dataDebug.log('Processed items with references:', itemsWithDetails.length);
      setItems(itemsWithDetails);
      setError('');
    } catch (err) {
      dataDebug.error('Error fetching items:', err);
      setError('Failed to load inventory items. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    uiDebug.log('Opening add item dialog');
    setSelectedItem(null);
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleEditItem = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    uiDebug.log('Opening edit item dialog for:', item.itemID);
    const formattedItem = {
      itemID: item.itemID,
      hebrewDescription: item.hebrewDescription,
      englishDescription: item.englishDescription,
      importMarkup: item.importMarkup?.toString(),
      hsCode: item.hsCode || '',
      image: item.image || null,
    };
    setSelectedItem(formattedItem);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleSaveItem = async (itemData) => {
    try {
      dataDebug.log('Saving item:', itemData.get('itemID'));
      if (dialogMode === 'add') {
        await axios.post(`${API_BASE_URL}/api/items`, itemData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        await axios.put(`${API_BASE_URL}/api/items/${itemData.get('itemID')}`, itemData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
      await fetchItems();
      setDialogOpen(false);
      setSelectedItem(null);
      setError('');
    } catch (error) {
      dataDebug.error('Error saving item:', error);
      setError('Failed to save item. Please try again.');
    }
  };

  const handleDeleteItem = async (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        dataDebug.log('Deleting item:', itemId);
        await axios.delete(`${API_BASE_URL}/api/items/${itemId}`);
        fetchItems();
      } catch (error) {
        dataDebug.error('Error deleting item:', error);
        const errorMessage = error.response?.data?.message || 'Failed to delete item. Please try again.';
        setError(errorMessage);
      }
    }
  };

  const handleRowClick = async (item) => {
    try {
      uiDebug.log('Opening item details for:', item.itemID);
      setLoadingDetails(true);
      setDetailsOpen(true);
      
      const response = await axios.get(`${API_BASE_URL}/api/items/${item.itemID}`);
      const fullDetails = response.data;
      
      // Create the merged data structure expected by ItemDetailsDialog
      const mergedData = {
        item: {
          ...fullDetails.item,
          referenceChange: item.referenceChange,
          hasReferenceChange: item.hasReferenceChange,
          isReferencedBy: item.isReferencedBy,
          referencingItems: item.referencingItems
        },
        priceHistory: fullDetails.priceHistory || [],
        supplierPrices: fullDetails.supplierPrices || [],
        promotions: fullDetails.promotions || []
      };
      
      setItemDetails(mergedData);
    } catch (error) {
      dataDebug.error('Error fetching item details:', error);
      if (error.response?.status === 404) {
        setError(`Item ${item.itemID} not found. It may have been deleted.`);
      } else {
        setError('Failed to load item details. Please try again.');
      }
      setDetailsOpen(false);
    } finally {
      setLoadingDetails(false);
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

  const getChangeSource = (referenceChange) => {
    if (!referenceChange) return '';
    
    if (referenceChange.source === 'supplier') {
      return `Changed by supplier ${referenceChange.supplierName || ''}`;
    } else if (referenceChange.source === 'user') {
      return 'Changed by user';
    }
    return '';
  };

  const filteredItems = items.filter((item) =>
    Object.values(item).some((value) =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

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
    <Box sx={{ width: '100%', p: 2 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Inventory Items</Typography>
        <SearchBar 
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onAddItem={handleAddItem}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ItemTable 
        items={items}
        displayedItems={displayedItems}
        getChangeSource={getChangeSource}
        onRowClick={handleRowClick}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
      />
      
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredItems.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <ItemDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedItem(null);
          setError('');
        }}
        item={selectedItem}
        onSave={handleSaveItem}
        mode={dialogMode}
      />

      <ItemDetailsDialog
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setItemDetails(null);
          setError('');
        }}
        item={itemDetails}
        loading={loadingDetails}
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
    </Box>
  );
}

export default InventoryList;
