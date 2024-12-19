import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import SortableTableCell from './InquiryItemsTable/SortableTableCell';
import DeleteConfirmDialog from './InquiryItemsTable/DeleteConfirmDialog';
import TableRowContent from './InquiryItemsTable/TableRowContent';

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
  const [editedQty, setEditedQty] = useState(null);

  const handleQtyChange = (item, value) => {
    const newQty = parseInt(value) || 0;
    setEditedQty(newQty);
  };

  const handleQtyKeyPress = (e, item) => {
    if (e.key === 'Enter') {
      if (editedQty !== null) {
        onUpdateQty(item.inquiry_item_id, editedQty);
        setEditedQty(null);
      }
    } else if (e.key === 'Escape') {
      setEditedQty(null);
      onEditQty(null);
    }
  };

  const handleSaveQty = (item) => {
    if (editedQty !== null) {
      onUpdateQty(item.inquiry_item_id, editedQty);
      setEditedQty(null);
    }
  };

  const handleCancelEdit = () => {
    setEditedQty(null);
    onEditQty(null);
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

  const processSupplierPrices = (item) => {
    let supplierPrices = [];
    try {
      supplierPrices = typeof item.supplier_prices === 'string' 
        ? JSON.parse(item.supplier_prices) 
        : (item.supplier_prices || []);
      
      supplierPrices = supplierPrices.filter(price => 
        price && 
        typeof price === 'object' && 
        'supplier_name' in price && 
        'price_quoted' in price
      );
    } catch (e) {
      console.error('Error parsing supplier prices:', e);
      supplierPrices = [];
    }
    return supplierPrices;
  };

  // Sort items by Excel row index if no other sort is applied
  const sortedItems = [...items].sort((a, b) => {
    if (!sortConfig.field || sortConfig.field === 'excel_row_index') {
      return (a.excel_row_index || 0) - (b.excel_row_index || 0);
    }
    return 0;
  });

  // Create a unique key for each item
  const getItemKey = (item) => {
    const baseKey = item.inquiry_item_id || item.item_id;
    const excelIndex = item.excel_row_index || '';
    const originalIndex = item.original_row_index || '';
    return `${baseKey}-${excelIndex}-${originalIndex}`;
  };

  return (
    <Paper elevation={2} sx={{ margin: 2, padding: 2 }}>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="inquiry items table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>#</TableCell>
              <SortableTableCell field="item_id" currentSort={sortConfig} onSort={onSort}>
                Item ID
              </SortableTableCell>
              <SortableTableCell field="hebrew_description" currentSort={sortConfig} onSort={onSort}>
                Hebrew Description
              </SortableTableCell>
              <SortableTableCell field="english_description" currentSort={sortConfig} onSort={onSort}>
                English Description
              </SortableTableCell>
              <SortableTableCell field="requested_qty" align="right" currentSort={sortConfig} onSort={onSort}>
                Requested Qty
              </SortableTableCell>
              <SortableTableCell field="qty_in_stock" align="right" currentSort={sortConfig} onSort={onSort}>
                Stock
              </SortableTableCell>
              <SortableTableCell field="retail_price" align="right" currentSort={sortConfig} onSort={onSort}>
                Retail Price (ILS)
              </SortableTableCell>
              <TableCell align="right" sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                Qty Sold (This Year)
              </TableCell>
              <TableCell align="right" sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                Qty Sold (Last Year)
              </TableCell>
              <SortableTableCell field="import_markup" align="right" currentSort={sortConfig} onSort={onSort}>
                Import Markup
              </SortableTableCell>
              <SortableTableCell field="hs_code" currentSort={sortConfig} onSort={onSort}>
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
              sortedItems.map((item, index) => (
                <TableRowContent
                  key={getItemKey(item)}
                  item={item}
                  index={index}
                  editingQty={editingQty}
                  editedQty={editedQty}
                  onEditQty={onEditQty}
                  onQtyChange={handleQtyChange}
                  onQtyKeyPress={handleQtyKeyPress}
                  onSaveQty={handleSaveQty}
                  onCancelEdit={handleCancelEdit}
                  onViewDetails={onViewDetails}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                  onDeleteReference={(item) => handleDeleteClick(item, 'reference')}
                  processSupplierPrices={processSupplierPrices}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        deleteType={deleteType}
        error={error}
        isDeleting={false}
      />
    </Paper>
  );
}

export default InquiryItemsTable;
