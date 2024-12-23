import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Box,
  Typography,
  Link,
  Chip,
  Tooltip,
  Stack
} from '@mui/material';
import { 
  Edit as EditIcon, 
  SwapHoriz as SwapHorizIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { getDisplayPrice, calculateDiscount, isWinningPrice } from '../utils/priceUtils';

const ItemsView = ({
  filteredItems,
  prices,
  supplierGroups,
  selectedSuppliers,
  editingQty,
  setEditingQty,
  quantities,
  handleQuantityChange,
  editingPrice,
  setEditingPrice,
  temporaryPrices,
  handlePriceChange,
  handleItemClick,
  eurToIls,
  replacementItems,
  updating,
  updateError
}) => {
  const getSourceIcon = (source) => {
    if (source === 'supplier') return <StoreIcon fontSize="small" color="warning" />;
    if (source === 'user') return <PersonIcon fontSize="small" color="warning" />;
    return null;
  };

  const getSourceText = (replacement) => {
    if (replacement.source === 'supplier') {
      return `Changed by ${replacement.supplierName || 'supplier'}`;
    } else if (replacement.source === 'user') {
      return 'Changed by user';
    }
    return '';
  };

  // Debug log
  console.log('ItemsView props:', {
    filteredItems,
    replacementItems,
    prices: prices?.slice(0, 3)
  });

  return (
    <TableContainer component={Paper}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Item ID</TableCell>
            <TableCell>Description</TableCell>
            <TableCell align="right">Requested Qty</TableCell>
            {Object.entries(supplierGroups)
              .filter(([key]) => selectedSuppliers[key])
              .map(([key, group]) => (
                <TableCell key={key} align="right">
                  {group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName}
                </TableCell>
              ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredItems.map(itemId => {
            const firstItem = prices?.find(item => item.ItemID === itemId);
            const replacement = replacementItems[itemId];
            const hasReplacement = !!replacement;

            // Debug log for each item
            console.log(`Processing item ${itemId}:`, {
              hasReplacement,
              replacement,
              firstItem
            });

            return (
              <TableRow 
                key={itemId}
                sx={hasReplacement ? { 
                  backgroundColor: 'rgba(255, 243, 224, 0.9)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 243, 224, 1)'
                  }
                } : {}}
              >
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => handleItemClick(itemId)}
                      sx={{ textDecoration: 'none' }}
                    >
                      {itemId}
                    </Link>
                    {hasReplacement && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ArrowForwardIcon color="warning" />
                        <Tooltip title={getSourceText(replacement)}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Link
                              component="button"
                              variant="body2"
                              onClick={() => handleItemClick(replacement.newItemId)}
                              sx={{ textDecoration: 'none' }}
                            >
                              {replacement.newItemId}
                            </Link>
                            {getSourceIcon(replacement.source)}
                          </Stack>
                        </Tooltip>
                      </Box>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  {hasReplacement ? (
                    <Box>
                      <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                        {replacement.originalDescription}
                        <br />
                        <span style={{ fontSize: '0.8em' }}>{replacement.originalEnglishDescription}</span>
                      </Typography>
                      <Typography variant="body2">
                        {replacement.newDescription}
                        <br />
                        <span style={{ fontSize: '0.8em' }}>{replacement.newEnglishDescription}</span>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {getSourceText(replacement)}
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body2">
                        {firstItem?.HebrewDescription}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.8em', color: 'text.secondary' }}>
                        {firstItem?.EnglishDescription}
                      </Typography>
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right">
                  {editingQty === itemId ? (
                    <TextField
                      size="small"
                      type="number"
                      value={quantities[itemId] || firstItem?.RequestedQty}
                      onChange={(e) => handleQuantityChange(itemId, e.target.value)}
                      onBlur={() => setEditingQty(null)}
                      autoFocus
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      {quantities[itemId] || firstItem?.RequestedQty}
                      <IconButton 
                        size="small"
                        onClick={() => setEditingQty(itemId)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </TableCell>
                {Object.entries(supplierGroups)
                  .filter(([key]) => selectedSuppliers[key])
                  .map(([key, group]) => {
                    const supplierItem = group.items.find(item => item.ItemID === itemId);
                    const displayPrice = getDisplayPrice(itemId, key, supplierItem?.PriceQuoted, temporaryPrices);
                    const isWinner = displayPrice && isWinningPrice(
                      displayPrice,
                      itemId,
                      supplierGroups,
                      selectedSuppliers,
                      temporaryPrices
                    );
                    const priceKey = `${itemId}-${key}`;
                    
                    let discount = null;
                    if (supplierItem) {
                      const parsedMarkup = Number(supplierItem.ImportMarkup);
                      const parsedRetail = Number(supplierItem.RetailPrice);
                      
                      discount = calculateDiscount(
                        displayPrice,
                        parsedMarkup,
                        parsedRetail,
                        eurToIls
                      );
                    }

                    return (
                      <TableCell 
                        key={key} 
                        align="right"
                        sx={{
                          backgroundColor: isWinner ? '#4caf5066' : 'inherit',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <Box>
                          {editingPrice === priceKey ? (
                            <Box>
                              <TextField
                                size="small"
                                type="number"
                                value={displayPrice || ''}
                                onChange={(e) => handlePriceChange(itemId, key, e.target.value)}
                                onBlur={() => setEditingPrice(null)}
                                autoFocus
                                disabled={updating}
                                error={!!updateError}
                                inputProps={{ step: "0.01" }}
                                sx={{ width: '100px' }}
                                placeholder="Enter price"
                              />
                              {updating && (
                                <Typography variant="caption" color="text.secondary" display="block" align="right">
                                  Updating...
                                </Typography>
                              )}
                              {updateError && (
                                <Typography variant="caption" color="error" display="block" align="right">
                                  {updateError}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                {supplierItem?.PriceQuoted ? `€${displayPrice?.toFixed(2)}` : '-'}
                                <IconButton
                                  size="small"
                                  onClick={() => setEditingPrice(priceKey)}
                                  disabled={updating}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Box>
                              {updateError && (
                                <Typography variant="caption" color="error" display="block" align="right">
                                  {updateError}
                                </Typography>
                              )}
                            </Box>
                          )}
                          {discount !== null && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {discount.toFixed(1)}%
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ItemsView;
