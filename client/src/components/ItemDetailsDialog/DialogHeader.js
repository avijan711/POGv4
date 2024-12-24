import React from 'react';
import {
  DialogTitle,
  IconButton,
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Link,
  useTheme,
} from '@mui/material';
import { 
  Close as CloseIcon,
  SwapHoriz as SwapHorizIcon,
  ContentCopy as ContentCopyIcon,
  Info as InfoIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useReference } from './ReferenceContext';

function DialogHeader({ onClose, onCopyId }) {
  const theme = useTheme();
  const {
    hasReferenceChange,
    isReferencedBy,
    itemDetails,
    referenceChange,
    onItemClick,
    getStatusColor,
    getStatusBackground,
    getStatusBorder,
    getStatusText,
    styles,
  } = useReference();

  // Handle both snake_case and camelCase properties
  const itemId = itemDetails?.itemID || itemDetails?.item_id;
  const hebrewDesc = itemDetails?.hebrewDescription || itemDetails?.hebrew_description;
  const englishDesc = itemDetails?.englishDescription || itemDetails?.english_description;
  const lastUpdated = itemDetails?.lastUpdated || itemDetails?.last_updated;

  // Get new item ID from referenceChange if it exists
  const newItemId = referenceChange?.new_item_id || referenceChange?.newItemId;

  return (
    <DialogTitle sx={{ 
      m: 0, 
      p: 2,
      pr: 6, // Make room for the close button
      borderBottom: '1px solid',
      borderColor: 'divider',
      background: hasReferenceChange ? theme.palette.warning.main : 'linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%)',
    }}>
      <Stack spacing={2}>
        {/* Top Row - ID and Status */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              {/* Item ID Box */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                bgcolor: getStatusBackground(),
                p: 2, 
                borderRadius: 2,
                border: getStatusBorder(theme),
                position: 'relative',
              }}>
                {/* Background Pattern */}
                {(hasReferenceChange || isReferencedBy) && (
                  <Box sx={styles.backgroundPattern} />
                )}

                {/* Item ID */}
                <Typography variant="h3" sx={{ 
                  ...styles.headerText,
                  fontSize: '1.75rem',
                  zIndex: 1,
                  color: hasReferenceChange ? theme.palette.warning.dark : theme.palette.text.primary,
                }}>
                  {itemId}
                </Typography>

                {/* Copy Button */}
                <Button
                  variant="contained"
                  startIcon={<ContentCopyIcon />}
                  onClick={onCopyId}
                  size="large"
                  color={getStatusColor()}
                  sx={{ 
                    ml: 2,
                    minWidth: 130,
                    zIndex: 1,
                  }}
                >
                  Copy ID
                </Button>

                {/* New Item Link - Show when there's a replacing item */}
                {hasReferenceChange && newItemId && (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<ArrowForwardIcon />}
                    onClick={() => onItemClick(newItemId)}
                    sx={{
                      ml: 2,
                      zIndex: 1,
                      bgcolor: theme.palette.warning.main,
                      '&:hover': {
                        bgcolor: theme.palette.warning.dark,
                      },
                    }}
                  >
                    New ID: {newItemId}
                  </Button>
                )}
              </Box>

              {/* Status Chips */}
              {isReferencedBy && (
                <Chip
                  size="medium"
                  label="New Reference Item"
                  color="success"
                  icon={<SwapHorizIcon />}
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    height: 32,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    '& .MuiChip-icon': {
                      fontSize: '1.2rem',
                    },
                  }}
                />
              )}
              {hasReferenceChange && (
                <Chip
                  size="medium"
                  label="Old Item - Replaced"
                  color="warning"
                  icon={<SwapHorizIcon />}
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    height: 32,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    '& .MuiChip-icon': {
                      fontSize: '1.2rem',
                    },
                  }}
                />
              )}
            </Stack>
          </Box>

          {/* Last Updated */}
          <Stack direction="row" spacing={1}>
            <Chip
              icon={<InfoIcon />}
              label={`Last Updated: ${new Date(lastUpdated || Date.now()).toLocaleDateString()}`}
              variant="outlined"
              size="medium"
            />
          </Stack>
        </Stack>

        {/* Bottom Row - Descriptions */}
        <Box>
          <Typography variant="h4" sx={{ 
            color: hasReferenceChange ? theme.palette.common.white : theme.palette.text.primary,
            fontWeight: 500,
            fontSize: '1.75rem',
            direction: 'rtl',  // Right-to-left for Hebrew
          }}>
            {hebrewDesc}
          </Typography>
          {englishDesc && (
            <Typography variant="body1" sx={{ 
              mt: 1, 
              color: hasReferenceChange ? 'rgba(255,255,255,0.9)' : theme.palette.text.secondary, 
            }}>
              {englishDesc}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Close Button */}
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: hasReferenceChange ? theme.palette.common.white : theme.palette.grey[500],
        }}
      >
        <CloseIcon />
      </IconButton>
    </DialogTitle>
  );
}

export default DialogHeader;
