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
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  GetApp as DownloadIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  People as PeopleIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatIlsPrice } from '../utils/priceUtils';

function InquiryItemsDialog({ open, onClose, items, onViewDetails }) {
  const [sortField, setSortField] = useState('itemID');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = (bValue || '').toLowerCase();
    }

    if (aValue === bValue) return 0;
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Inquiry Items</span>
        {items.length > 0 && (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={onViewDetails}
          >
            View Full Details
          </Button>
        )}
      </DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell 
                  onClick={() => handleSort('itemID')}
                  sx={{ cursor: 'pointer' }}
                >
                  Item ID <SortIcon field="itemID" />
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('hebrewDescription')}
                  sx={{ cursor: 'pointer' }}
                >
                  Hebrew Description <SortIcon field="hebrewDescription" />
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('englishDescription')}
                  sx={{ cursor: 'pointer' }}
                >
                  English Description <SortIcon field="englishDescription" />
                </TableCell>
                <TableCell 
                  align="right"
                  onClick={() => handleSort('importMarkup')}
                  sx={{ cursor: 'pointer' }}
                >
                  Import Markup <SortIcon field="importMarkup" />
                </TableCell>
                <TableCell 
                  align="right"
                  onClick={() => handleSort('retailPrice')}
                  sx={{ cursor: 'pointer' }}
                >
                  Retail Price <SortIcon field="retailPrice" />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No items found</TableCell>
                </TableRow>
              ) : (
                sortedItems.map((item, index) => (
                  <TableRow key={`${item.inquiryItemID || item.itemID || index}`}>
                    <TableCell>{item.itemID}</TableCell>
                    <TableCell>{item.hebrewDescription}</TableCell>
                    <TableCell>{item.englishDescription}</TableCell>
                    <TableCell align="right">{item.importMarkup?.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {formatIlsPrice(item.retailPrice) || (
                        <Typography variant="body2" color="error">
                          No Price
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  );
}

function InquiryList() {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inquiryItems, setInquiryItems] = useState([]);
  const [currentInquiryId, setCurrentInquiryId] = useState(null);
  const [sortField, setSortField] = useState('customNumber');
  const [sortDirection, setSortDirection] = useState('asc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [inquiryToDelete, setInquiryToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedInquiries = [...inquiries].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (sortField === 'date') {
      aValue = new Date(aValue || 0).getTime();
      bValue = new Date(bValue || 0).getTime();
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = (bValue || '').toLowerCase();
    }

    if (aValue === bValue) return 0;
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />;
  };

  const fetchInquiries = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/inquiries`);
      setInquiries(response.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching inquiries:', err);
      setError('Failed to load inquiries. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInquiry = async (inquiryId) => {
    try {
      setCurrentInquiryId(inquiryId);
      const response = await axios.get(`${API_BASE_URL}/api/inquiries/${inquiryId}`);
      setInquiryItems(response.data.items || []);
      setDialogOpen(true);
    } catch (err) {
      console.error('Error fetching inquiry details:', err);
    }
  };

  const handleExportInquiry = async (inquiryId) => {
    try {
      setIsExporting(true);
      const response = await axios.get(`${API_BASE_URL}/api/inquiries/${inquiryId}/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'inquiry-export.xlsx';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting inquiry:', err);
      setError('Failed to export inquiry. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewFullDetails = () => {
    setDialogOpen(false);
    if (currentInquiryId) {
      navigate(`/inquiries/${currentInquiryId}`);
    }
  };

  const handleDeleteInquiry = async () => {
    try {
      setIsDeleting(true);
      await axios.delete(`${API_BASE_URL}/api/inquiries/${inquiryToDelete.inquiryID}`);
      setDeleteConfirmOpen(false);
      setInquiryToDelete(null);
      fetchInquiries();
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details || 
                          error.response?.data?.message || 
                          error.message || 
                          'An unknown error occurred';
      setError(`Failed to delete inquiry: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase() || '') {
      case 'processed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
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

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Inquiries
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell 
                onClick={() => handleSort('customNumber')}
                sx={{ cursor: 'pointer' }}
              >
                Custom Number <SortIcon field="customNumber" />
              </TableCell>
              <TableCell 
                onClick={() => handleSort('date')}
                sx={{ cursor: 'pointer' }}
              >
                Date <SortIcon field="date" />
              </TableCell>
              <TableCell 
                onClick={() => handleSort('status')}
                sx={{ cursor: 'pointer' }}
              >
                Status <SortIcon field="status" />
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => handleSort('itemCount')}
                sx={{ cursor: 'pointer' }}
              >
                Items <SortIcon field="itemCount" />
              </TableCell>
              <TableCell>Response Stats</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedInquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No inquiries found
                </TableCell>
              </TableRow>
            ) : (
              sortedInquiries.map((inquiry) => (
                <TableRow key={inquiry.inquiryID}>
                  <TableCell>{inquiry.customNumber}</TableCell>
                  <TableCell>{new Date(inquiry.date || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={inquiry.status || 'Unknown'}
                      color={getStatusColor(inquiry.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{inquiry.itemCount || 0}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        icon={<PeopleIcon />}
                        label={`${inquiry.respondedSuppliersCount || 0} Suppliers`}
                        color="primary"
                        size="small"
                      />
                      {inquiry.notRespondedItemsCount > 0 && (
                        <Chip
                          icon={<WarningIcon />}
                          label={`${inquiry.notRespondedItemsCount} Not Responded`}
                          color="error"
                          size="small"
                        />
                      )}
                      {inquiry.totalReplacementsCount > 0 && (
                        <Chip
                          icon={<SwapHorizIcon />}
                          label={`${inquiry.totalReplacementsCount} Replacements`}
                          color="info"
                          size="small"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Quick View">
                      <IconButton 
                        size="small"
                        onClick={() => handleViewInquiry(inquiry.inquiryID)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small"
                        onClick={() => navigate(`/inquiries/${inquiry.inquiryID}`)}
                      >
                        <ArrowForwardIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Export for Suppliers">
                      <IconButton 
                        size="small"
                        onClick={() => handleExportInquiry(inquiry.inquiryID)}
                        disabled={isExporting}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Inquiry">
                      <IconButton 
                        size="small"
                        color="error"
                        onClick={() => {
                          setInquiryToDelete(inquiry);
                          setDeleteConfirmOpen(true);
                        }}
                        sx={{ 
                          '&:hover': { 
                            backgroundColor: 'rgba(211, 47, 47, 0.1)',
                            color: 'error.main',
                          },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <InquiryItemsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        items={inquiryItems}
        onViewDetails={handleViewFullDetails}
      />

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !isDeleting && setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Inquiry</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this inquiry? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteConfirmOpen(false);
              setInquiryToDelete(null);
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteInquiry} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InquiryList;
