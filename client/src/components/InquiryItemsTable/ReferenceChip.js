import React from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={getTooltipText()}>
        <Chip
          icon={isReplacement ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
          label={reference_change.new_reference_id}
          color={isReplacement ? 'success' : 'error'}
          size="small"
          variant="outlined"
          onDelete={onDelete}
          deleteIcon={<CloseIcon />}
          sx={{ 
            '& .MuiChip-label': { px: 1 },
            '& .MuiChip-icon': { 
              fontSize: 16,
              color: isReplacement ? 'success.main' : 'error.main'
            }
          }}
        />
      </Tooltip>
    </Box>
  );
}

export default ReferenceChip;
