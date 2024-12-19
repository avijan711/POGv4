import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import SupplierResponseUpload from './SupplierResponseUpload';
import ItemDetailsDialogWrapper from './ItemDetailsDialogWrapper';

function InquiryDialogs({
  dialogStates,
  onClose,
  onSave,
  onDelete,
  onUploadSuccess,
  inquiryId
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

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await onSave(formData);
  };

  const handleItemClick = async (itemId) => {
    // This should be implemented by the parent component
    console.log('Item clicked:', itemId);
  };

  return (
    <>
      {/* Edit Item Dialog */}
      <Dialog open={dialogOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Item</DialogTitle>
        <form onSubmit={handleSave}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                name="item_id"
                label="Item ID"
                value={selectedItem?.item_id || ''}
                InputProps={{ readOnly: true }}
              />
              <TextField
                name="hebrew_description"
                label="Hebrew Description"
                value={selectedItem?.hebrew_description || ''}
                multiline
                rows={2}
                InputProps={{ readOnly: true }}
              />
              <TextField
                name="english_description"
                label="English Description"
                value={selectedItem?.english_description || ''}
                multiline
                rows={2}
                InputProps={{ readOnly: true }}
              />
              <TextField
                name="import_markup"
                label="Import Markup"
                type="number"
                value={selectedItem?.import_markup || ''}
                inputProps={{ step: '0.01' }}
                required
              />
              <TextField
                name="hs_code"
                label="HS Code"
                value={selectedItem?.hs_code || ''}
              />
              <TextField
                name="retail_price"
                label="Retail Price"
                type="number"
                value={selectedItem?.retail_price || ''}
                inputProps={{ step: '0.01' }}
                required
              />
              <TextField
                name="qty_in_stock"
                label="Stock"
                type="number"
                value={selectedItem?.qty_in_stock || ''}
                required
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>

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
