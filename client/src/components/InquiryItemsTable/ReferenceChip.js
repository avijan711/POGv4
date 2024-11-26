import React from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

function ReferenceChip({ reference_change, onDelete }) {
  if (!reference_change) return null;

  const getTooltipText = () => {
    const source = reference_change.source === 'supplier' 
      ? `Changed by ${reference_change.supplier_name}`
      : 'Changed by user';
    const date = new Date(reference_change.change_date).toLocaleDateString();
    const notes = reference_change.notes ? `\nNotes: ${reference_change.notes}` : '';
    return `${source}\nDate: ${date}${notes}`;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={getTooltipText()}>
        <Chip
          icon={<SwapHorizIcon />}
          label={reference_change.new_reference_id}
          color={reference_change.source === 'supplier' ? 'primary' : 'secondary'}
          size="small"
          variant="outlined"
          onDelete={onDelete}
          deleteIcon={<CloseIcon />}
          sx={{ 
            '& .MuiChip-label': { px: 1 },
            '& .MuiChip-icon': { fontSize: 16 }
          }}
        />
      </Tooltip>
    </Box>
  );
}

export default ReferenceChip;
