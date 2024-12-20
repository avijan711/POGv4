import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import axios from 'axios';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ padding: '20px 0' }}>
      {value === index && children}
    </div>
  );
}

function PriceChangeChip({ change }) {
  if (!change || change === 0) return null;
  
  return (
    <Chip
      icon={change > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
      label={`${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
      color={change > 0 ? 'error' : 'success'}
      size="small"
      sx={{ ml: 1 }}
    />
  );
}

function ItemDetail({ open, onClose, itemId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  const fetchItemDetails = useCallback(async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/items/${itemId}`);
      setData(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching item details:', err);
      setError('Failed to load item details. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (open && itemId) {
      fetchItemDetails();
    }
  }, [open, itemId, fetchItemDetails]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatPrice = (price) => {
    return `₪${price?.toFixed(2) || '0.00'}`;
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

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {data?.item ? `${data.item.hebrewDescription} - ${data.item.itemID}` : 'Item Details'}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : data?.item && (
          <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                <Tab label="General Info" />
                <Tab label="Price History" />
                <Tab label="Supplier Prices" />
                <Tab label="Promotions" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                {/* Reference Changes Section */}
                {(data.item.referenceChange || data.item.referencedBy) && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                      <Typography variant="h6" gutterBottom color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SwapIcon />
                        Reference Changes
                      </Typography>
                      
                      {data.item.referenceChange && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            This item has been replaced by:
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Chip
                              label={data.item.referenceChange.newReferenceID}
                              color="warning"
                              variant="outlined"
                              icon={<SwapIcon />}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {getChangeSource(data.item.referenceChange)}
                            </Typography>
                          </Box>
                          {data.item.referenceChange.notes && (
                            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                              Note: {data.item.referenceChange.notes}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {data.item.referencedBy && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            This item replaces:
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Chip
                              label={data.item.referencedBy.originalItemID}
                              color="success"
                              variant="outlined"
                              icon={<SwapIcon />}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {getChangeSource(data.item.referencedBy)}
                            </Typography>
                          </Box>
                          {data.item.referencedBy.notes && (
                            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                              Note: {data.item.referencedBy.notes}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Item ID
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.itemID}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    HS Code
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.hsCode || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Hebrew Description
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.hebrewDescription}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    English Description
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.englishDescription || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Import Markup
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.importMarkup?.toFixed(2) || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Price
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {formatPrice(data.item.retailPrice)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Stock
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.qtyInStock || '0'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Sold This Year
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.soldThisYear || '0'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Sold Last Year
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {data.item.soldLastYear || '0'}
                  </Typography>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Change</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.priceHistory.map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell align="right">{formatPrice(record.price)}</TableCell>
                        <TableCell align="right">
                          <PriceChangeChip change={record.change} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Change</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.supplierPrices.map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>{record.supplierName}</TableCell>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell align="right">{formatPrice(record.price)}</TableCell>
                        <TableCell align="right">
                          <PriceChangeChip change={record.change} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={record.status}
                            color={record.status === 'Active' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Start Date</TableCell>
                      <TableCell>End Date</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.promotions.map((promo, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(promo.startDate)}</TableCell>
                        <TableCell>{formatDate(promo.endDate)}</TableCell>
                        <TableCell align="right">{formatPrice(promo.price)}</TableCell>
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
              </TableContainer>
            </TabPanel>
          </Box>
        )}
      </DialogContent>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Close</Button>
      </Box>
    </Dialog>
  );
}

export default ItemDetail;
