import React from 'react';
import {
  DialogTitle,
  IconButton,
  Typography,
  Box,
  Chip
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { uiDebug } from '../../utils/debug';

const DialogHeader = ({ 
  itemDetails, 
  hasReferenceChange, 
  isReferencedBy, 
  getChangeSource, 
  getBackgroundColor, 
  onClose 
}) => {
  uiDebug.log('Rendering DialogHeader', { itemID: itemDetails?.itemID });

  return (
    <DialogTitle 
      component="div"
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        p: 2,
        backgroundColor: getBackgroundColor()
      }}
    >
      <Box>
        <Typography variant="h6" component="div">
          {itemDetails?.itemID} - {itemDetails?.hebrewDescription}
        </Typography>
        {hasReferenceChange && (
          <Box>
            <Chip 
              label={`→ ${itemDetails.referenceChange.newReferenceID}`}
              color="warning"
              variant="outlined"
              size="small"
              sx={{ mt: 1 }}
            />
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              {getChangeSource(itemDetails.referenceChange)}
            </Typography>
          </Box>
        )}
        {isReferencedBy && (
          <Box sx={{ mt: hasReferenceChange ? 1 : 0 }}>
            <Chip 
              label={`← ${itemDetails.referencingItems.map(i => i.itemID).join(', ')}`}
              color="success"
              variant="outlined"
              size="small"
            />
            {itemDetails.referencingItems.map((refItem) => (
              <Typography 
                key={`${refItem.itemID}-${refItem.referenceChange?.changeDate || ''}-${refItem.referenceChange?.source || ''}`}
                variant="caption" 
                display="block" 
                sx={{ mt: 0.5 }}
              >
                {getChangeSource(refItem.referenceChange)}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
      <IconButton onClick={onClose} size="small">
        <CloseIcon />
      </IconButton>
    </DialogTitle>
  );
};

export default React.memo(DialogHeader);
