import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Compare as CompareIcon,
  Close as CloseIcon,
  Add as AddIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';

function ComparisonDialog({ open, onClose, prices, onCreateOrders, loading }) {
  const [selectedSuppliers, setSelectedSuppliers] = useState({});
  const [editingQty, setEditingQty] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [viewMode, setViewMode] = useState('items');
  const [editingPrice, setEditingPrice] = useState(null);
  const [temporaryPrices, setTemporaryPrices] = useState({});

  // First, get all unique suppliers and their types
  const allSuppliers = useMemo(() => {
    return prices?.reduce((acc, item) => {
      const key = item.IsPromotion
        ? `${item.SupplierID}-${item.PromotionGroupID}`
        : `${item.SupplierID}-regular`;

      if (!acc[key]) {
        acc[key] = {
          supplierId: item.SupplierID,
          supplierName: item.SupplierName,
          isPromotion: item.IsPromotion || false,
          promotionName: item.PromotionName,
          promotionGroupId: item.PromotionGroupID,
        };
      }
      return acc;
    }, {});
  }, [prices]);

  // Then group items by supplier
  const supplierGroups = useMemo(() => {
    return prices?.reduce((groups, item) => {
      const key = item.IsPromotion
        ? `${item.SupplierID}-${item.PromotionGroupID}`
        : `${item.SupplierID}-regular`;

      if (!groups[key]) {
        groups[key] = {
          ...allSuppliers[key],
          items: [],
        };
      }
      groups[key].items.push(item);
      return groups;
    }, {}) || {};
  }, [prices, allSuppliers]);

  useEffect(() => {
    // Initialize selected suppliers
    const initial = Object.keys(supplierGroups).reduce((acc, key) => {
      return {
        ...acc,
        [key]: true,
      };
    }, {});
    setSelectedSuppliers(initial);
  }, [prices, supplierGroups]);

  const handleSupplierToggle = (key) => {
    setSelectedSuppliers(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleQuantityChange = (itemId, value) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const handlePriceChange = (itemId, supplierKey, value) => {
    const priceKey = `${itemId}-${supplierKey}`;
    setTemporaryPrices(prev => ({
      ...prev,
      [priceKey]: parseFloat(value) || 0,
    }));
  };

  const getDisplayPrice = (itemId, supplierKey, originalPrice) => {
    const priceKey = `${itemId}-${supplierKey}`;
    return Object.hasOwn(temporaryPrices, priceKey)
      ? temporaryPrices[priceKey] 
      : originalPrice;
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
      .forEach(([key, group]) => {
        const supplierItem = group.items.find(item => item.ItemID === itemId);
        if (supplierItem) {
          const displayPrice = getDisplayPrice(itemId, key, supplierItem.PriceQuoted);
          if (displayPrice && displayPrice < bestPrice) {
            bestPrice = displayPrice;
          }
        }
      });
    return bestPrice === Infinity ? null : bestPrice;
  };

  const isWinningPrice = (price, itemId) => {
    if (!price) return false;
    const currentBestPrice = getBestPriceForItem(itemId);
    if (!currentBestPrice) return false;
    const epsilon = 0.01;
    return Math.abs(price - currentBestPrice) <= epsilon;
  };

  const calculateSupplierSummary = (group) => {
    const winningItems = group.items.filter(item => 
      isWinningPrice(getDisplayPrice(item.ItemID, group.supplierId, item.PriceQuoted), item.ItemID),
    );
    const totalValue = winningItems.reduce((sum, item) => {
      const qty = quantities[item.ItemID] || item.RequestedQty;
      const price = getDisplayPrice(item.ItemID, group.supplierId, item.PriceQuoted);
      return sum + (price * qty || 0);
    }, 0);

    return {
      totalItems: group.items.length,
      winningItems: winningItems.length,
      totalValue,
      winningItemsList: winningItems,
    };
  };

  const uniqueItems = Array.from(new Set(prices?.map(item => item.ItemID))) || [];

  const renderItemsView = () => (
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
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {uniqueItems.map(itemId => {
            const firstItem = prices?.find(item => item.ItemID === itemId);
            const currentBestPrice = getBestPriceForItem(itemId);
            return (
              <TableRow key={itemId}>
                <TableCell>
                  {itemId}
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
                      // Focus will be managed by the parent component
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
                    const displayPrice = getDisplayPrice(itemId, key, supplierItem?.PriceQuoted);
                    const isWinner = displayPrice && isWinningPrice(displayPrice, itemId);
                    const priceKey = `${itemId}-${key}`;
                    
                    return (
                      <TableCell 
                        key={key} 
                        align="right"
                        sx={{
                          backgroundColor: isWinner ? '#4caf5066' : 'inherit',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        {supplierItem ? (
                          <Box>
                            {editingPrice === priceKey ? (
                              <TextField
                                size="small"
                                type="number"
                                value={displayPrice || ''}
                                onChange={(e) => handlePriceChange(itemId, key, e.target.value)}
                                onBlur={() => setEditingPrice(null)}
                                // Focus will be managed by the parent component
                                inputProps={{ step: '0.01' }}
                                sx={{ width: '100px' }}
                              />
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                ${displayPrice?.toFixed(2) || 'N/A'}
                                <IconButton 
                                  size="small"
                                  onClick={() => setEditingPrice(priceKey)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            )}
                            <Typography variant="caption" display="block" color="text.secondary">
                              {calculatePriceDelta(displayPrice, currentBestPrice)}
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
  );

  const renderSuppliersView = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(supplierGroups)
        .filter(([key]) => selectedSuppliers[key])
        .map(([key, group]) => {
          const summary = calculateSupplierSummary(group);
          
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
                  Total Value: ${summary.totalValue.toFixed(2)}
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
                      <TableCell align="right">Best Price Delta</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.winningItemsList.map(item => {
                      const currentBestPrice = getBestPriceForItem(item.ItemID);
                      const qty = quantities[item.ItemID] || item.RequestedQty;
                      const displayPrice = getDisplayPrice(item.ItemID, key, item.PriceQuoted);
                      const total = (displayPrice * qty) || 0;

                      return (
                        <TableRow 
                          key={item.ItemID}
                          sx={{
                            backgroundColor: '#4caf5066',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <TableCell>{item.ItemID}</TableCell>
                          <TableCell>{item.HebrewDescription}</TableCell>
                          <TableCell align="right">{qty}</TableCell>
                          <TableCell align="right">${displayPrice?.toFixed(2) || 'N/A'}</TableCell>
                          <TableCell align="right">${total.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            {calculatePriceDelta(displayPrice, currentBestPrice)}
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
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            sx={{ mr: 2, bgcolor: 'background.paper' }}
            size="small"
          >
            <ToggleButton value="items">
              <Tooltip title="Items View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="suppliers">
              <Tooltip title="Sort by Supplier">
                <ViewModuleIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
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
            {Object.entries(supplierGroups).map(([key, group]) => (
              <Chip
                key={key}
                label={group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName}
                color={group.isPromotion ? 'secondary' : 'primary'}
                variant={selectedSuppliers[key] ? 'filled' : 'outlined'}
                onClick={() => handleSupplierToggle(key)}
                onDelete={() => handleSupplierToggle(key)}
                deleteIcon={selectedSuppliers[key] ? <DeleteIcon /> : <AddIcon />}
                sx={{ m: 0.5 }}
              />
            ))}
          </Stack>
        </Paper>

        {viewMode === 'items' ? renderItemsView() : renderSuppliersView()}
      </Box>
    </Dialog>
  );
}

ComparisonDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  prices: PropTypes.arrayOf(PropTypes.shape({
    ItemID: PropTypes.string.isRequired,
    SupplierID: PropTypes.string.isRequired,
    SupplierName: PropTypes.string.isRequired,
    HebrewDescription: PropTypes.string,
    PriceQuoted: PropTypes.number,
    RequestedQty: PropTypes.number,
    IsPromotion: PropTypes.bool,
    PromotionName: PropTypes.string,
    PromotionGroupID: PropTypes.string,
    BestPrice: PropTypes.number,
  })),
  onCreateOrders: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default ComparisonDialog;
