import React from 'react';
import { Chip, Tooltip, Box, Typography } from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Close as CloseIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';

function ReferenceChip({ reference_change, onDelete, isReplacement }) {
  if (!reference_change) return null;

  const getTooltipText = () => {
    const source = reference_change.source === 'supplier' 
      ? `Changed by ${reference_change.supplier_name}`
      : 'Changed by user';
    const date = new Date(reference_change.change_date).toLocaleDateString();
    const notes = reference_change.notes ? `\nNotes: ${reference_change.notes}` : '';
    const type = isReplacement ? 'Replacement Item' : 'Old Item';
    return `${type}\n${source}\nDate: ${date}${notes}`;
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1,
      position: 'relative'
    }}>
      <Tooltip title={getTooltipText()}>
        <Chip
          icon={isReplacement ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontWeight: 'bold' }}>
                {isReplacement ? 'New ID: ' : 'Replaced by: '}
              </Typography>
              {reference_change.new_reference_id}
            </Box>
          }
          color={isReplacement ? 'success' : 'error'}
          size="small"
          variant="filled"
          onDelete={onDelete}
          deleteIcon={<CloseIcon />}
          sx={{ 
            '& .MuiChip-label': { 
              px: 1,
              py: 1.5,
              fontSize: '0.875rem'
            },
            '& .MuiChip-icon': { 
              fontSize: 20,
              color: isReplacement ? 'success.light' : 'error.light'
            },
            fontWeight: 'bold',
            boxShadow: 1,
            border: 2,
            borderColor: isReplacement ? 'success.main' : 'error.main',
            '&:hover': {
              backgroundColor: isReplacement ? 'success.dark' : 'error.dark',
            }
          }}
        />
      </Tooltip>
      {/* Add a pulsing dot for new references */}
      {isReplacement && (
        <Box
          sx={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            backgroundColor: 'success.main',
            borderRadius: '50%',
            animation: 'pulse 1.5s infinite',
            '@keyframes pulse': {
              '0%': {
                transform: 'scale(0.95)',
                boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)',
              },
              '70%': {
                transform: 'scale(1)',
                boxShadow: '0 0 0 6px rgba(76, 175, 80, 0)',
              },
              '100%': {
                transform: 'scale(0.95)',
                boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)',
              },
            },
          }}
        />
      )}
    </Box>
  );
}

export default ReferenceChip;
