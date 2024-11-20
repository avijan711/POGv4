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
    <Tooltip title={`${supplierPrice.supplierName} - ${new Date(supplierPrice.responseDate).toLocaleDateString()}`}>
      <Chip
        icon={<AttachMoneyIcon />}
        label={`₪${supplierPrice.priceQuoted}`}
        color={supplierPrice.isPromotion ? "secondary" : "primary"}
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

  // Sort items by Excel row index if no other sort is applied
  const sortedItems = [...items].sort((a, b) => {
    if (!sortConfig.field || sortConfig.field === 'excelRowIndex') {
      return (a.excelRowIndex || 0) - (b.excelRowIndex || 0);
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
                field="requestedQty"
                align="right"
                currentSort={sortConfig}
                onSort={onSort}
              >
                Requested Qty
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
                field="retailPrice"
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
                const supplierPrices = item.supplier_prices ? JSON.parse(item.supplier_prices) : [];
                
                return (
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
                            : item.promotion_id
                              ? 'rgba(156, 39, 176, 0.1)'
                              : 'inherit',
                      '&:hover': { 
                        backgroundColor: item.isDuplicate
                          ? 'rgba(255, 152, 0, 0.2)'
                          : item.hasReferenceChange && item.referenceChange
                            ? 'rgba(255, 243, 224, 1)' 
                            : item.isReferencedBy
                              ? '#c8e6c9'
                              : item.promotion_id
                                ? 'rgba(156, 39, 176, 0.2)'
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
                    <TableCell align="right">{item.qtyInStock || 0}</TableCell>
                    <TableCell align="right">₪{Number(item.retailPrice).toFixed(2)}</TableCell>
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
                    <TableCell align="right">{Number(item.importMarkup).toFixed(2)}</TableCell>
                    <TableCell>{item.hsCode}</TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <ReferenceChip
                        referenceChange={item.referenceChange}
                        onDelete={() => handleDeleteClick(item, 'reference')}
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
