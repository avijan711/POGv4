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
  Paper,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  LocalOffer as LocalOfferIcon,
  ContentCopy as ContentCopyIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import ReferenceChip from './InquiryItemsTable/ReferenceChip';

function SortableTableCell({ field, children, align = 'left', currentSort, onSort }) {
  const isCurrentField = currentSort.field === field;
  
  return (
    <TableCell
      align={align}
      onClick={() => onSort(field)}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: '#f5f5f5',
        fontWeight: 'bold',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
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

function SupplierPriceChip({ supplierPrice }) {
  return (
    <Tooltip title={`${supplierPrice.supplier_name} - ${new Date(supplierPrice.response_date).toLocaleDateString()}`}>
      <Chip
        icon={<AttachMoneyIcon />}
        label={`₪${supplierPrice.price_quoted}`}
        color={supplierPrice.is_promotion ? "secondary" : "primary"}
        size="small"
        variant="outlined"
        sx={{ margin: '2px' }}
      />
    </Tooltip>
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
    onEditQty(item.inquiry_item_id, newQty);
  };

  const handleQtyBlur = (item) => {
    onUpdateQty(item.inquiry_item_id, item.requested_qty);
  };

  const handleQtyKeyPress = (e, item) => {
    if (e.key === 'Enter') {
      onUpdateQty(item.inquiry_item_id, item.requested_qty);
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
        if (itemToDelete.reference_change?.source === 'inquiry_item') {
          await axios.put(`${API_BASE_URL}/api/inquiries/inquiry-items/${itemToDelete.inquiry_item_id}/reference`, {
            new_reference_id: null,
            reference_notes: null
          });
        } else if (itemToDelete.reference_change?.change_id) {
          await axios.delete(`${API_BASE_URL}/api/supplier-responses/reference/${itemToDelete.reference_change.change_id}`);
        }
      } else if (deleteType === 'supplier-response') {
        await axios.delete(`${API_BASE_URL}/api/supplier-responses/${itemToDelete.supplier_response_id}`);
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

  // Sort items by Excel row index if no other sort is applied
  const sortedItems = [...items].sort((a, b) => {
    if (!sortConfig.field || sortConfig.field === 'excel_row_index') {
      return (a.excel_row_index || 0) - (b.excel_row_index || 0);
    }
    return 0;
  });

  return (
    <Paper elevation={2} sx={{ margin: 2, padding: 2 }}>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="inquiry items table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>#</TableCell>
              <SortableTableCell
                field="item_id"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Item ID
              </SortableTableCell>
              <SortableTableCell
                field="hebrew_description"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Hebrew Description
              </SortableTableCell>
              <SortableTableCell
                field="english_description"
                currentSort={sortConfig}
                onSort={onSort}
              >
                English Description
              </SortableTableCell>
              <SortableTableCell
                field="requested_qty"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Requested Qty
              </SortableTableCell>
              <SortableTableCell
                field="qty_in_stock"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Stock
              </SortableTableCell>
              <SortableTableCell
                field="retail_price"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Retail Price (ILS)
              </SortableTableCell>
              <TableCell align="right" sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                Supplier Prices
              </TableCell>
              <TableCell align="right" sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                Promotion Price
              </TableCell>
              <SortableTableCell
                field="import_markup"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Import Markup
              </SortableTableCell>
              <SortableTableCell
                field="hs_code"
                currentSort={sortConfig}
                onSort={onSort}
              >
                HS Code
              </SortableTableCell>
              <TableCell align="center" sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                Reference
              </TableCell>
              <TableCell align="center" sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} align="center">
                  <Typography variant="subtitle1" color="textSecondary">
                    No items found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item, index) => {
                // Parse supplier prices only if it's a string
                const supplierPrices = typeof item.supplier_prices === 'string' 
                  ? JSON.parse(item.supplier_prices) 
                  : (item.supplier_prices || []);
                const isReplacement = item.reference_change?.item_id === item.item_id;
                
                return (
                  <TableRow 
                    key={item.inquiry_item_id}
                    onClick={() => {
                      if (editingQty !== item.inquiry_item_id) {
                        // Pass the item with already parsed supplier_prices
                        onViewDetails({
                          ...item,
                          supplier_prices: supplierPrices
                        });
                      }
                    }}
                    sx={{ 
                      backgroundColor: item.is_duplicate 
                        ? 'rgba(255, 152, 0, 0.1)'
                        : item.has_reference_change && item.reference_change
                          ? isReplacement 
                            ? 'rgba(76, 175, 80, 0.1)'  // Light green for replacement items
                            : 'rgba(244, 67, 54, 0.1)'  // Light red for old items
                          : item.is_referenced_by
                            ? '#e8f5e9'
                            : item.promotion_id
                              ? 'rgba(156, 39, 176, 0.1)'
                              : 'inherit',
                      '&:hover': { 
                        backgroundColor: item.is_duplicate
                          ? 'rgba(255, 152, 0, 0.2)'
                          : item.has_reference_change && item.reference_change
                            ? isReplacement
                              ? 'rgba(76, 175, 80, 0.2)'  // Darker green on hover
                              : 'rgba(244, 67, 54, 0.2)'  // Darker red on hover
                            : item.is_referenced_by
                              ? '#c8e6c9'
                              : item.promotion_id
                                ? 'rgba(156, 39, 176, 0.2)'
                                : 'rgba(0, 0, 0, 0.04)' 
                      },
                      cursor: editingQty === item.inquiry_item_id ? 'default' : 'pointer',
                    }}
                  >
                    <TableCell>{(item.excel_row_index || index) + 1}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.item_id}
                        {item.is_duplicate && (
                          <Tooltip title={`Duplicate of row ${(item.original_row_index || 0) + 1}`}>
                            <ContentCopyIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{item.hebrew_description}</TableCell>
                    <TableCell>{item.english_description}</TableCell>
                    <TableCell 
                      align="right" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editingQty === item.inquiry_item_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={item.requested_qty || 0}
                          onChange={(e) => handleQtyChange(item, e.target.value)}
                          onBlur={() => handleQtyBlur(item)}
                          onKeyPress={(e) => handleQtyKeyPress(e, item)}
                          autoFocus
                          sx={{ width: '80px' }}
                        />
                      ) : (
                        <Tooltip title="Click to edit quantity">
                          <Box 
                            onClick={() => onEditQty(item.inquiry_item_id)}
                            sx={{ 
                              cursor: 'text',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 1,
                              '&:hover': {
                                '& .edit-icon': {
                                  opacity: 1,
                                },
                                color: 'primary.main',
                              }
                            }}
                          >
                            <span>{item.requested_qty || 0}</span>
                            <EditIcon 
                              className="edit-icon"
                              sx={{ 
                                fontSize: '0.9rem',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                color: 'primary.main'
                              }} 
                            />
                          </Box>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">{item.qty_in_stock || 0}</TableCell>
                    <TableCell align="right">₪{Number(item.retail_price).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.5 }}>
                        {supplierPrices.map((price, idx) => (
                          <SupplierPriceChip key={idx} supplierPrice={price} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {item.promotion_id && (
                        <Tooltip title={`${item.promotion_name} (Valid: ${new Date(item.promotion_start_date).toLocaleDateString()} - ${new Date(item.promotion_end_date).toLocaleDateString()})`}>
                          <Chip
                            icon={<LocalOfferIcon />}
                            label={`₪${item.promotion_price}`}
                            color="secondary"
                            size="small"
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">{Number(item.import_markup).toFixed(2)}</TableCell>
                    <TableCell>{item.hs_code}</TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <ReferenceChip
                        reference_change={item.reference_change}
                        onDelete={() => handleDeleteClick(item, 'reference')}
                        isReplacement={isReplacement}
                      />
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
                            padding: '4px 8px',
                            '&:hover': { 
                              backgroundColor: 'primary.dark',
                              transform: 'scale(1.02)',
                            },
                            transition: 'all 0.2s',
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
                );
              })
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
    </Paper>
  );
}

export default InquiryItemsTable;
