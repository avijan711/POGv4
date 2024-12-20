import React from 'react';
import { Box, Typography, Paper, TextField, Chip } from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Close as CloseIcon } from '@mui/icons-material';

function QuantityCell({ item, editingQty, editedQty, onEditQty, onQtyChange, onQtyKeyPress, onSaveQty, onCancelEdit }) {
  if (editingQty === item.inquiry_item_id) {
    return (
      <Paper 
        variant="outlined"
        sx={{
          p: 1.5,
          backgroundColor: 'primary.lighter',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          minWidth: '180px',
          boxShadow: 1
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TextField
          type="number"
          value={editedQty ?? (item.requested_qty || 0)}
          onChange={(e) => onQtyChange(item, e.target.value)}
          onKeyDown={(e) => onQtyKeyPress(e, item)}
          autoFocus
          variant="outlined"
          inputProps={{ min: "0" }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '1.25rem',
              fontWeight: 'bold',
              backgroundColor: 'white',
              '& input': {
                textAlign: 'right',
                padding: '8px 12px'
              },
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: 2
                }
              }
            }
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Chip
            icon={<SaveIcon />}
            label="Save"
            color="primary"
            onClick={() => onSaveQty(item)}
            sx={{ 
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: 'primary.dark',
                boxShadow: 1
              }
            }}
          />
          <Chip
            icon={<CloseIcon />}
            label="Cancel"
            color="error"
            onClick={onCancelEdit}
            sx={{ 
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: 'error.dark',
                boxShadow: 1
              }
            }}
          />
        </Box>
      </Paper>
    );
  }

  return (
    <Box 
      onClick={() => onEditQty(item.inquiry_item_id)}
      sx={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1,
        padding: '8px 12px',
        borderRadius: 1,
        cursor: 'pointer',
        minWidth: '100px',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: 'action.hover',
          '& .edit-icon': {
            opacity: 1,
            color: 'primary.main'
          }
        }
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
        {item.requested_qty || 0}
      </Typography>
      <EditIcon 
        className="edit-icon"
        sx={{ 
          fontSize: '1.1rem',
          opacity: 0,
          transition: 'all 0.2s ease',
          color: 'text.secondary'
        }} 
      />
    </Box>
  );
}

export default QuantityCell;
