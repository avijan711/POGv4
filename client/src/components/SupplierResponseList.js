import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  SwapHoriz as SwapHorizIcon,
  ArrowForward as ArrowForwardIcon,
  PriceChange as PriceChangeIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function SupplierResponseList({ responses, onRefresh }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [processedResponses, setProcessedResponses] = useState([]);

  useEffect(() => {
    if (responses) {
      const processed = responses.map(response => {
        // Map regular responses
        const responseItems = (response.items || []).map(item => ({
          ...item,
          itemType: item.referenceChange ? 'reference' : 'response',
          itemKey: item.referenceChange ? `ref-${item.itemId}-${item.referenceChange.newReferenceID}` : `resp-${item.itemId}`,
          changeId: item.referenceChange?.changeId,
          newReferenceID: item.referenceChange?.newReferenceID
        }));

        return {
          ...response,
          items: responseItems,
          itemCount: responseItems.length
        };
      });

      setProcessedResponses(processed);
    }
  }, [responses]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const handleDeleteClick = (e, item, type) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Delete clicked:', { item, type });
    setItemToDelete(item);
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      console.log('Deleting:', { itemToDelete, deleteType });
      if (deleteType === 'response') {
        await axios.delete(`${API_BASE_URL}/api/supplier-responses/${itemToDelete.responseId}`);
      } else if (deleteType === 'reference') {
        const changeId = itemToDelete.changeId;
        if (!changeId) {
          throw new Error('Change ID not found');
        }
        await axios.delete(`${API_BASE_URL}/api/supplier-responses/reference/${changeId}`);
      } else if (deleteType === 'bulk') {
        const encodedDate = encodeURIComponent(itemToDelete.date);
        await axios.delete(
          `${API_BASE_URL}/api/supplier-responses/bulk/${encodedDate}/${itemToDelete.supplierId}`
        );
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err.response?.data?.message || 'Failed to delete. Please try again.');
    }
  };

  const handleDialogClick = (e) => {
    e.stopPropagation();
  };

  return (
    <Paper sx={{ p: 3, backgroundColor: '#f8f9fa' }} elevation={0}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        mb: 3,
        pb: 2,
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <AssignmentIcon color="primary" />
        <Typography variant="h6" component="h2" color="primary">
          Supplier Responses
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {(!processedResponses || processedResponses.length === 0) ? (
        <Paper 
          sx={{ 
            p: 3, 
            textAlign: 'center',
            backgroundColor: '#fff',
            border: '1px dashed rgba(0, 0, 0, 0.12)'
          }}
        >
          <Typography color="textSecondary">
            No supplier responses found
          </Typography>
        </Paper>
      ) : (
        processedResponses.map((response) => (
          <Accordion 
            key={`${response.date}-${response.supplierId}`}
            sx={{ 
              mb: 1,
              '&:before': {
                display: 'none',
              },
              backgroundColor: '#fff'
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                },
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                width: '100%',
                pr: 2
              }}>
                <Box>
                  <Typography variant="subtitle1">
                    {response.supplierName} - {formatDate(response.date)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {response.itemCount} items
                  </Typography>
                </Box>
                <IconButton 
                  size="small"
                  onClick={(e) => handleDeleteClick(e, response, 'bulk')}
                  sx={{ 
                    '&:hover': { 
                      backgroundColor: 'rgba(211, 47, 47, 0.1)',
                      color: 'error.main',
                    },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </AccordionSummary>
            <AccordionDetails onClick={(e) => e.stopPropagation()}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item ID</TableCell>
                      <TableCell>Hebrew Description</TableCell>
                      <TableCell>English Description</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Status</TableCell>
                      <TableCell align="right">Type</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {response.items.map((item) => {
                      const isReference = item.itemType === 'reference';
                      
                      return (
                        <TableRow key={item.itemKey}>
                          <TableCell>
                            {isReference ? (
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography>{item.itemId}</Typography>
                                <Tooltip title="Reference Change" arrow>
                                  <ArrowForwardIcon color="info" fontSize="small" />
                                </Tooltip>
                                <Typography color="primary">
                                  {item.newReferenceID}
                                </Typography>
                              </Stack>
                            ) : (
                              item.itemId
                            )}
                          </TableCell>
                          <TableCell>{item.hebrewDescription}</TableCell>
                          <TableCell>{item.englishDescription}</TableCell>
                          <TableCell align="right">
                            {item.priceQuoted ? `€${item.priceQuoted}` : '-'}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={item.status}
                              size="small"
                              color={item.status === 'Reference Changed' ? 'info' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {isReference ? (
                              <Chip
                                icon={<SwapHorizIcon />}
                                label="Reference"
                                size="small"
                                color="info"
                                variant="outlined"
                                sx={{ minWidth: '110px' }}
                              />
                            ) : (
                              <Chip
                                icon={<PriceChangeIcon />}
                                label="Response"
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ minWidth: '110px' }}
                              />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={`Delete ${isReference ? 'reference' : 'response'}`} arrow>
                              <IconButton
                                size="small"
                                onClick={(e) => handleDeleteClick(e, item, isReference ? 'reference' : 'response')}
                                sx={{ 
                                  '&:hover': { 
                                    backgroundColor: 'rgba(211, 47, 47, 0.1)',
                                    color: 'error.main',
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onClick={handleDialogClick}
      >
        <DialogTitle>
          {deleteType === 'bulk' 
            ? 'Delete All Responses'
            : deleteType === 'reference'
            ? 'Delete Reference Change'
            : 'Delete Response'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {deleteType === 'bulk'
              ? `Are you sure you want to delete all responses from ${itemToDelete?.supplierName} on ${formatDate(itemToDelete?.date)}?`
              : deleteType === 'reference'
              ? `Are you sure you want to delete the reference change from ${itemToDelete?.itemId} to ${itemToDelete?.newReferenceID}?`
              : `Are you sure you want to delete this response for item ${itemToDelete?.itemId}?`}
          </Typography>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default SupplierResponseList;
