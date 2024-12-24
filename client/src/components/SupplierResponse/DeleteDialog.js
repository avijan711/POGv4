import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { formatDate } from './utils';

const DeleteDialog = ({
  open,
  onClose,
  onConfirm,
  itemToDelete,
  deleteType,
  error,
  isDeleting,
}) => {
  const getDialogTitle = () => {
    switch (deleteType) {
    case 'bulk':
      return 'Delete All Responses';
    case 'reference':
      return 'Delete Reference Change';
    default:
      return 'Delete Response';
    }
  };

  const getDialogMessage = () => {
    switch (deleteType) {
    case 'bulk':
      return `Are you sure you want to delete all responses from ${itemToDelete?.supplierName} on ${formatDate(itemToDelete?.date)}?`;
    case 'reference':
      return `Are you sure you want to delete the reference change from ${itemToDelete?.itemId} to ${itemToDelete?.newReferenceID}?`;
    default:
      return `Are you sure you want to delete this response for item ${itemToDelete?.itemId}?`;
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isDeleting && onClose()}
      onClick={handleClick}
    >
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent>
        <Typography>{getDialogMessage()}</Typography>
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
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteDialog;
