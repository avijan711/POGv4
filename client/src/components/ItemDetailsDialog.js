import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Paper,
  Divider,
  Button,
  Popover
} from '@mui/material';
import { Close as CloseIcon, History as HistoryIcon } from '@mui/icons-material';

// EUR to ILS conversion rate
const EUR_TO_ILS = 3.95;

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ padding: '16px 0' }}>
      {value === index && children}
    </div>
  );
}

function ItemDetailsDialog({ open, onClose, item }) {
  const [tabValue, setTabValue] = React.useState(0);
  const [historyAnchorEl, setHistoryAnchorEl] = React.useState(null);
  const [selectedSupplier, setSelectedSupplier] = React.useState(null);

  if (!item) return null;

  const { item: itemDetails, priceHistory, supplierPrices, promotions } = item;
  const hasReferenceChange = itemDetails?.hasReferenceChange;
  const isReferencedBy = itemDetails?.isReferencedBy;

  const handleHistoryClick = (event, supplier) => {
    setHistoryAnchorEl(event.currentTarget);
    setSelectedSupplier(supplier);
  };

  const handleHistoryClose = () => {
    setHistoryAnchorEl(null);
    setSelectedSupplier(null);
  };

  const getChangeSource = (referenceChange) => {
    if (!referenceChange) return '';
    
    if (referenceChange.source === 'supplier') {
      return `Changed by supplier ${referenceChange.supplierName || ''}`;
    } else if (referenceChange.source === 'user') {
      return 'Changed by user';
    }
    return '';
  };

  // Calculate discount percentage from retail price
  const calculateDiscount = (priceEUR, importMarkup, retailPriceILS) => {
    if (!retailPriceILS) return null;
    // Convert supplier price to ILS and apply markup
    const supplierPriceILS = priceEUR * EUR_TO_ILS * importMarkup;
    // Calculate discount percentage
    const discount = ((retailPriceILS - supplierPriceILS) / retailPriceILS) * 100;
    return Math.max(0, Math.min(100, discount)); // Clamp between 0-100%
  };

  // Get supplier-specific price history
  const getSupplierPriceHistory = (supplierName) => {
    return supplierPrices
      ?.filter(price => price.supplierName === supplierName)
      .sort((a, b) => new Date(b.date) - new Date(a.date)) || [];
  };

  // Calculate supplier discounts and find the best supplier
  const getSupplierDiscounts = () => {
    const discounts = {};
    supplierPrices?.forEach(price => {
      const discount = calculateDiscount(
        price.price,
        parseFloat(itemDetails?.importMarkup),
        parseFloat(itemDetails?.retailPrice)
      );
      if (discount !== null && (!discounts[price.supplierName] || discount > discounts[price.supplierName])) {
        discounts[price.supplierName] = discount;
      }
    });
    return discounts;
  };

  const supplierDiscounts = getSupplierDiscounts();
  const sortedDiscounts = Object.entries(supplierDiscounts)
    .sort(([, a], [, b]) => b - a);
  const bestSupplier = sortedDiscounts[0]?.[0];
  const delta = sortedDiscounts[0] && sortedDiscounts[1] ? 
    (sortedDiscounts[0][1] - sortedDiscounts[1][1]).toFixed(1) : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle 
        component="div"
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          p: 2,
          backgroundColor: hasReferenceChange 
            ? 'rgba(255, 243, 224, 0.9)'
            : isReferencedBy
              ? '#e8f5e9'
              : 'transparent'
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
              {itemDetails.referencingItems.map((refItem, index) => (
                <Typography key={index} variant="caption" display="block" sx={{ mt: 0.5 }}>
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
      <DialogContent>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="General Info" />
          <Tab label="Price History" />
          <Tab label="Supplier Prices" />
          <Tab label="Promotions" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: 2,
            backgroundColor: hasReferenceChange 
              ? 'rgba(255, 243, 224, 0.9)'
              : isReferencedBy
                ? '#e8f5e9'
                : 'transparent',
            p: 2,
            borderRadius: 1
          }}>
            <Box>
              <Typography variant="subtitle2">Item ID</Typography>
              <Typography>{itemDetails?.itemID}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">HS Code</Typography>
              <Typography>{itemDetails?.hsCode}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Hebrew Description</Typography>
              <Typography>{itemDetails?.hebrewDescription}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">English Description</Typography>
              <Typography>{itemDetails?.englishDescription}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Import Markup</Typography>
              <Typography>{itemDetails?.importMarkup}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Current Price</Typography>
              <Typography>₪{itemDetails?.retailPrice}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Current Stock</Typography>
              <Typography>{itemDetails?.qtyInStock}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Sold This Year</Typography>
              <Typography>{itemDetails?.soldThisYear}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Sold Last Year</Typography>
              <Typography>{itemDetails?.soldLastYear}</Typography>
            </Box>

            {hasReferenceChange && (
              <Paper 
                elevation={0} 
                sx={{ 
                  gridColumn: '1 / -1',
                  p: 2,
                  mt: 2,
                  backgroundColor: 'rgba(255, 243, 224, 0.9)',
                  border: '1px solid #FFE0B2'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" color="warning.main" sx={{ fontWeight: 'medium' }}>
                    Reference Change Details
                  </Typography>
                  <Chip 
                    label={getChangeSource(itemDetails.referenceChange)}
                    color="warning"
                    variant="outlined"
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      New Reference ID
                    </Typography>
                    <Typography variant="body1">
                      {itemDetails.referenceChange.newReferenceID}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Changed On
                    </Typography>
                    <Typography variant="body1">
                      {new Date(itemDetails.referenceChange.changeDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  {itemDetails.referenceChange.notes && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography variant="body1">
                        {itemDetails.referenceChange.notes}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            )}

            {isReferencedBy && (
              <Paper 
                elevation={0} 
                sx={{ 
                  gridColumn: '1 / -1',
                  p: 2,
                  mt: 2,
                  backgroundColor: '#e8f5e9',
                  border: '1px solid #A5D6A7'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" color="success.main" sx={{ fontWeight: 'medium' }}>
                    Reference Change Details
                  </Typography>
                  <Chip 
                    label="New Reference Item"
                    color="success"
                    variant="outlined"
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Replaces Items
                    </Typography>
                    <Typography variant="body1">
                      {itemDetails.referencingItems.map(i => i.itemID).join(', ')}
                    </Typography>
                  </Box>
                  {itemDetails.referencingItems[0]?.referenceChange?.changeDate && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Changed On
                      </Typography>
                      <Typography variant="body1">
                        {new Date(itemDetails.referencingItems[0].referenceChange.changeDate).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                  {itemDetails.referencingItems.map((refItem, index) => (
                    <Box key={index} sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Change Source
                      </Typography>
                      <Typography variant="body1">
                        {getChangeSource(refItem.referenceChange)}
                      </Typography>
                    </Box>
                  ))}
                  {itemDetails.referencingItems[0]?.referenceChange?.notes && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography variant="body1">
                        {itemDetails.referencingItems[0].referenceChange.notes}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priceHistory?.map((price, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                  <TableCell align="right">₪{price.price}</TableCell>
                  <TableCell 
                    align="right"
                    sx={{ 
                      color: price.change > 0 ? 'success.main' : 
                             price.change < 0 ? 'error.main' : 'text.primary'
                    }}
                  >
                    {price.change > 0 ? '+' : ''}{price.change.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Supplier</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Price (EUR)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell align="right">Delta</TableCell>
                <TableCell align="center">History</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplierPrices?.map((price, index) => {
                const discount = calculateDiscount(
                  price.price,
                  parseFloat(itemDetails?.importMarkup),
                  parseFloat(itemDetails?.retailPrice)
                );
                const isBestSupplier = price.supplierName === bestSupplier;
                
                return (
                  <TableRow 
                    key={index}
                    sx={isBestSupplier ? { backgroundColor: '#f0fff0' } : {}}
                  >
                    <TableCell>
                      {price.supplierName}
                      {price.isPromotion && (
                        <Chip 
                          label={`${price.promotionName || "Promotion"}`}
                          color="secondary"
                          size="small"
                          sx={{ ml: 1 }}
                          title={`Valid: ${new Date(price.promotionStartDate).toLocaleDateString()} - ${new Date(price.promotionEndDate).toLocaleDateString()}`}
                        />
                      )}
                    </TableCell>
                    <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                    <TableCell align="right">€{price.price.toFixed(2)}</TableCell>
                    <TableCell>{price.status}</TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        color: price.change > 0 ? 'success.main' : 
                               price.change < 0 ? 'error.main' : 'text.primary'
                      }}
                    >
                      {price.change > 0 ? '+' : ''}{price.change.toFixed(2)}%
                    </TableCell>
                    <TableCell align="right">
                      {discount !== null && `${discount.toFixed(1)}%`}
                    </TableCell>
                    <TableCell align="right">
                      {isBestSupplier && delta ? `${delta}%` : ''}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleHistoryClick(e, price.supplierName)}
                        title="View price history"
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          <Popover
            open={Boolean(historyAnchorEl)}
            anchorEl={historyAnchorEl}
            onClose={handleHistoryClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
          >
            <Box sx={{ p: 2, maxWidth: 400 }}>
              <Typography variant="h6" gutterBottom>
                Price History - {selectedSupplier}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Price (EUR)</TableCell>
                    <TableCell align="right">Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getSupplierPriceHistory(selectedSupplier)?.map((price, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                      <TableCell align="right">€{price.price.toFixed(2)}</TableCell>
                      <TableCell 
                        align="right"
                        sx={{ 
                          color: price.change > 0 ? 'success.main' : 
                                 price.change < 0 ? 'error.main' : 'text.primary'
                        }}
                      >
                        {price.change > 0 ? '+' : ''}{price.change.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Popover>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Supplier</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell align="right">Price (EUR)</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {promotions?.map((promo, index) => (
                <TableRow key={index}>
                  <TableCell>{promo.supplierName}</TableCell>
                  <TableCell>{new Date(promo.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(promo.endDate).toLocaleDateString()}</TableCell>
                  <TableCell align="right">€{promo.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={promo.isActive ? 'Active' : 'Inactive'} 
                      color={promo.isActive ? 'success' : 'default'} 
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
}

export default ItemDetailsDialog;
