import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

function DeleteConfirmDialog({ open, onClose, onConfirm, deleteType, error, isDeleting }) {
  return (
    <Dialog open={open} onClose={onClose}>
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
        <Button onClick={onClose} disabled={isDeleting}>Cancel</Button>
        <Button 
          onClick={onConfirm} 
          color="error" 
          variant="contained"
          disabled={isDeleting}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteConfirmDialog;
