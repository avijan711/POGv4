import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Chip,
  Divider,
  Paper,
  Stack,
} from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  LocalOffer as LocalOfferIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon,
  Notes as NotesIcon,
  Inventory as InventoryIcon,
  Public as PublicIcon,
} from '@mui/icons-material';

function ItemDetailsDialog({ open, onClose, item }) {
  if (!item) return null;

  const formatPrice = (price) => {
    if (!price) return '₪0.00';
    return `₪${Number(price).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  };

  const SectionTitle = ({ icon: Icon, title }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Icon color="primary" />
      <Typography variant="subtitle1" fontWeight="bold">
        {title}
      </Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack spacing={1}>
            <Typography variant="h6">Item Details</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.hebrew_description}
            </Typography>
          </Stack>
          <Chip label={item.item_id} color="primary" />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          {/* Pricing Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <SectionTitle icon={AttachMoneyIcon} title="Pricing" />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Current Retail Price</Typography>
                  <Typography variant="h6" color="primary.main">
                    {formatPrice(item.retail_price)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Import Markup</Typography>
                  <Typography>{item.import_markup?.toFixed(2) || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                  <Typography>{formatDate(item.last_price_update)}</Typography>
                </Grid>
                {item.supplier_responses?.length > 0 && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Supplier Pricing History
                    </Typography>
                    <Stack spacing={1}>
                      {item.supplier_responses.map((response, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            icon={<BusinessIcon />}
                            label={response.supplier_name}
                            size="small"
                            variant="outlined"
                          />
                          <Typography>
                            {formatPrice(response.price_quoted)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(response.response_date)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>

          {/* Info Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <SectionTitle icon={InfoIcon} title="Information" />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">English Description</Typography>
                  <Typography>{item.english_description}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">HS Code</Typography>
                  <Typography>{item.hs_code || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Origin</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PublicIcon fontSize="small" color="action" />
                    <Typography>{item.origin || 'N/A'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">In Stock</Typography>
                      <Typography>{item.qty_in_stock || 0}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Sold This Year</Typography>
                      <Typography>{item.sold_this_year || 0}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Sold Last Year</Typography>
                      <Typography>{item.sold_last_year || 0}</Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Notes Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <SectionTitle icon={NotesIcon} title="Notes" />
              {item.notes ? (
                <Typography>{item.notes}</Typography>
              ) : (
                <Typography color="text.secondary" variant="body2">No notes available</Typography>
              )}
              {item.reference_change && (
                <div>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary" gutterBottom>Reference Change</Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SwapHorizIcon color="warning" fontSize="small" />
                      <Typography>Replaced by {item.reference_change.new_reference_id}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {item.reference_change.source === 'supplier'
                        ? `Changed by ${item.reference_change.supplier_name}`
                        : 'Changed by user'} on {formatDate(item.reference_change.change_date)}
                    </Typography>
                    {item.reference_change.notes && (
                      <Typography variant="body2">
                        Note: {item.reference_change.notes}
                      </Typography>
                    )}
                  </Stack>
                </div>
              )}
            </Paper>
          </Grid>

          {/* Promotions Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <SectionTitle icon={LocalOfferIcon} title="Promotions" />
              {item.promotions?.length > 0 ? (
                <Stack spacing={2}>
                  {item.promotions.map((promo, index) => (
                    <Box key={index}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip
                          icon={<LocalOfferIcon />}
                          label={formatPrice(promo.price)}
                          color="secondary"
                          variant="outlined"
                        />
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(promo.start_date)} - {formatDate(promo.end_date)}
                        </Typography>
                      </Box>
                      {promo.supplier_name && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon fontSize="small" color="action" />
                          <Typography variant="body2">{promo.supplier_name}</Typography>
                        </Box>
                      )}
                      {index < item.promotions.length - 1 && <Divider sx={{ my: 1 }} />}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2">No active promotions</Typography>
              )}
            </Paper>
          </Grid>

          {/* Supplier Responses */}
          {item.supplier_responses?.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <SectionTitle icon={BusinessIcon} title="Supplier Responses" />
                <Grid container spacing={2}>
                  {item.supplier_responses.map((response, index) => (
                    <Grid item xs={12} key={index}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip
                          icon={<BusinessIcon />}
                          label={response.supplier_name}
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          icon={<AttachMoneyIcon />}
                          label={formatPrice(response.price_quoted)}
                          color={response.is_promotion ? "secondary" : "default"}
                          variant="outlined"
                        />
                        {response.is_promotion && (
                          <Chip
                            icon={<LocalOfferIcon />}
                            label="Promotion"
                            color="secondary"
                            size="small"
                          />
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(response.response_date)}
                        </Typography>
                      </Box>
                      {response.notes && (
                        <Typography variant="body2" sx={{ mt: 1, ml: 1 }}>
                          Notes: {response.notes}
                        </Typography>
                      )}
                      {index < item.supplier_responses.length - 1 && (
                        <Divider sx={{ my: 1 }} />
                      )}
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ItemDetailsDialog;
