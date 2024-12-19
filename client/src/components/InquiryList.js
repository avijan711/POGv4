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
  LinearProgress,
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
import { dataDebug, perfDebug } from '../utils/debug';
import ExportHeadersDialog from './ExportHeadersDialog';

function InquiryItemsDialog({ open, onClose, items, onViewDetails }) {
  const [sortField, setSortField] = useState('item_id');
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
                  onClick={() => handleSort('item_id')}
                  sx={{ cursor: 'pointer' }}
                >
                  Item ID <SortIcon field="item_id" />
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('hebrew_description')}
                  sx={{ cursor: 'pointer' }}
                >
                  Hebrew Description <SortIcon field="hebrew_description" />
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('english_description')}
                  sx={{ cursor: 'pointer' }}
                >
                  English Description <SortIcon field="english_description" />
                </TableCell>
                <TableCell 
                  align="right"
                  onClick={() => handleSort('import_markup')}
                  sx={{ cursor: 'pointer' }}
                >
                  Import Markup <SortIcon field="import_markup" />
                </TableCell>
                <TableCell 
                  align="right"
                  onClick={() => handleSort('retail_price')}
                  sx={{ cursor: 'pointer' }}
                >
                  Retail Price <SortIcon field="retail_price" />
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
                  <TableRow key={`${item.inquiry_item_id || item.item_id || index}`}>
                    <TableCell>{item.item_id}</TableCell>
                    <TableCell>{item.hebrew_description}</TableCell>
                    <TableCell>{item.english_description}</TableCell>
                    <TableCell align="right">{item.import_markup?.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {formatIlsPrice(item.retail_price) || (
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

function LoadingProgress({ value, message }) {
  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {Math.round(value)}%
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={value} />
    </Box>
  );
}

function InquiryList() {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inquiryItems, setInquiryItems] = useState([]);
  const [currentInquiryId, setCurrentInquiryId] = useState(null);
  const [sortField, setSortField] = useState('custom_number');
  const [sortDirection, setSortDirection] = useState('asc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [inquiryToDelete, setInquiryToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportInquiryId, setExportInquiryId] = useState(null);

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
    const timerLabel = 'fetchInquiries';
    perfDebug.time(timerLabel);
    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Fetching inquiries...');

    try {
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + (100 - prev) * 0.1;
          return Math.min(next, 90);
        });
      }, 300);

      const response = await axios.get(`${API_BASE_URL}/api/inquiries`);
      clearInterval(progressInterval);
      
      dataDebug.log('Fetched inquiries:', response.data?.length || 0);
      setInquiries(response.data || []);
      setLoadingProgress(100);
      setError('');
    } catch (err) {
      console.error('Error fetching inquiries:', err);
      setError('Failed to load inquiries. Please try again later.');
    } finally {
      perfDebug.timeEnd(timerLabel);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (isMounted) {
        await fetchInquiries();
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleViewInquiry = async (inquiryId) => {
    try {
      setCurrentInquiryId(inquiryId);
      setLoadingMessage('Loading inquiry details...');
      setLoadingProgress(0);
      
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + (100 - prev) * 0.1;
          return Math.min(next, 90);
        });
      }, 200);

      const response = await axios.get(`${API_BASE_URL}/api/inquiries/${inquiryId}`);
      clearInterval(progressInterval);
      
      setInquiryItems(response.data.items || []);
      setLoadingProgress(100);
      setDialogOpen(true);
    } catch (err) {
      console.error('Error fetching inquiry details:', err);
      setError('Failed to load inquiry details. Please try again later.');
    }
  };

  const handleExportInquiry = async (inquiryId) => {
    setExportInquiryId(inquiryId);
    setExportDialogOpen(true);
  };

  const handleExportConfirm = async (selectedHeaders) => {
    try {
      setIsExporting(true);
      setLoadingMessage('Preparing export...');
      setLoadingProgress(0);
      
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + (100 - prev) * 0.1;
          return Math.min(next, 90);
        });
      }, 200);

      // Ensure we have at least one header selected
      if (!selectedHeaders || selectedHeaders.length === 0) {
        throw new Error('Please select at least one header for export');
      }

      dataDebug.log('Exporting with headers:', selectedHeaders);

      const response = await axios.get(`${API_BASE_URL}/api/inquiries/${exportInquiryId}/export`, {
        params: { 
          headers: JSON.stringify(selectedHeaders)
        },
        responseType: 'blob'
      });
      clearInterval(progressInterval);
      setLoadingProgress(100);

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
      setExportDialogOpen(false);
      setExportInquiryId(null);
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
      setLoadingMessage('Deleting inquiry...');
      setLoadingProgress(0);
      
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + (100 - prev) * 0.1;
          return Math.min(next, 90);
        });
      }, 200);

      await axios.delete(`${API_BASE_URL}/api/inquiries/${inquiryToDelete.inquiry_id}`);
      clearInterval(progressInterval);
      setLoadingProgress(100);
      
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
      <Box sx={{ width: '100%', p: 2 }}>
        <Typography variant="h5" gutterBottom>
          Inquiries
        </Typography>
        <LoadingProgress value={loadingProgress} message={loadingMessage} />
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
                onClick={() => handleSort('custom_number')}
                sx={{ cursor: 'pointer' }}
              >
                Custom Number <SortIcon field="custom_number" />
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
                onClick={() => handleSort('item_count')}
                sx={{ cursor: 'pointer' }}
              >
                Items <SortIcon field="item_count" />
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
                <TableRow key={inquiry.inquiry_id}>
                  <TableCell>{inquiry.custom_number}</TableCell>
                  <TableCell>{new Date(inquiry.date || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={inquiry.status || 'Unknown'}
                      color={getStatusColor(inquiry.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{inquiry.item_count || 0}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        icon={<PeopleIcon />}
                        label={`${inquiry.responded_suppliers_count || 0} Suppliers`}
                        color="primary"
                        size="small"
                      />
                      {inquiry.not_responded_items_count > 0 && (
                        <Chip
                          icon={<WarningIcon />}
                          label={`${inquiry.not_responded_items_count} Not Responded`}
                          color="error"
                          size="small"
                        />
                      )}
                      {inquiry.total_replacements_count > 0 && (
                        <Chip
                          icon={<SwapHorizIcon />}
                          label={`${inquiry.total_replacements_count} Replacements`}
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
                        onClick={() => handleViewInquiry(inquiry.inquiry_id)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small"
                        onClick={() => navigate(`/inquiries/${inquiry.inquiry_id}`)}
                      >
                        <ArrowForwardIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Export for Suppliers">
                      <IconButton 
                        size="small"
                        onClick={() => handleExportInquiry(inquiry.inquiry_id)}
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

      <ExportHeadersDialog
        open={exportDialogOpen}
        onClose={() => {
          setExportDialogOpen(false);
          setExportInquiryId(null);
        }}
        onConfirm={handleExportConfirm}
      />

      {(isExporting || isDeleting) && (
        <LoadingProgress value={loadingProgress} message={loadingMessage} />
      )}
    </Box>
  );
}

export default InquiryList;
