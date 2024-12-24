import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableContainer,
  TableRow as MuiTableRow,
  TableCell,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import TableHeader from './TableHeader';
import CustomTableRow from './TableRow';
import DeleteDialog from './DeleteDialog';

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

  const handleDeleteClick = (item, type) => {
    if (type === 'reference' || type === 'supplier-response') {
      setItemToDelete(item);
      setDeleteType(type);
      setDeleteDialogOpen(true);
    } else {
      // For regular item deletion, use the parent's deletion flow
      onDeleteItem(item);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      if (deleteType === 'reference') {
        if (itemToDelete.referenceChange?.source === 'inquiry_item') {
          await axios.put(`${API_BASE_URL}/api/inquiries/inquiry-items/${itemToDelete.inquiryItemID}/reference`, {
            newReferenceId: null,
            referenceNotes: null,
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
    return 0; // Let the existing sort logic handle other cases
  });

  return (
    <>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="inquiry items table">
          <TableHeader sortConfig={sortConfig} onSort={onSort} />
          <TableBody>
            {sortedItems.length === 0 ? (
              <MuiTableRow>
                <TableCell colSpan={11} align="center">
                  No items found
                </TableCell>
              </MuiTableRow>
            ) : (
              sortedItems.map((item, index) => (
                <CustomTableRow
                  key={item.inquiryItemID}
                  item={item}
                  index={index}
                  editingQty={editingQty}
                  onEditQty={onEditQty}
                  onUpdateQty={onUpdateQty}
                  onViewDetails={onViewDetails}
                  onEditItem={onEditItem}
                  onDeleteItem={(item) => handleDeleteClick(item)}
                  onDeleteReference={(item) => handleDeleteClick(item, 'reference')}
                  getChangeSource={getChangeSource}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <DeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        type={deleteType}
        error={error}
      />
    </>
  );
}

export default InquiryItemsTable;
