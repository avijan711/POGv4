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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function OrderFulfillment({ orderId }) {
  const [orderStatus, setOrderStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fulfillmentDialog, setFulfillmentDialog] = useState({
    open: false,
    orderItemId: null,
    maxQuantity: 0,
  });
  const [historyDialog, setHistoryDialog] = useState({
    open: false,
    orderItemId: null,
    history: [],
  });
  const [formData, setFormData] = useState({
    quantitySupplied: '',
    notes: '',
  });

  const fetchOrderStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/orders/${orderId}/fulfillment-status`);
      setOrderStatus(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load order status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderStatus();
    }
  }, [orderId]);

  const handleFulfillmentClick = (orderItemId, remainingQuantity) => {
    setFulfillmentDialog({
      open: true,
      orderItemId,
      maxQuantity: remainingQuantity,
    });
    setFormData({
      quantitySupplied: '',
      notes: '',
    });
  };

  const handleHistoryClick = async (orderItemId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/orders/${orderId}/items/${orderItemId}/fulfillments`);
      setHistoryDialog({
        open: true,
        orderItemId,
        history: response.data,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load fulfillment history');
    }
  };

  const handleFulfillmentSubmit = async () => {
    try {
      setError(null);
      const quantity = parseInt(formData.quantitySupplied);
            
      if (isNaN(quantity) || quantity <= 0) {
        setError('Please enter a valid quantity');
        return;
      }

      if (quantity > fulfillmentDialog.maxQuantity) {
        setError('Cannot supply more than remaining quantity');
        return;
      }

      await axios.post(
        `${API_BASE_URL}/api/orders/${orderId}/items/${fulfillmentDialog.orderItemId}/fulfillments`,
        {
          quantitySupplied: quantity,
          notes: formData.notes,
        },
      );

      setFulfillmentDialog({ open: false, orderItemId: null, maxQuantity: 0 });
      fetchOrderStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record fulfillment');
    }
  };

  if (loading) {
    return <LinearProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!orderStatus) {
    return <Alert severity="info">No order data available</Alert>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
                Order Fulfillment Status
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item ID</TableCell>
              <TableCell align="right">Ordered</TableCell>
              <TableCell align="right">Supplied</TableCell>
              <TableCell align="right">Remaining</TableCell>
              <TableCell align="center">Progress</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orderStatus.map((item) => {
              const progress = (item.supplied_quantity / item.ordered_quantity) * 100;
                            
              return (
                <TableRow key={item.order_item_id}>
                  <TableCell>{item.item_id}</TableCell>
                  <TableCell align="right">{item.ordered_quantity}</TableCell>
                  <TableCell align="right">{item.supplied_quantity}</TableCell>
                  <TableCell align="right">{item.remaining_quantity}</TableCell>
                  <TableCell>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={progress}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: progress === 100 ? '#4caf50' : '#2196f3',
                          },
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      sx={{
                        color: item.fulfillment_status === 'fulfilled' ? 'success.main' :
                          item.fulfillment_status === 'partial' ? 'info.main' : 'text.secondary',
                      }}
                    >
                      {item.fulfillment_status}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Tooltip title="View History">
                        <IconButton
                          size="small"
                          onClick={() => handleHistoryClick(item.order_item_id)}
                        >
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                      {item.remaining_quantity > 0 && (
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleFulfillmentClick(
                            item.order_item_id,
                            item.remaining_quantity,
                          )}
                        >
                                                    Record Supply
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Fulfillment Dialog */}
      <Dialog 
        open={fulfillmentDialog.open} 
        onClose={() => setFulfillmentDialog({ open: false, orderItemId: null, maxQuantity: 0 })}
      >
        <DialogTitle>Record Supply</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Quantity Supplied"
            type="number"
            fullWidth
            margin="normal"
            value={formData.quantitySupplied}
            onChange={(e) => setFormData({ ...formData, quantitySupplied: e.target.value })}
            inputProps={{
              min: 1,
              max: fulfillmentDialog.maxQuantity,
            }}
            helperText={`Maximum quantity: ${fulfillmentDialog.maxQuantity}`}
          />
          <TextField
            label="Notes"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFulfillmentDialog({ open: false, orderItemId: null, maxQuantity: 0 })}>
                        Cancel
          </Button>
          <Button onClick={handleFulfillmentSubmit} variant="contained">
                        Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={historyDialog.open}
        onClose={() => setHistoryDialog({ open: false, orderItemId: null, history: [] })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Fulfillment History</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyDialog.history.map((record) => (
                  <TableRow key={record.fulfillment_id}>
                    <TableCell>
                      {new Date(record.fulfillment_date).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      {record.quantity_supplied}
                    </TableCell>
                    <TableCell>{record.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog({ open: false, orderItemId: null, history: [] })}>
                        Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OrderFulfillment;
