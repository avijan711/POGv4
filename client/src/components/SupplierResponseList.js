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
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  SwapHoriz as SwapHorizIcon,
  ArrowForward as ArrowForwardIcon,
  PriceChange as PriceChangeIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function ItemStatsDialog({ open, onClose, title, items, type }) {
  // Deduplicate items based on itemId
  const uniqueItems = items.reduce((acc, item) => {
    const key = type === 'replacements' ? `${item.original}-${item.replacement}` : item.itemId;
    if (!acc.has(key)) {
      acc.set(key, item);
    }
    return acc;
  }, new Map());

  const processedItems = Array.from(uniqueItems.values()).map(item => {
    if (typeof item === 'string') {
      return { itemId: item };
    }
    return item;
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                {type === 'replacements' && <TableCell>New Reference ID</TableCell>}
                <TableCell>Hebrew Description</TableCell>
                <TableCell>English Description</TableCell>
                <TableCell align="right">Requested Qty</TableCell>
                <TableCell align="right">Retail Price</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {processedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={type === 'replacements' ? 6 : 5} align="center">No items found</TableCell>
                </TableRow>
              ) : (
                processedItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{type === 'replacements' ? item.original : item.itemId}</TableCell>
                    {type === 'replacements' && <TableCell>{item.replacement}</TableCell>}
                    <TableCell>{item.hebrewDescription || ''}</TableCell>
                    <TableCell>{item.englishDescription || ''}</TableCell>
                    <TableCell align="right">{item.requestedQty || 0}</TableCell>
                    <TableCell align="right">₪{item.retailPrice?.toFixed(2) || '0.00'}</TableCell>
                  </TableRow>
                ))
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

function SupplierResponseList({ responses, onRefresh }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [processedResponses, setProcessedResponses] = useState([]);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogTitle, setStatsDialogTitle] = useState('');
  const [statsDialogItems, setStatsDialogItems] = useState([]);
  const [statsDialogType, setStatsDialogType] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (responses) {
      const processed = responses.map(response => {
        const responseItems = (response.items || []).map(item => ({
          ...item,
          itemType: item.referenceChange ? 'reference' : 'response',
          itemKey: item.referenceChange ? `ref-${item.itemId}-${item.referenceChange.newReferenceID}` : `resp-${item.itemId}`,
          changeId: item.referenceChange?.changeId,
          newReferenceID: item.referenceChange?.newReferenceID
        }));

        const hasPromotionItems = responseItems.some(item => item.debugIsPromotion === 1);

        // Deduplicate missing items
        const missingItems = JSON.parse(response.missingItems || '[]');
        const uniqueMissingItems = Array.from(
          missingItems.reduce((acc, item) => {
            if (!acc.has(item.itemId)) {
              acc.set(item.itemId, item);
            }
            return acc;
          }, new Map()).values()
        );

        return {
          ...response,
          items: responseItems,
          itemCount: responseItems.length,
          extraItems: JSON.parse(response.extraItems || '[]'),
          replacements: JSON.parse(response.replacements || '[]'),
          missingItems: uniqueMissingItems,
          missingItemsCount: uniqueMissingItems.length,
          isPromotion: hasPromotionItems
        };
      });

      setProcessedResponses(processed);
    }
  }, [responses]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const handleShowStats = (title, items, type) => {
    setStatsDialogTitle(title);
    setStatsDialogItems(items);
    setStatsDialogType(type);
    setStatsDialogOpen(true);
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
      setIsDeleting(true);
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
    } finally {
      setIsDeleting(false);
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
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="textSecondary">
                      {response.itemCount} items
                    </Typography>
                    {/* Missing items chip is always shown */}
                    {response.missingItemsCount > 0 && (
                      <Chip
                        label={`Missing: ${response.missingItemsCount}`}
                        color="error"
                        size="small"
                        icon={<WarningIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowStats(
                            'Missing Items',
                            response.missingItems,
                            'missing'
                          );
                        }}
                      />
                    )}
                    {/* Extra items and Replacements chips are only shown for non-promotion responses */}
                    {!response.isPromotion && (
                      <>
                        {response.extraItemsCount > 0 && (
                          <Chip
                            label={`Extra: ${response.extraItemsCount}`}
                            color="warning"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowStats(
                                'Extra Items',
                                response.extraItems,
                                'extra'
                              );
                            }}
                          />
                        )}
                        {response.replacementsCount > 0 && (
                          <Chip
                            label={`Replacements: ${response.replacementsCount}`}
                            color="info"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowStats(
                                'Replacement Items',
                                response.replacements,
                                'replacements'
                              );
                            }}
                          />
                        )}
                      </>
                    )}
                  </Stack>
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

      <ItemStatsDialog
        open={statsDialogOpen}
        onClose={() => setStatsDialogOpen(false)}
        title={statsDialogTitle}
        items={statsDialogItems}
        type={statsDialogType}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
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
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default SupplierResponseList;
