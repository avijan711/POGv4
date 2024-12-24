import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Paper,
  Divider,
} from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useReference } from './ReferenceContext';

function ReferenceStatus() {
  const {
    hasReferenceChange,
    isReferencedBy,
    referenceChange,
    referencingItems,
    onItemClick,
    itemDetails,
    getSourceIcon,
    getSourceLabel,
    styles,
  } = useReference();

  if (!hasReferenceChange && !isReferencedBy) {
    return null;
  }

  return (
    <Box sx={{
      p: 2,
      bgcolor: hasReferenceChange ? '#fff3e0' : '#e8f5e9',
      borderBottom: '3px solid',
      borderColor: hasReferenceChange ? 'warning.main' : 'success.main',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          ${hasReferenceChange ? 'rgba(255, 152, 0, 0.05)' : 'rgba(76, 175, 80, 0.05)'} 10px,
          ${hasReferenceChange ? 'rgba(255, 152, 0, 0.05)' : 'rgba(76, 175, 80, 0.05)'} 20px
        )`,
        pointerEvents: 'none',
      },
    }}>
      <Stack spacing={2}>
        {/* Status Header */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 3,
            py: 1.5,
            bgcolor: 'white',
            borderRadius: 2,
            border: '2px solid',
            borderColor: hasReferenceChange ? 'warning.main' : 'success.main',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 'bold',
              color: hasReferenceChange ? 'warning.dark' : 'success.dark',
              letterSpacing: '0.5px',
            }}>
              {hasReferenceChange ? 'Old Item - Has Been Replaced' : 'New Item - Replaces Other Items'}
            </Typography>
            <SwapHorizIcon 
              color={hasReferenceChange ? 'warning' : 'success'} 
              sx={{ fontSize: 28 }}
            />
          </Box>
        </Stack>

        {/* Reference Details */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2,
            bgcolor: 'rgba(255,255,255,0.9)',
            border: '1px solid',
            borderColor: hasReferenceChange ? 'warning.light' : 'success.light',
            borderRadius: 2,
          }}
        >
          {hasReferenceChange && referenceChange && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                  Connection:
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{
                    p: 1.5,
                    bgcolor: 'white',
                    border: '1px solid',
                    borderColor: 'warning.light',
                    borderRadius: 1,
                    minWidth: 150,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}>
                    <Typography variant="subtitle2" color="text.secondary">Current Item</Typography>
                    <Typography variant="h6" color="warning.dark">
                      {itemDetails.item_id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ direction: 'rtl' }}>
                      {itemDetails.hebrew_description}
                    </Typography>
                  </Box>
                  <ArrowForwardIcon color="warning" sx={{ fontSize: 30 }} />
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => onItemClick(referenceChange.new_reference_id)}
                    sx={{ 
                      p: 1.5,
                      minWidth: 150,
                      height: 'auto',
                      textTransform: 'none',
                      textAlign: 'left',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" color="white">Replaced By</Typography>
                      <Typography variant="h6" sx={{ color: 'white' }}>
                        {referenceChange.new_reference_id}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'white', direction: 'rtl' }}>
                        {referenceChange.new_description}
                      </Typography>
                    </Box>
                  </Button>
                </Stack>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Stack direction="row" spacing={2} alignItems="center">
                {getSourceIcon(referenceChange.source, referenceChange.supplier_name)}
                <Typography variant="body2" color="text.secondary">
                  {getSourceLabel(referenceChange.source, referenceChange.supplier_name)}
                  {referenceChange.change_date && ` on ${new Date(referenceChange.change_date).toLocaleDateString()}`}
                </Typography>
              </Stack>
            </Stack>
          )}

          {isReferencedBy && referencingItems?.length > 0 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                  Connection:
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  {referencingItems.map((itemId) => (
                    <Stack key={itemId} direction="row" spacing={1} alignItems="center">
                      <Button
                        variant="outlined"
                        color="success"
                        onClick={() => onItemClick(itemId)}
                        startIcon={<ArrowBackIcon />}
                        sx={{ 
                          textTransform: 'none',
                          fontWeight: 'bold',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                      >
                        {itemId}
                      </Button>
                      <ArrowForwardIcon color="success" />
                      <Box sx={{
                        p: 1.5,
                        bgcolor: 'white',
                        border: '1px solid',
                        borderColor: 'success.light',
                        borderRadius: 1,
                        minWidth: 150,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}>
                        <Typography variant="subtitle2" color="text.secondary">Current Item</Typography>
                        <Typography variant="h6" color="success.dark">
                          {itemDetails.item_id}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ direction: 'rtl' }}>
                          {itemDetails.hebrew_description}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}

export default ReferenceStatus;
