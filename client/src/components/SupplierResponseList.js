import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  IconButton,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSupplierResponses } from '../hooks/useSupplierResponses';
import { MissingItemsDialog } from './SupplierResponseList/dialogs/MissingItemsDialog';
import { CoveredItemsDialog } from './SupplierResponseList/dialogs/CoveredItemsDialog';
import { SupplierRow } from './SupplierResponseList/SupplierRow';

function SupplierResponseList({ inquiryId }) {
  const {
    loading,
    error,
    responses,
    stats,
    fetchResponses,
    deleteResponse,
    deleteBulkResponses,
  } = useSupplierResponses(inquiryId);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [supplierToDelete, setSupplierToDelete] = React.useState(null);
  const [missingItemsDialogOpen, setMissingItemsDialogOpen] = React.useState(false);
  const [coveredItemsDialogOpen, setCoveredItemsDialogOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState(null);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    if (inquiryId) {
      fetchResponses();
    }
  }, [inquiryId, fetchResponses]);

  const handleDeleteResponse = async () => {
    if (!itemToDelete) return;

    try {
      console.log('Deleting individual response:', {
        responseId: itemToDelete.supplier_response_id,
        itemId: itemToDelete.item_id,
      });

      const success = await deleteResponse(itemToDelete.supplier_response_id);
      if (success) {
        setSnackbar({
          open: true,
          message: 'Response deleted successfully',
          severity: 'success',
        });
        await fetchResponses(); // Refresh the list
      } else {
        throw new Error('Failed to delete response');
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting response:', error);
      setSnackbar({
        open: true,
        message: `Failed to delete response: ${error.message}`,
        severity: 'error',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!supplierToDelete) return;

    try {
      if (!supplierToDelete.supplier_id) {
        throw new Error('Missing supplier ID');
      }

      if (!supplierToDelete.latest_response) {
        throw new Error('No response date found');
      }

      const date = supplierToDelete.latest_response ? 
        new Date(supplierToDelete.latest_response) : 
        new Date();

      const formattedDate = date.getFullYear() + '-' + 
            String(date.getMonth() + 1).padStart(2, '0') + '-' + 
            String(date.getDate()).padStart(2, '0');

      console.log('Bulk delete params:', {
        date: formattedDate,
        supplierId: supplierToDelete.supplier_id,
        latest_response: supplierToDelete.latest_response,
        itemCount: supplierToDelete.item_count,
        supplierName: supplierToDelete.supplier_name,
      });

      const supplierId = parseInt(supplierToDelete.supplier_id, 10);
      if (isNaN(supplierId)) {
        throw new Error('Invalid supplier ID format');
      }

      const success = await deleteBulkResponses(formattedDate, supplierId);
        
      if (success) {
        setSnackbar({
          open: true,
          message: `Successfully deleted ${supplierToDelete.item_count} responses for ${supplierToDelete.supplier_name}`,
          severity: 'success',
        });
        await fetchResponses();
      } else {
        throw new Error('Failed to delete responses');
      }
        
      setBulkDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      setSnackbar({
        open: true,
        message: `Failed to delete responses: ${error.message}`,
        severity: 'error',
      });
    }
  };

  const handleShowMissingItems = (supplier) => {
    // Enhanced debug logging
    console.log('handleShowMissingItems called with:', {
      supplier_name: supplier.supplier_name,
      missing_items_type: typeof supplier.missing_items,
      isArray: Array.isArray(supplier.missing_items),
      missing_items_length: supplier.missing_items?.length,
      missing_count: supplier.missing_count,
      raw_missing_items: supplier.missing_items,
    });

    // Create a clean copy of the supplier data to prevent reference issues
    const supplierData = {
      ...supplier,
      missing_items: Array.isArray(supplier.missing_items) 
        ? [...supplier.missing_items]
        : [],
    };

    console.log('Setting selectedSupplier with:', {
      supplier_name: supplierData.supplier_name,
      missing_items_length: supplierData.missing_items.length,
      first_item: supplierData.missing_items[0],
    });

    setSelectedSupplier(supplierData);
    setMissingItemsDialogOpen(true);
  };

  const handleShowCovered = (supplier) => {
    console.log('Showing covered items:', supplier);
    setSelectedSupplier(supplier);
    setCoveredItemsDialogOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!responses || Object.keys(responses).length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No supplier responses yet
      </Alert>
    );
  }

  const totalItems = stats.totalItems || 0;
  const respondedItems = stats.respondedItems || 0;
  const missingResponses = stats.missingResponses || 0;
  const responseRate = totalItems ? Math.round((respondedItems / totalItems) * 100) : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Supplier Responses
        </Typography>
        <IconButton onClick={fetchResponses} size="small" title="Refresh responses">
          <RefreshIcon />
        </IconButton>
      </Box>

      <Card sx={{ mb: 3, bgcolor: 'background.default' }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {stats.totalSuppliers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Responding Suppliers
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {respondedItems}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Responded Items
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error">
                  {missingResponses}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Missing Responses
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">
                  {responseRate}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Response Rate
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ mt: 2 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={responseRate} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Supplier</TableCell>
              <TableCell align="right">Items</TableCell>
              <TableCell align="right">Average Price</TableCell>
              <TableCell align="right">Latest Response</TableCell>
              <TableCell align="right">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(responses).map(([supplierId, supplierData]) => (
              <SupplierRow
                key={supplierId}
                supplierId={supplierId}
                supplierData={supplierData}
                totalExpectedItems={totalItems}
                onDelete={(supplier) => {
                  setSupplierToDelete(supplier);
                  setBulkDeleteDialogOpen(true);
                }}
                onDeleteItem={(item) => {
                  setItemToDelete(item);
                  setDeleteDialogOpen(true);
                }}
                onShowMissing={handleShowMissingItems}
                onShowCovered={handleShowCovered}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Response</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this response for item {itemToDelete?.item_id}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteResponse} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={bulkDeleteDialogOpen} 
        onClose={() => setBulkDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete All Responses</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all responses from {supplierToDelete?.supplier_name}? 
            This will remove {supplierToDelete?.item_count || 0} responses and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDelete} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>

      <MissingItemsDialog
        open={missingItemsDialogOpen}
        onClose={() => {
          setMissingItemsDialogOpen(false);
          setSelectedSupplier(null);
        }}
        items={selectedSupplier?.missing_items || []}
        supplierName={selectedSupplier?.supplier_name || ''}
      />

      <CoveredItemsDialog
        open={coveredItemsDialogOpen}
        onClose={() => {
          setCoveredItemsDialogOpen(false);
          setSelectedSupplier(null);
        }}
        promotionId={selectedSupplier?.promotion_id}
        supplierName={selectedSupplier?.supplier_name || ''}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default SupplierResponseList;
