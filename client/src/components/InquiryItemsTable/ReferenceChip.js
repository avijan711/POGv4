import React from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

function ReferenceChip({ referenceChange, onDelete }) {
  if (!referenceChange) return null;

  const getTooltipText = () => {
    const source = referenceChange.source === 'supplier' 
      ? `Changed by ${referenceChange.supplierName}`
      : 'Changed by user';
    const date = new Date(referenceChange.changeDate).toLocaleDateString();
    const notes = referenceChange.notes ? `\nNotes: ${referenceChange.notes}` : '';
    return `${source}\nDate: ${date}${notes}`;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={getTooltipText()}>
        <Chip
          icon={<SwapHorizIcon />}
          label={referenceChange.newReferenceID}
          color={referenceChange.source === 'supplier' ? 'primary' : 'secondary'}
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
