import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

export function MissingItemsDialog({ open, onClose, items = [], supplierName = '' }) {
  const parsedItems = React.useMemo(() => {
    try {
      // Handle supplierSpecificMissing structure
      if (items && Array.isArray(items.supplierSpecificMissing)) {
        const supplierMissing = items.supplierSpecificMissing[0];
        return supplierMissing ? (Array.isArray(supplierMissing.items) ? supplierMissing.items : []) : [];
      }
      
      // Handle direct array
      if (Array.isArray(items)) {
        return items.filter(Boolean);
      }

      // Handle string
      if (typeof items === 'string') {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }

      return [];
    } catch (e) {
      console.error('Error parsing missing items:', e);
      return [];
    }
  }, [items]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          <Typography>Missing Items for {supplierName} ({parsedItems.length})</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Requested Qty</TableCell>
                <TableCell align="right">Retail Price</TableCell>
                <TableCell>Origin</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parsedItems.length > 0 ? (
                parsedItems.map((item) => (
                  <TableRow key={item.item_id}>
                    <TableCell>{item.item_id}</TableCell>
                    <TableCell>
                      <Typography>{item.hebrew_description}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.english_description}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{item.requested_qty}</TableCell>
                    <TableCell align="right">₪{Number(item.retail_price).toFixed(2)}</TableCell>
                    <TableCell>{item.origin || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">No missing items found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
