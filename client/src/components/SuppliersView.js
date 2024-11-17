import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link
} from '@mui/material';
import { getDisplayPrice, calculateDiscount } from '../utils/priceUtils';

const SuppliersView = ({
  supplierGroups,
  selectedSuppliers,
  calculateSupplierSummary,
  quantities,
  temporaryPrices,
  handleItemClick,
  shouldShowItem,
  eurToIls
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(supplierGroups)
        .filter(([key]) => selectedSuppliers[key])
        .map(([key, group]) => {
          const summary = calculateSupplierSummary(group, quantities, temporaryPrices);
          
          if (summary.winningItems === 0) return null;

          return (
            <Paper key={key} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName}
              </Typography>
              
              <Box sx={{ mb: 2, display: 'flex', gap: 4 }}>
                <Typography>
                  Winning Items: {summary.winningItems} / {summary.totalItems}
                </Typography>
                <Typography>
                  Total Value: €{summary.totalValue.toFixed(2)}
                </Typography>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item ID</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Requested Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Discount Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.winningItemsList
                      .filter(item => shouldShowItem(item.ItemID))
                      .map(item => {
                        const qty = quantities[item.ItemID] || item.RequestedQty;
                        const displayPrice = getDisplayPrice(item.ItemID, key, item.PriceQuoted, temporaryPrices);
                        const total = (displayPrice * qty) || 0;
                        const discount = calculateDiscount(
                          displayPrice,
                          parseFloat(item.ImportMarkup),
                          parseFloat(item.RetailPrice),
                          eurToIls
                        );

                        return (
                          <TableRow 
                            key={item.ItemID}
                            sx={{
                              backgroundColor: '#4caf5066',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <TableCell>
                              <Link
                                component="button"
                                variant="body2"
                                onClick={() => handleItemClick(item.ItemID)}
                                sx={{ textDecoration: 'none' }}
                              >
                                {item.ItemID}
                              </Link>
                            </TableCell>
                            <TableCell>{item.HebrewDescription}</TableCell>
                            <TableCell align="right">{qty}</TableCell>
                            <TableCell align="right">€{displayPrice?.toFixed(2) || 'N/A'}</TableCell>
                            <TableCell align="right">€{total.toFixed(2)}</TableCell>
                            <TableCell align="right">
                              {discount !== null ? `${discount.toFixed(1)}%` : ''}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          );
        })}
    </Box>
  );
};

export default SuppliersView;
