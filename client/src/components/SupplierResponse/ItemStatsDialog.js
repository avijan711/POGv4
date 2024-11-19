import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { InfoOutlined as InfoIcon } from '@mui/icons-material';

const ItemStatsDialog = memo(({ 
  open, 
  onClose, 
  title, 
  items = [], 
  type 
}) => {
  // Validate and process items
  const processedItems = useMemo(() => {
    if (!Array.isArray(items)) {
      console.error('Invalid items format:', items);
      return [];
    }

    // Create a Map for deduplication
    const uniqueItems = items.reduce((acc, item) => {
      if (!item) return acc;

      const key = type === 'replacements' 
        ? `${item.itemId}-${item.newReferenceID}`
        : item.itemId;

      if (!acc.has(key)) {
        acc.set(key, item);
      }
      return acc;
    }, new Map());

    return Array.from(uniqueItems.values()).map(item => {
      if (typeof item === 'string') {
        return { itemId: item };
      }
      return item;
    });
  }, [items, type]);

  // Handle error state
  if (!Array.isArray(items)) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Alert severity="error">
            Invalid data format received
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {title}
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({processedItems.length} items)
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {processedItems.length === 0 ? (
          <Box sx={{ 
            py: 4, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1
          }}>
            <InfoIcon color="action" sx={{ fontSize: 40 }} />
            <Typography color="text.secondary">
              No items to display
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item ID</TableCell>
                  {type === 'replacements' && (
                    <TableCell>New Reference ID</TableCell>
                  )}
                  <TableCell>Hebrew Description</TableCell>
                  <TableCell>English Description</TableCell>
                  <TableCell align="right">Requested Qty</TableCell>
                  <TableCell align="right">Retail Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processedItems.map((item, index) => (
                  <TableRow key={item.itemId || index}>
                    <TableCell>{item.itemId}</TableCell>
                    {type === 'replacements' && (
                      <TableCell>{item.newReferenceID}</TableCell>
                    )}
                    <TableCell>{item.hebrewDescription || ''}</TableCell>
                    <TableCell>{item.englishDescription || ''}</TableCell>
                    <TableCell align="right">
                      {item.requestedQty || 0}
                    </TableCell>
                    <TableCell align="right">
                      {item.retailPrice 
                        ? `₪${Number(item.retailPrice).toFixed(2)}` 
                        : '₪0.00'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
});

ItemStatsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.shape({
    itemId: PropTypes.string,
    newReferenceID: PropTypes.string,
    hebrewDescription: PropTypes.string,
    englishDescription: PropTypes.string,
    requestedQty: PropTypes.number,
    retailPrice: PropTypes.number
  })),
  type: PropTypes.oneOf(['extra', 'missing', 'replacements']).isRequired
};

ItemStatsDialog.displayName = 'ItemStatsDialog';

export default ItemStatsDialog;
