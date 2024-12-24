import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { ShoppingCart as ShoppingCartIcon } from '@mui/icons-material';

function BestPricesDialog({ open, onClose, prices, onCreateOrders, loading }) {
  // Group items by supplier
  const supplierGroups = prices.reduce((groups, item) => {
    if (!groups[item.SupplierID]) {
      groups[item.SupplierID] = {
        supplierName: item.SupplierName,
        items: [],
      };
    }
    groups[item.SupplierID].items.push(item);
    return groups;
  }, {});

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Best Supplier Prices</DialogTitle>
      <DialogContent>
        {Object.entries(supplierGroups).map(([supplierId, group]) => (
          <Box key={supplierId} sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {group.supplierName}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Requested Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.items.map((item) => (
                    <TableRow key={item.ItemID}>
                      <TableCell>{item.ItemID}</TableCell>
                      <TableCell>{item.HebrewDescription}</TableCell>
                      <TableCell align="right">{item.RequestedQty}</TableCell>
                      <TableCell align="right">${item.PriceQuoted.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        ${(item.PriceQuoted * item.RequestedQty).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} align="right">
                      <strong>Total for {group.supplierName}:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>
                        ${group.items.reduce((sum, item) => 
                          sum + (item.PriceQuoted * item.RequestedQty), 0).toFixed(2)}
                      </strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          onClick={onCreateOrders}
          variant="contained"
          color="primary"
          startIcon={<ShoppingCartIcon />}
          disabled={loading}
        >
          {loading ? 'Creating Orders...' : 'Create Orders'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BestPricesDialog;
