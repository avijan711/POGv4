import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import ItemDialog from '../ItemDialog';
import ItemDetailsDialogWrapper from '../ItemDetailsDialogWrapper';
import SupplierResponseUpload from '../SupplierResponseUpload';

const InquiryDialogs = ({
  dialogStates,
  onClose,
  onSave,
  onDelete,
  onUploadSuccess,
  inquiryId,
}) => {
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
    loadingDetails,
  } = dialogStates;

  const handleDelete = () => {
    if (itemToDelete) {
      // Handle item deletion
      onDelete(itemToDelete);
    } else {
      // Handle inquiry deletion
      onDelete('inquiry');
    }
  };

  return (
    <>
      <ItemDialog
        open={dialogOpen}
        onClose={() => onClose('dialog')}
        item={selectedItem}
        onSave={onSave}
        mode="edit"
      />

      <ItemDetailsDialogWrapper
        open={itemDetailsOpen}
        onClose={() => onClose('itemDetails')}
        item={selectedItemDetails}
        showReferenceDetails={true}
      />

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => onClose('deleteConfirm')}
      >
        <DialogTitle>Delete Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this item from the inquiry?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose('deleteConfirm')}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteInquiryConfirmOpen}
        onClose={() => !isDeleting && onClose('deleteInquiry')}
      >
        <DialogTitle>Delete Inquiry</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this entire inquiry? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => onClose('deleteInquiry')}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete Inquiry'}
          </Button>
        </DialogActions>
      </Dialog>

      <SupplierResponseUpload
        open={supplierUploadOpen}
        onClose={() => onClose('supplierUpload')}
        inquiryId={inquiryId}
        onUploadSuccess={onUploadSuccess}
      />

      {loadingDetails && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
          }}
        >
          <CircularProgress />
        </Box>
      )}
    </>
  );
};

export default InquiryDialogs;
