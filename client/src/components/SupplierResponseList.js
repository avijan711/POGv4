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

function SupplierRow({ supplierId, supplierData, totalExpectedItems, onDelete, onDeleteItem }) {
  const [open, setOpen] = React.useState(false);

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
            label={`${supplierData.totalItems || 0} Items`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </TableCell>
        <TableCell align="right">₪{Number(supplierData.averagePrice || 0).toFixed(2)}</TableCell>
        <TableCell align="right">{new Date(supplierData.latestResponse || new Date()).toLocaleDateString()}</TableCell>
        <TableCell align="right">
          {(supplierData.totalItems || 0) >= totalExpectedItems ? (
            <Chip
              icon={<CheckCircleIcon />}
              label="Complete"
              size="small"
              color="success"
            />
          ) : (
            <Chip
              icon={<InfoIcon />}
              label={`${totalExpectedItems - (supplierData.totalItems || 0)} Missing`}
              size="small"
              color="warning"
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

  useEffect(() => {
    if (inquiryId) {
      fetchResponses();
    }
  }, [inquiryId, fetchResponses]);

  const handleDeleteResponse = async () => {
    if (itemToDelete) {
      await deleteResponse(itemToDelete.supplier_response_id);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (supplierToDelete) {
      const date = new Date(supplierToDelete.latestResponse).toISOString().split('T')[0];
      await deleteBulkResponses(date, supplierToDelete.supplier_id);
      setBulkDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
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
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Response Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Response</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this response? This action cannot be undone.
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
      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)}>
        <DialogTitle>Delete All Responses</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all responses from {supplierToDelete?.supplier_name}? 
            This will remove {supplierToDelete?.totalItems} responses and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDelete} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SupplierResponseList;
