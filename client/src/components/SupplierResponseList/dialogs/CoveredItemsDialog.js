import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  TextField,
  TablePagination,
  InputAdornment,
  Paper,
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  LocalOffer as LocalOfferIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { debounce } from 'lodash';
import { dataDebug } from '../../../utils/debug';

export function CoveredItemsDialog({ open, onClose, promotionId, supplierName = '' }) {
  const [loading, setLoading] = React.useState(true);
  const [searching, setSearching] = React.useState(false);
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5000); // Show 5000 items by default
  const [totalItems, setTotalItems] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');

  const fetchItems = React.useCallback(async () => {
    try {
      setLoading(true);

      // Convert page to 1-based for API
      const params = {
        page: page + 1,
        pageSize: rowsPerPage,
        search: search.trim()
      };

      // Log request details
      dataDebug.log('Fetching items:', {
        promotionId,
        params,
        url: `/api/promotions/${promotionId}/items`
      });

      // Explicitly construct query string to ensure numbers are sent correctly
      const queryString = new URLSearchParams({
        page: params.page.toString(),
        pageSize: params.pageSize.toString(),
        search: params.search
      }).toString();

      const response = await axios.get(`/api/promotions/${promotionId}/items?${queryString}`);
      
      dataDebug.log('Response:', response.data);
      
      setItems(response.data.data.items);
      setTotalItems(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching promotion items:', error);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [promotionId, page, rowsPerPage, search]);

  // Debounced search
  const debouncedSearch = React.useMemo(
    () => debounce((value) => {
      setSearch(value);
      setPage(0); // Reset to first page on search
      setSearching(false);
    }, 500),
    []
  );

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchInput(value);
    setSearching(true);
    debouncedSearch(value);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newSize = parseInt(event.target.value, 10);
    dataDebug.log('Changing rows per page:', newSize);
    setRowsPerPage(newSize);
    setPage(0);
  };

  React.useEffect(() => {
    if (open && promotionId) {
      fetchItems();
    }
  }, [open, promotionId, fetchItems]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CheckCircleIcon color="success" />
          <Typography>Covered Items for {supplierName} ({totalItems})</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box mb={2}>
          <Paper elevation={1} sx={{ p: 1 }}>
            <TextField
              fullWidth
              value={searchInput}
              placeholder="Search by ID or description..."
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {searching ? <CircularProgress size={20} /> : <SearchIcon />}
                  </InputAdornment>
                ),
              }}
            />
          </Paper>
        </Box>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Response Date</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <TableRow 
                        key={item.supplier_response_id || `${item.item_id}-${item.response_date}`}
                        hover
                        sx={{
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          }
                        }}
                      >
                        <TableCell>{item.item_id}</TableCell>
                        <TableCell>
                          <Typography>{item.hebrew_description}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.english_description}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">€{Number(item.promotion_price || item.price_quoted).toFixed(2)}</TableCell>
                        <TableCell>
                          {new Date(item.response_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{item.notes || '-'}</TableCell>
                        <TableCell>
                          {item.is_promotion ? (
                            <Chip
                              icon={<LocalOfferIcon />}
                              label="Promotion"
                              size="small"
                              color="secondary"
                            />
                          ) : (
                            <Chip
                              label="Regular"
                              size="small"
                              color="default"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">
                          {search ? 'No matching items found' : 'No items found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={totalItems}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[1000, 2000, 5000, 10000]} // Larger page size options
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
