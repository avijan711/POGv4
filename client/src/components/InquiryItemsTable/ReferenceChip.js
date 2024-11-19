import React from 'react';
import { Box, Chip, IconButton, Typography, Tooltip } from '@mui/material';
import { SwapHoriz as SwapHorizIcon, Close as CloseIcon } from '@mui/icons-material';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 1
  },
  referencingContainer: {
    mt: (props) => props.hasReferenceChange ? 1 : 0
  }
};

function ReferenceChip({
  item,
  onDeleteReference,
  getChangeSource
}) {
  const getReferenceTooltip = (referenceChange) => {
    if (!referenceChange) return '';
    if (referenceChange.source === 'inquiry_item') {
      return 'Reference from inquiry';
    }
    return `Changed by ${referenceChange.supplierName || 'user'}`;
  };

  return (
    <>
      {item.hasReferenceChange && item.referenceChange && (
        <Box sx={styles.container}>
          <Tooltip title={getReferenceTooltip(item.referenceChange)}>
            <Chip
              label={`→ ${item.referenceChange.newReferenceID}`}
              color="warning"
              variant="outlined"
              size="small"
              onDelete={item.referenceChange.source !== 'inquiry_item' ? (e) => {
                e.stopPropagation();
                onDeleteReference(item);
              } : undefined}
              deleteIcon={item.referenceChange.source !== 'inquiry_item' ? (
                <IconButton size="small">
                  <CloseIcon fontSize="small" />
                </IconButton>
              ) : undefined}
              icon={<SwapHorizIcon />}
            />
          </Tooltip>
          <Typography variant="caption" display="block">
            {item.referenceChange.source === 'inquiry_item' 
              ? 'Reference from inquiry'
              : getChangeSource(item.referenceChange)}
          </Typography>
        </Box>
      )}
      {item.isReferencedBy && item.referencingItems && (
        <Box sx={styles.referencingContainer}>
          {item.referencingItems.map((refItem, index) => (
            <Box key={index} sx={{ ...styles.container, mt: index > 0 ? 1 : 0 }}>
              {refItem.referenceChange && (
                <Tooltip title={refItem.referenceChange.source === 'inquiry_item' 
                  ? 'Reference from inquiry'
                  : `Changed by ${refItem.referenceChange.supplierName || 'user'}`}>
                  <Chip
                    label={`← ${refItem.itemID}`}
                    color="success"
                    variant="outlined"
                    size="small"
                    icon={<SwapHorizIcon />}
                  />
                </Tooltip>
              )}
              <Typography variant="caption" display="block">
                {refItem.referenceChange?.source === 'inquiry_item'
                  ? 'Reference from inquiry'
                  : getChangeSource(refItem.referenceChange)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}

export default ReferenceChip;
