import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
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
  Collapse,
  Snackbar,
} from '@mui/material';
import {
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  LocalOffer as LocalOfferIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
} from '@mui/icons-material';
import { useSupplierResponses } from '../hooks/useSupplierResponses';

function MissingItemsDialog({ open, onClose, items = [], supplierName = '' }) {
  const parsedItems = React.useMemo(() => {
    try {
      // Handle supplierSpecificMissing structure
      if (items && Array.isArray(items.supplierSpecificMissing)) {
        const supplierMissing = items.supplierSpecificMissing[0];
        return supplierMissing ? (Array.isArray(supplierMissing.items) ? supplierMissing.items : []) : [];
      }
      
      // Handle direct array
      if (Array.isArray(items)) {
        return items.filter(Boolean);
      }

      // Handle string
      if (typeof items === 'string') {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }

      return [];
    } catch (e) {
      console.error('Error parsing missing items:', e);
      return [];
    }
  }, [items]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          <Typography>Missing Items for {supplierName} ({parsedItems.length})</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Requested Qty</TableCell>
                <TableCell align="right">Retail Price</TableCell>
                <TableCell>Origin</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parsedItems.length > 0 ? (
                parsedItems.map((item) => (
                  <TableRow key={item.item_id}>
                    <TableCell>{item.item_id}</TableCell>
                    <TableCell>
                      <Typography>{item.hebrew_description}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.english_description}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{item.requested_qty}</TableCell>
                    <TableCell align="right">₪{Number(item.retail_price).toFixed(2)}</TableCell>
                    <TableCell>{item.origin || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">No missing items found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function SupplierRow({ supplierId, supplierData, totalExpectedItems, onDelete, onDeleteItem, onShowMissing }) {
  const [open, setOpen] = React.useState(false);
  
  const missingItemsData = React.useMemo(() => {
    try {
      // Handle supplierSpecificMissing structure
      if (supplierData.missingItems && Array.isArray(supplierData.missingItems.supplierSpecificMissing)) {
        const supplierMissing = supplierData.missingItems.supplierSpecificMissing.find(
          s => s.supplier_id === supplierId
        );
        return {
          items: supplierMissing ? (supplierMissing.items || []) : [],
          count: supplierMissing ? supplierMissing.missingCount : 0
        };
      }

      // Handle direct array
      if (Array.isArray(supplierData.missingItems)) {
        return {
          items: supplierData.missingItems.filter(Boolean),
          count: supplierData.missingItems.length
        };
      }

      // Handle string
      if (typeof supplierData.missingItems === 'string') {
        const parsed = JSON.parse(supplierData.missingItems);
        const items = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        return {
          items,
          count: items.length
        };
      }

      return { items: [], count: 0 };
    } catch (e) {
      console.error('Error parsing missing items:', e);
      return { items: [], count: 0 };
    }
  }, [supplierData.missingItems, supplierId]);

  const missingItemsCount = supplierData.missing_count || missingItemsData.count;

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">
              {supplierData.supplier_name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell align="right">
          <Chip
            label={`${supplierData.item_count || 0} Items`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </TableCell>
        <TableCell align="right">₪{Number(supplierData.average_price || 0).toFixed(2)}</TableCell>
        <TableCell align="right">{new Date(supplierData.latest_response || new Date()).toLocaleDateString()}</TableCell>
        <TableCell align="right">
          {missingItemsCount === 0 ? (
            <Chip
              icon={<CheckCircleIcon />}
              label="Complete"
              size="small"
              color="success"
            />
          ) : (
            <Chip
              icon={<InfoIcon />}
              label={`${missingItemsCount} Missing`}
              size="small"
              color="warning"
              onClick={() => onShowMissing({
                ...supplierData,
                missingItems: missingItemsData.items
              })}
              sx={{ cursor: 'pointer' }}
            />
          )}
        </TableCell>
        <TableCell align="right">
          <Button
            startIcon={<DeleteIcon />}
            color="error"
            onClick={() => onDelete(supplierData)}
          >
            Delete All
          </Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div">
                Responses
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Response Date</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplierData.responses.map((response) => (
                    <TableRow key={response.supplier_response_id || `${response.item_id}-${response.response_date}`}>
                      <TableCell component="th" scope="row">{response.item_id}</TableCell>
                      <TableCell>
                        <Typography>{response.hebrew_description}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {response.english_description}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Chip
                            icon={<AttachMoneyIcon />}
                            label={`₪${Number(response.price_quoted || 0).toFixed(2)}`}
                            color={response.is_promotion ? "secondary" : "default"}
                            variant="outlined"
                            size="small"
                          />
                          {response.is_promotion && (
                            <Chip
                              icon={<LocalOfferIcon />}
                              label="Promotion"
                              color="secondary"
                              size="small"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{new Date(response.response_date || new Date()).toLocaleDateString()}</TableCell>
                      <TableCell>{response.notes || '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDeleteItem(response)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function SupplierResponseList({ inquiryId }) {
  const {
    loading,
    error,
    responses,
    stats,
    fetchResponses,
    deleteResponse,
    deleteBulkResponses,
    setStats
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
        console.log('Deleting individual response:', {
            responseId: itemToDelete.supplier_response_id,
            itemId: itemToDelete.item_id
        });

        const success = await deleteResponse(itemToDelete.supplier_response_id);
        if (success) {
            setSnackbar({
                open: true,
                message: 'Response deleted successfully',
                severity: 'success'
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
            severity: 'error'
        });
    }
  };

  const handleBulkDelete = async () => {
    if (!supplierToDelete) return;

    try {
        // Validate supplier data
        if (!supplierToDelete.supplier_id) {
            throw new Error('Missing supplier ID');
        }

        if (!supplierToDelete.latest_response) {
            throw new Error('No response date found');
        }

        // Use the latest_response if it exists and is valid, otherwise use current date
        const date = supplierToDelete.latest_response ? 
            new Date(supplierToDelete.latest_response) : 
            new Date();

        // Format the date as YYYY-MM-DD
        const formattedDate = date.getFullYear() + '-' + 
            String(date.getMonth() + 1).padStart(2, '0') + '-' + 
            String(date.getDate()).padStart(2, '0');

        // Debug log to verify the data being sent
        console.log('Bulk delete params:', {
            date: formattedDate,
            supplierId: supplierToDelete.supplier_id,
            latest_response: supplierToDelete.latest_response,
            itemCount: supplierToDelete.item_count,
            supplierName: supplierToDelete.supplier_name
        });

        // Ensure supplier_id is a number
        const supplierId = parseInt(supplierToDelete.supplier_id, 10);
        if (isNaN(supplierId)) {
            throw new Error('Invalid supplier ID format');
        }

        const success = await deleteBulkResponses(formattedDate, supplierId);
        
        if (success) {
            setSnackbar({
                open: true,
                message: `Successfully deleted ${supplierToDelete.item_count} responses for ${supplierToDelete.supplier_name}`,
                severity: 'success'
            });
            await fetchResponses(); // Refresh the list
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
            severity: 'error'
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

  // Use server-provided statistics
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

      {/* Bulk Delete Dialog */}
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

      {/* Missing Items Dialog */}
      <MissingItemsDialog
        open={missingItemsDialogOpen}
        onClose={() => {
          setMissingItemsDialogOpen(false);
          setSelectedSupplier(null);
        }}
        items={selectedSupplier?.missingItems || []}
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

export default SupplierResponseList;
