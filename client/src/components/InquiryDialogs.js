import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import SupplierResponseUpload from './SupplierResponseUpload';
import ItemDetailsDialogWrapper from './ItemDetailsDialogWrapper';
import EditItemDialog from './InquiryDialogs/EditItemDialog';

function InquiryDialogs({
  dialogStates,
  onClose,
  onSave,
  onDelete,
  onUploadSuccess,
  inquiryId,
}) {
  const {
    dialogOpen,
    selectedItem,
    itemDetailsOpen,
    selectedItemDetails,
    deleteConfirmOpen,
    itemToDelete,
    deleteInquiryConfirmOpen,
    supplierUploadOpen,
    isDeleting,
    error,
  } = dialogStates;

  const handleItemClick = async (itemId) => {
    // This should be implemented by the parent component
    console.log('Item clicked:', itemId);
  };

  return (
    <>
      {/* Edit Item Dialog */}
      <EditItemDialog
        open={dialogOpen}
        onClose={onClose}
        onSave={onSave}
        selectedItem={selectedItem}
        error={error}
      />

      {/* Item Details Dialog */}
      {selectedItemDetails && (
        <ItemDetailsDialogWrapper
          open={itemDetailsOpen}
          onClose={onClose}
          item={selectedItemDetails}
          onItemClick={handleItemClick}
        />
      )}

      {/* Delete Item Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !isDeleting && onClose()}
      >
        <DialogTitle>Delete Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this item from the inquiry?
          </Typography>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={() => onDelete(itemToDelete)}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Inquiry Confirmation Dialog */}
      <Dialog
        open={deleteInquiryConfirmOpen}
        onClose={() => !isDeleting && onClose()}
      >
        <DialogTitle>Delete Inquiry</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this inquiry? This action cannot be undone.
          </Typography>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={() => onDelete('inquiry')}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Supplier Response Upload Dialog */}
      <SupplierResponseUpload
        open={supplierUploadOpen}
        onClose={onClose}
        onSuccess={onUploadSuccess}
        inquiryId={inquiryId}
      />
    </>
  );
}

export default InquiryDialogs;
