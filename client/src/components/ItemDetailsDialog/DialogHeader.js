import React from 'react';
import {
  DialogTitle,
  IconButton,
  Box,
  Alert,
  Typography,
  Chip,
} from '@mui/material';
import { 
  Close as CloseIcon,
} from '@mui/icons-material';

function DialogHeader({ item, onClose }) {
  const isReplaced = item?.referenceChange?.newReferenceID;
  // Filter out self-references
  const replacedItems = item?.referencingItems?.filter(ref => ref.itemID !== item.itemID) || [];
  const isReplacement = replacedItems.length > 0;

  // If this item has a self-reference, it's a new item and should only show what it replaces
  const isSelfReferenced = isReplaced && item?.referenceChange?.newReferenceID === item.itemID;

  return (
    <>
      <DialogTitle sx={{ 
        m: 0, 
        p: 2,
        pr: 6, // Make room for the close button
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {item?.itemID}
          {isReplacement && (
            <Chip
              size="small"
              label="New Item"
              sx={{ 
                backgroundColor: '#e8f5e9',
                color: '#2e7d32',
                '.MuiChip-label': { px: 1 }
              }}
            />
          )}
        </Box>
        <Typography variant="h6" component="span" sx={{ flex: 1 }}>
          {item?.hebrewDescription || 'New Item'}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {((isReplaced && !isSelfReferenced) || isReplacement) && (
        <Box sx={{ px: 2, pt: 1, pb: 2 }}>
          {isReplaced && !isSelfReferenced && (
            <Alert 
              severity="warning" 
              sx={{ mb: isReplacement ? 1 : 0 }}
            >
              Replaced by: {item.referenceChange.newReferenceID}
            </Alert>
          )}
          {isReplacement && replacedItems.length > 0 && (
            <Alert 
              severity="success"
              sx={{ 
                backgroundColor: '#e8f5e9',
                color: '#1b5e20',
                '& .MuiAlert-icon': {
                  color: '#2e7d32'
                }
              }}
            >
              Replaces: {replacedItems.map(item => item.itemID).join(', ')}
            </Alert>
          )}
        </Box>
      )}
    </>
  );
}

export default DialogHeader;
