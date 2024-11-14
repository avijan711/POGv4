import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Tooltip,
  Chip,
  Stack,
  AppBar,
  Toolbar,
  Button,
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Compare as CompareIcon,
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';

function ComparisonDialog({ open, onClose, prices, onCreateOrders, loading }) {
  const [selectedSuppliers, setSelectedSuppliers] = useState({});
  const [editingQty, setEditingQty] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [itemIds, setItemIds] = useState({});

  console.log('=== ComparisonDialog Initial Data ===');
  console.log('Total prices:', prices?.length);
  console.log('Sample price:', prices?.[0]);
  console.log('Unique suppliers:', new Set(prices?.map(p => p.SupplierName)));
  console.log('Promotion items:', prices?.filter(p => p.IsPromotion)?.length);

  // First, get all unique suppliers and their types
  const allSuppliers = prices?.reduce((acc, item) => {
    const key = item.IsPromotion 
      ? `${item.SupplierID}-${item.PromotionGroupID}`
      : `${item.SupplierID}-regular`;

    if (!acc[key]) {
      acc[key] = {
        supplierId: item.SupplierID,
        supplierName: item.SupplierName,
        isPromotion: item.IsPromotion || false,
        promotionName: item.PromotionName,
        promotionGroupId: item.PromotionGroupID
      };
    }
    return acc;
  }, {});

  console.log('=== All Suppliers ===', allSuppliers);

  // Then group items by supplier
  const supplierGroups = prices?.reduce((groups, item) => {
    const key = item.IsPromotion 
      ? `${item.SupplierID}-${item.PromotionGroupID}`
      : `${item.SupplierID}-regular`;

    console.log('Processing item:', {
      key,
      itemId: item.ItemID,
      supplier: item.SupplierName,
      isPromotion: item.IsPromotion,
      promotionName: item.PromotionName,
      price: item.PriceQuoted,
      bestPrice: item.BestPrice
    });

    if (!groups[key]) {
      console.log('Creating new supplier group:', {
        key,
        supplier: item.SupplierName,
        isPromotion: item.IsPromotion,
        promotionName: item.PromotionName
      });
      groups[key] = {
        ...allSuppliers[key],
        items: []
      };
    }
    groups[key].items.push(item);
    return groups;
  }, {}) || {};

  console.log('=== Supplier Groups Analysis ===');
  Object.entries(supplierGroups).forEach(([key, group]) => {
    console.log('Supplier group:', {
      key,
      supplier: group.supplierName,
      isPromotion: group.isPromotion,
      promotionName: group.promotionName,
      itemCount: group.items.length,
      samplePrices: group.items.slice(0, 3).map(i => ({
        itemId: i.ItemID,
        price: i.PriceQuoted,
        bestPrice: i.BestPrice
      }))
    });
  });

  useEffect(() => {
    // Initialize selected suppliers
    console.log('Initializing selected suppliers');
    const initial = Object.keys(supplierGroups).reduce((acc, key) => {
      console.log('Setting initial state for:', {
        key,
        supplier: supplierGroups[key].supplierName,
        isPromotion: supplierGroups[key].isPromotion
      });
      return {
        ...acc,
        [key]: true
      };
    }, {});
    setSelectedSuppliers(initial);
  }, [prices]);

  const handleSupplierToggle = (key) => {
    console.log('Toggling supplier:', {
      key,
      supplier: supplierGroups[key].supplierName,
      currentState: selectedSuppliers[key]
    });
    setSelectedSuppliers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleQuantityChange = (itemId, value) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleItemIdChange = (itemId, value) => {
    setItemIds(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const calculatePriceDelta = (price, bestPrice) => {
    if (!price || !bestPrice) return '0.00%';
    const delta = ((price - bestPrice) / bestPrice * 100).toFixed(2);
    return delta > 0 ? `+${delta}%` : `${delta}%`;
  };

  const getBestPriceForItem = (itemId) => {
    let bestPrice = Infinity;
    Object.entries(supplierGroups)
      .filter(([key]) => selectedSuppliers[key])
      .forEach(([_, group]) => {
        const supplierItem = group.items.find(item => item.ItemID === itemId);
        if (supplierItem?.PriceQuoted && supplierItem.PriceQuoted < bestPrice) {
          bestPrice = supplierItem.PriceQuoted;
        }
      });
    return bestPrice === Infinity ? null : bestPrice;
  };

  const isWinningPrice = (price, itemId) => {
    if (!price) return false;
    const currentBestPrice = getBestPriceForItem(itemId);
    if (!currentBestPrice) return false;
    // Use a more lenient epsilon for floating point comparison
    const epsilon = 0.01; // 1 cent difference
    return Math.abs(price - currentBestPrice) <= epsilon;
  };

  // Get unique items across all suppliers
  const uniqueItems = Array.from(new Set(prices?.map(item => item.ItemID))) || [];
  console.log('=== Unique Items ===', uniqueItems);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth={false} 
      fullScreen
    >
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Interactive Comparison Process
          </Typography>
          <Button
            color="inherit"
            onClick={onCreateOrders}
            startIcon={<ShoppingCartIcon />}
            disabled={loading || Object.values(selectedSuppliers).filter(Boolean).length === 0}
          >
            {loading ? 'Creating Orders...' : 'Create Orders'}
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        <Paper sx={{ mb: 2, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Supplier Management
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(supplierGroups).map(([key, group]) => {
              console.log('Rendering supplier chip:', {
                key,
                supplier: group.supplierName,
                isPromotion: group.isPromotion,
                promotionName: group.promotionName
              });
              return (
                <Chip
                  key={key}
                  label={group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName}
                  color={group.isPromotion ? "secondary" : "primary"}
                  variant={selectedSuppliers[key] ? "filled" : "outlined"}
                  onClick={() => handleSupplierToggle(key)}
                  onDelete={() => handleSupplierToggle(key)}
                  deleteIcon={selectedSuppliers[key] ? <DeleteIcon /> : <AddIcon />}
                  sx={{ m: 0.5 }}
                />
              );
            })}
          </Stack>
        </Paper>

        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Requested Qty</TableCell>
                {Object.entries(supplierGroups)
                  .filter(([key]) => selectedSuppliers[key])
                  .map(([key, group]) => {
                    console.log('Rendering supplier column:', {
                      key,
                      supplier: group.supplierName,
                      isPromotion: group.isPromotion,
                      promotionName: group.promotionName
                    });
                    return (
                      <TableCell key={key} align="right">
                        {group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName}
                      </TableCell>
                    );
                  })}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uniqueItems.map(itemId => {
                const firstItem = prices?.find(item => item.ItemID === itemId);
                const currentBestPrice = getBestPriceForItem(itemId);
                console.log('Rendering item row:', {
                  itemId,
                  description: firstItem?.HebrewDescription,
                  currentBestPrice
                });
                return (
                  <TableRow key={itemId}>
                    <TableCell>
                      {editingQty === `${itemId}-id` ? (
                        <TextField
                          size="small"
                          value={itemIds[itemId] || itemId}
                          onChange={(e) => handleItemIdChange(itemId, e.target.value)}
                          onBlur={() => setEditingQty(null)}
                          autoFocus
                        />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {itemIds[itemId] || itemId}
                          <IconButton 
                            size="small"
                            onClick={() => setEditingQty(`${itemId}-id`)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{firstItem?.HebrewDescription}</TableCell>
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
                        const isWinner = supplierItem?.PriceQuoted && isWinningPrice(supplierItem.PriceQuoted, itemId);
                        console.log('Rendering price cell:', {
                          itemId,
                          supplier: group.supplierName,
                          price: supplierItem?.PriceQuoted,
                          currentBestPrice,
                          isWinner
                        });
                        return (
                          <TableCell 
                            key={key} 
                            align="right"
                            sx={{
                              backgroundColor: isWinner ? '#4caf5066' : 'inherit',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            {supplierItem ? (
                              <Box>
                                ${supplierItem.PriceQuoted?.toFixed(2) || 'N/A'}
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {calculatePriceDelta(supplierItem.PriceQuoted, currentBestPrice)}
                                </Typography>
                              </Box>
                            ) : '-'}
                          </TableCell>
                        );
                      })}
                    <TableCell align="center">
                      <Tooltip title="Remove Item">
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Compare">
                        <IconButton size="small" color="primary">
                          <CompareIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Dialog>
  );
}

export default ComparisonDialog;
