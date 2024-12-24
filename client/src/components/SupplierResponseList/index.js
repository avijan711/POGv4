import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useSupplierResponses } from '../../hooks/useSupplierResponses';
import { DeleteConfirmDialog } from './dialogs/DeleteConfirmDialog';
import { MissingItemsDialog } from './dialogs/MissingItemsDialog';
import { SupplierRow } from './SupplierRow';
import { formatDate, validateSupplierForDeletion } from './utils';

export function SupplierResponseList({ inquiryId }) {
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
      const success = await deleteResponse(itemToDelete.supplier_response_id);
      if (success) {
        setSnackbar({
          open: true,
          message: 'Response deleted successfully',
          severity: 'success',
        });
        await fetchResponses();
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
      // Get the latest response date from the supplier's responses
      const latestResponse = supplierToDelete.responses?.length > 0 
        ? supplierToDelete.responses[0].response_date 
        : supplierToDelete.latest_response;

      if (!latestResponse) {
        throw new Error('No response date found for this supplier');
      }

      const date = formatDate(new Date(latestResponse));
      const supplierId = parseInt(supplierToDelete.supplier_id, 10);

      if (isNaN(supplierId)) {
        throw new Error('Invalid supplier ID format');
      }

      console.log('Bulk delete params:', {
        date,
        supplierId,
        supplierData: supplierToDelete,
      });

      const success = await deleteBulkResponses(date, supplierId);
            
      if (success) {
        setSnackbar({
          open: true,
          message: `Successfully deleted responses for ${supplierToDelete.supplier_name}`,
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
    setSelectedSupplier(supplier);
    setMissingItemsDialogOpen(true);
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

  const totalResponses = stats.totalResponses || 0;
  const totalItems = stats.totalItems || 0;
  const respondedItems = stats.respondedItems || 0;
  const missingResponses = stats.missingResponses || 0;
  const responseRate = totalItems ? Math.round((respondedItems / totalItems) * 100) : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
                    Supplier Responses
        </Typography>
        <IconButton onClick={fetchResponses} size="small" title="Refresh responses">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Overall Statistics */}
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

      {/* Supplier Response Table */}
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
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Response Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteResponse}
        title="Delete Response"
        message="Are you sure you want to delete this response? This action cannot be undone."
      />

      {/* Bulk Delete Dialog */}
      <DeleteConfirmDialog
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete All Responses"
        message={`Are you sure you want to delete all responses from ${supplierToDelete?.supplier_name}? 
                        This will remove ${supplierToDelete?.total_items} responses and cannot be undone.`}
      />

      {/* Missing Items Dialog */}
      <MissingItemsDialog
        open={missingItemsDialogOpen}
        onClose={() => {
          setMissingItemsDialogOpen(false);
          setSelectedSupplier(null);
        }}
        items={selectedSupplier?.missing_items || []}
        supplierName={selectedSupplier?.supplier_name || ''}
      />

      {/* Snackbar for notifications */}
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
