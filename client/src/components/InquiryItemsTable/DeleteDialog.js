import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

function DeleteDialog({
  open,
  onClose,
  onConfirm,
  type = 'item', // Add default type for regular item deletion
  error,
}) {
  const getDialogContent = () => {
    switch (type) {
      case 'reference':
        return {
          title: 'Delete Reference Change',
          message: 'Are you sure you want to delete this reference change?',
          description: 'This will remove the reference link between the items.'
        };
      case 'supplier-response':
        return {
          title: 'Delete Supplier Response',
          message: 'Are you sure you want to delete this supplier response?',
          description: 'This will remove all pricing and availability information from this supplier.'
        };
      default: // For regular item deletion
        return {
          title: 'Delete Item',
          message: 'Are you sure you want to delete this item?',
          description: 'This will permanently remove the item from the inquiry. This action cannot be undone.'
        };
    }
  };

  const dialogContent = getDialogContent();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        color: 'error.main'
      }}>
        <WarningIcon color="error" />
        {dialogContent.title}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {dialogContent.message}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {dialogContent.description}
          </Typography>
        </Box>
        {error && (
          <Typography 
            color="error" 
            sx={{ 
              mt: 2,
              p: 1,
              bgcolor: 'error.light',
              borderRadius: 1,
              color: 'error.contrastText'
            }}
          >
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={onClose}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          color="error" 
          variant="contained"
          sx={{
            '&:hover': {
              backgroundColor: 'error.dark',
            }
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteDialog;
