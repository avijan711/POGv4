import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import axios from 'axios';
import ItemDialog from './ItemDialog.js';
import ItemDetailsDialog from './ItemDetailsDialog.js';
import { API_BASE_URL } from '../config';

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
      
      setItems(itemsWithDetails);
      setError('');
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to load inventory items. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleEditItem = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
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
      console.error('Error saving item:', error);
      setError('Failed to save item. Please try again.');
    }
  };

  const handleDeleteItem = async (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/items/${itemId}`);
        fetchItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        // Display the error message from the backend if available
        const errorMessage = error.response?.data?.message || 'Failed to delete item. Please try again.';
        setError(errorMessage);
      }
    }
  };

  const handleRowClick = async (item) => {
    try {
      setLoadingDetails(true);
      const response = await axios.get(`${API_BASE_URL}/api/items/${item.itemID}`);
      const fullDetails = response.data;
      
      // Merge the reference data from the list view with the full details
      const mergedData = {
        ...fullDetails,
        item: {
          ...fullDetails.item,
          referenceChange: item.referenceChange,
          hasReferenceChange: item.hasReferenceChange,
          isReferencedBy: item.isReferencedBy,
          referencingItems: item.referencingItems
        }
      };
      
      setItemDetails(mergedData);
      setDetailsOpen(true);
    } catch (error) {
      console.error('Error fetching item details:', error);
      setError('Failed to load item details. Please try again.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedItem(null);
    setError('');
  };

  const handleDetailsClose = () => {
    setDetailsOpen(false);
    setItemDetails(null);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search items..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="inventory table">
          <TableHead>
            <TableRow>
              <TableCell>Item ID</TableCell>
              <TableCell>Hebrew Description</TableCell>
              <TableCell>English Description</TableCell>
              <TableCell align="right">Import Markup</TableCell>
              <TableCell>HS Code</TableCell>
              <TableCell>Image</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell align="right">Sold This Year</TableCell>
              <TableCell align="right">Sold Last Year</TableCell>
              <TableCell align="right">Retail Price (ILS)</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} align="center">
                  No items found
                </TableCell>
              </TableRow>
            ) : (
              displayedItems.map((item) => {
                // Check if this item is referenced by any other item
                const isNewReference = items.some(otherItem => 
                  otherItem.referenceChange && 
                  otherItem.referenceChange.newReferenceID === item.itemID
                );

                // Find the items that reference this item
                const referencingItems = items.filter(otherItem => 
                  otherItem.referenceChange && 
                  otherItem.referenceChange.newReferenceID === item.itemID
                );

                return (
                  <TableRow 
                    key={item.itemID}
                    onClick={() => handleRowClick(item)}
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: item.hasReferenceChange 
                        ? 'rgba(255, 243, 224, 0.9)'  // Orange for items being replaced
                        : isNewReference
                          ? '#e8f5e9'  // Solid light green for new reference items
                          : 'inherit',
                      '&:hover': { 
                        backgroundColor: item.hasReferenceChange 
                          ? 'rgba(255, 243, 224, 1)' 
                          : isNewReference
                            ? '#c8e6c9'  // Darker green on hover
                            : 'rgba(0, 0, 0, 0.04)' 
                      }
                    }}
                  >
                    <TableCell>{item.itemID}</TableCell>
                    <TableCell>{item.hebrewDescription}</TableCell>
                    <TableCell>{item.englishDescription}</TableCell>
                    <TableCell align="right">{Number(item.importMarkup).toFixed(2)}</TableCell>
                    <TableCell>{item.hsCode}</TableCell>
                    <TableCell>
                      {item.image && (
                        <img 
                          src={`${API_BASE_URL}/uploads/${item.image}`} 
                          alt={item.englishDescription || item.hebrewDescription}
                          style={{ maxWidth: '50px', maxHeight: '50px' }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">{item.qtyInStock || 0}</TableCell>
                    <TableCell align="right">{item.soldThisYear || 0}</TableCell>
                    <TableCell align="right">{item.soldLastYear || 0}</TableCell>
                    <TableCell align="right">
                      {item.retailPrice || (
                        <Typography variant="body2" color="error">
                          No Price
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.hasReferenceChange && (
                        <Box>
                          <Chip
                            label={`→ ${item.referenceChange.newReferenceID}`}
                            color="warning"
                            variant="outlined"
                            size="small"
                          />
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            {getChangeSource(item.referenceChange)}
                          </Typography>
                        </Box>
                      )}
                      {isNewReference && (
                        <Box sx={{ mt: item.hasReferenceChange ? 1 : 0 }}>
                          <Chip
                            label={`← ${referencingItems.map(i => i.itemID).join(', ')}`}
                            color="success"
                            variant="outlined"
                            size="small"
                          />
                          {referencingItems.map((refItem, index) => (
                            <Typography key={index} variant="caption" display="block" sx={{ mt: 0.5 }}>
                              {getChangeSource(refItem.referenceChange)}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                        <Tooltip title="Edit Item">
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleEditItem(e, item)}
                            sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Item">
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={(e) => handleDeleteItem(e, item.itemID)}
                            sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
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
        onClose={handleDialogClose}
        item={selectedItem}
        onSave={handleSaveItem}
        mode={dialogMode}
      />

      <ItemDetailsDialog
        open={detailsOpen}
        onClose={handleDetailsClose}
        item={itemDetails}
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
