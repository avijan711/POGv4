import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function PromotionItemsDialog({ open, onClose, promotion }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open && promotion) {
      fetchItems();
    } else {
      // Clear state when dialog closes
      setItems([]);
      setError(null);
      setSearchTerm('');
    }
  }, [open, promotion]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/promotions/${promotion.promotion_id}/items`);
      // Handle the new response format
      setItems(response.data?.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching promotion items:', err);
      // Extract error message from the new error format
      const errorMessage = err.response?.data?.message || 'Failed to load promotion items';
      const suggestion = err.response?.data?.suggestion;
      setError(suggestion ? `${errorMessage} - ${suggestion}` : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.item_id.toLowerCase().includes(searchLower) ||
            (item.hebrew_description || '').toLowerCase().includes(searchLower) ||
            (item.english_description || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {promotion?.name} - Items
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchTerm('')}
                  >
                    <CloseIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {loading ? (
          <Typography>Loading items...</Typography>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography color="error">{error}</Typography>
            <Button 
              sx={{ mt: 2 }}
              variant="outlined" 
              onClick={fetchItems}
            >
                            Retry
            </Button>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item ID</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography color="textSecondary">
                        {searchTerm ? 'No matching items found' : 'No items in this promotion'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.item_id}>
                      <TableCell>{item.item_id}</TableCell>
                      <TableCell>
                        <Typography>{item.hebrew_description}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {item.english_description}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                                                ₪{Number(item.promotion_price).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="textSecondary">
            {filteredItems.length} items
            {searchTerm && ` (filtered from ${items.length})`}
          </Typography>
          <Typography variant="body2" color="textSecondary">
                        Valid: {new Date(promotion?.start_date).toLocaleDateString()} - {new Date(promotion?.end_date).toLocaleDateString()}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default PromotionItemsDialog;
