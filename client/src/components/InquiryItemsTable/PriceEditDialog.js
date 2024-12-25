import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

function PriceEditDialog({
  open,
  onClose,
  item,
  supplierPrice,
  onSave,
}) {
  const [price, setPrice] = useState('');
  const [isPermanent, setIsPermanent] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);

  useEffect(() => {
    if (open && supplierPrice) {
      setPrice(supplierPrice.price_quoted?.toString() || '');
      setIsPermanent(!!supplierPrice.is_permanent);
      setNotes(supplierPrice.notes || '');
      fetchPriceHistory();
    }
  }, [open, supplierPrice]);

  const fetchPriceHistory = async () => {
    if (!item?.item_id || !supplierPrice?.supplier_id) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/api/prices/history/${item.item_id}/${supplierPrice.supplier_id}`,
      );
      setPriceHistory(response.data || []);
    } catch (err) {
      console.error('Error fetching price history:', err);
      setError('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!price || isNaN(parseFloat(price))) {
        throw new Error('Please enter a valid price');
      }

      const priceData = {
        price: parseFloat(price),
        is_permanent: isPermanent,
        notes: notes.trim(),
      };

      await onSave(priceData);
      onClose();
    } catch (err) {
      console.error('Error saving price:', err);
      setError(err.message || 'Failed to save price');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setPrice('');
    setIsPermanent(false);
    setNotes('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Edit Price - {item?.item_id}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {item?.hebrew_description}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {item?.english_description}
          </Typography>
        </Box>

        <TextField
          label="Price"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: '₪',
          }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={isPermanent}
              onChange={(e) => setIsPermanent(e.target.checked)}
            />
          }
          label={
            <Typography>
              Make this a permanent price for {supplierPrice?.supplier_name}
            </Typography>
          }
          sx={{ mb: 2 }}
        />

        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
          sx={{ mb: 3 }}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Price History
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : priceHistory.length > 0 ? (
          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            {priceHistory.map((record, index) => (
              <Box 
                key={index}
                sx={{ 
                  py: 1,
                  borderBottom: index < priceHistory.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2">
                  ₪{record.price_quoted} 
                  {record.is_permanent && ' (Permanent)'}
                  {record.is_promotion && ' (Promotion)'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(record.date).toLocaleDateString()}
                  {record.notes && ` - ${record.notes}`}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No price history available
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PriceEditDialog;