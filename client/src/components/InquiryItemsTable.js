import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Button,
  IconButton,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function SortableTableCell({ field, children, align = 'left', currentSort, onSort }) {
  const isCurrentField = currentSort.field === field;
  
  return (
    <TableCell
      align={align}
      onClick={() => onSort(field)}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
        position: 'relative',
        paddingRight: isCurrentField ? '24px' : '16px',
        '& .sort-icon': {
          position: 'absolute',
          right: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
        },
      }}
    >
      {children}
      {isCurrentField && (
        <span className="sort-icon">
          {currentSort.direction === 'asc' ? (
            <ArrowUpwardIcon fontSize="small" />
          ) : (
            <ArrowDownwardIcon fontSize="small" />
          )}
        </span>
      )}
    </TableCell>
  );
}

function InquiryItemsTable({
  items,
  editingQty,
  onEditQty,
  onUpdateQty,
  onViewDetails,
  onEditItem,
  onDeleteItem,
  sortConfig,
  onSort,
  getChangeSource,
  onRefresh,
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [error, setError] = useState(null);

  const handleQtyChange = (item, value) => {
    const newQty = parseInt(value) || 0;
    onEditQty(item.inquiryItemID, newQty);
  };

  const handleQtyBlur = (item) => {
    onUpdateQty(item.inquiryItemID, item.requestedQty);
  };

  const handleQtyKeyPress = (e, item) => {
    if (e.key === 'Enter') {
      onUpdateQty(item.inquiryItemID, item.requestedQty);
    }
  };

  const handleDeleteClick = (item, type) => {
    setItemToDelete(item);
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (deleteType === 'reference') {
        if (itemToDelete.referenceChange?.source === 'inquiry_item') {
          await axios.put(`${API_BASE_URL}/api/inquiries/inquiry-items/${itemToDelete.inquiryItemID}/reference`, {
            newReferenceId: null,
            referenceNotes: null
          });
        } else if (itemToDelete.referenceChange?.changeId) {
          await axios.delete(`${API_BASE_URL}/api/supplier-responses/reference/${itemToDelete.referenceChange.changeId}`);
        }
      } else if (deleteType === 'supplier-response') {
        await axios.delete(`${API_BASE_URL}/api/supplier-responses/${itemToDelete.supplierResponseId}`);
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

  const getReferenceTooltip = (referenceChange) => {
    if (!referenceChange) return '';
    if (referenceChange.source === 'inquiry_item') {
      return 'Reference from inquiry';
    }
    return `Changed by ${referenceChange.supplierName || 'user'}`;
  };

  // Sort items by Excel row index if no other sort is applied
  const sortedItems = [...items].sort((a, b) => {
    if (!sortConfig.field || sortConfig.field === 'excelRowIndex') {
      return (a.excelRowIndex || 0) - (b.excelRowIndex || 0);
    }
    return 0; // Let the existing sort logic handle other cases
  });

  return (
    <>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="inquiry items table">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <SortableTableCell
                field="itemID"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Item ID
              </SortableTableCell>
              <SortableTableCell
                field="hebrewDescription"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Hebrew Description
              </SortableTableCell>
              <SortableTableCell
                field="englishDescription"
                currentSort={sortConfig}
                onSort={onSort}
              >
                English Description
              </SortableTableCell>
              <SortableTableCell
                field="importMarkup"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Import Markup
              </SortableTableCell>
              <SortableTableCell
                field="hsCode"
                currentSort={sortConfig}
                onSort={onSort}
              >
                HS Code
              </SortableTableCell>
              <SortableTableCell
                field="qtyInStock"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Stock
              </SortableTableCell>
              <SortableTableCell
                field="requestedQty"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Requested Qty
              </SortableTableCell>
              <SortableTableCell
                field="retailPrice"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Retail Price (ILS)
              </SortableTableCell>
              <TableCell>Reference</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  No items found
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item, index) => (
                <TableRow 
                  key={item.inquiryItemID}
                  onClick={() => {
                    if (editingQty !== item.inquiryItemID) {
                      onViewDetails(item);
                    }
                  }}
                  sx={{ 
                    backgroundColor: item.isDuplicate 
                      ? 'rgba(255, 152, 0, 0.1)'
                      : item.hasReferenceChange && item.referenceChange
                        ? 'rgba(255, 243, 224, 0.9)'
                        : item.isReferencedBy
                          ? '#e8f5e9'
                          : 'inherit',
                    '&:hover': { 
                      backgroundColor: item.isDuplicate
                        ? 'rgba(255, 152, 0, 0.2)'
                        : item.hasReferenceChange && item.referenceChange
                          ? 'rgba(255, 243, 224, 1)' 
                          : item.isReferencedBy
                            ? '#c8e6c9'
                            : 'rgba(0, 0, 0, 0.04)' 
                    },
                    cursor: editingQty === item.inquiryItemID ? 'default' : 'pointer',
                  }}
                >
                  <TableCell>{(item.excelRowIndex || index) + 1}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {item.itemID}
                      {item.isDuplicate && (
                        <Tooltip title={`Duplicate of row ${(item.originalRowIndex || 0) + 1}`}>
                          <ContentCopyIcon color="warning" fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{item.hebrewDescription}</TableCell>
                  <TableCell>{item.englishDescription}</TableCell>
                  <TableCell align="right">{Number(item.importMarkup).toFixed(2)}</TableCell>
                  <TableCell>{item.hsCode}</TableCell>
                  <TableCell align="right">{item.qtyInStock || 0}</TableCell>
                  <TableCell 
                    align="right" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    {editingQty === item.inquiryItemID ? (
                      <TextField
                        type="number"
                        size="small"
                        value={item.requestedQty || 0}
                        onChange={(e) => handleQtyChange(item, e.target.value)}
                        onBlur={() => handleQtyBlur(item)}
                        onKeyPress={(e) => handleQtyKeyPress(e, item)}
                        autoFocus
                        sx={{ width: '80px' }}
                      />
                    ) : (
                      <Box 
                        onClick={() => onEditQty(item.inquiryItemID)}
                        sx={{ cursor: 'text' }}
                      >
                        {item.requestedQty || 0}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {item.retailPrice ? (
                      `₪${item.retailPrice}`
                    ) : (
                      <Typography variant="body2" color="error">
                        No Price
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.hasReferenceChange && item.referenceChange && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={getReferenceTooltip(item.referenceChange)}>
                          <Chip
                            label={`→ ${item.referenceChange.newReferenceID}`}
                            color="warning"
                            variant="outlined"
                            size="small"
                            onDelete={item.referenceChange.source !== 'inquiry_item' ? (e) => {
                              e.stopPropagation();
                              handleDeleteClick(item, 'reference');
                            } : undefined}
                            deleteIcon={item.referenceChange.source !== 'inquiry_item' ? (
                              <IconButton size="small">
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            ) : undefined}
                            icon={<SwapHorizIcon />}
                          />
                        </Tooltip>
                        <Typography variant="caption" display="block">
                          {item.referenceChange.source === 'inquiry_item' 
                            ? 'Reference from inquiry'
                            : getChangeSource(item.referenceChange)}
                        </Typography>
                      </Box>
                    )}
                    {item.isReferencedBy && item.referencingItems && (
                      <Box sx={{ mt: item.hasReferenceChange ? 1 : 0 }}>
                        {item.referencingItems.map((refItem, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: index > 0 ? 1 : 0 }}>
                            {refItem.referenceChange && (
                              <Tooltip title={refItem.referenceChange.source === 'inquiry_item' 
                                ? 'Reference from inquiry'
                                : `Changed by ${refItem.referenceChange.supplierName || 'user'}`}>
                                <Chip
                                  label={`← ${refItem.itemID}`}
                                  color="success"
                                  variant="outlined"
                                  size="small"
                                  icon={<SwapHorizIcon />}
                                />
                              </Tooltip>
                            )}
                            <Typography variant="caption" display="block">
                              {refItem.referenceChange?.source === 'inquiry_item'
                                ? 'Reference from inquiry'
                                : getChangeSource(refItem.referenceChange)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        onClick={() => onViewDetails(item)}
                        startIcon={<VisibilityIcon />}
                        sx={{ 
                          minWidth: '100px',
                          padding: '8px 16px',
                          '&:hover': { 
                            backgroundColor: 'primary.dark',
                            transform: 'scale(1.02)',
                          },
                          transition: 'all 0.2s',
                          zIndex: 1,
                        }}
                      >
                        View
                      </Button>
                      <IconButton 
                        size="small" 
                        onClick={() => onEditItem(item)}
                        sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => onDeleteItem(item)}
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          {deleteType === 'reference' 
            ? 'Delete Reference Change' 
            : 'Delete Supplier Response'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {deleteType === 'reference'
              ? 'Are you sure you want to delete this reference change?'
              : 'Are you sure you want to delete this supplier response?'}
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
    </>
  );
}

export default InquiryItemsTable;
