/**
 * ItemDialog Component
 * 
 * This component provides a dialog for creating and editing inventory items.
 * It works in conjunction with ItemDetailsDialog but serves a different purpose:
 * - ItemDialog (this): Form-based editing with validation
 * - ItemDetailsDialog: Read-only view with reference tracking
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  CircularProgress,
  Tooltip,
  Alert
} from '@mui/material';
import { Image as ImageIcon, Info as InfoIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { useItemDetails } from '../hooks/useItemDetails';
import { API_BASE_URL } from '../config';
import { dataDebug } from '../utils/debug';

// EUR to ILS conversion rate
const EUR_TO_ILS = 4.1;

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ marginTop: '16px' }}>
      {value === index && children}
    </div>
  );
}

function ItemDialog({ open, onClose, item, onSave, mode, error }) {
  // Use the enhanced useItemDetails hook in edit mode
  const {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError,
    hookError
  } = useItemDetails(item, open, mode);

  const defaultFormData = useMemo(() => ({
    item_id: '',
    hebrew_description: '',
    english_description: '',
    import_markup: '1.30',
    hs_code: '',
    image: null,
    qty_in_stock: '0',
    sold_this_year: '0',
    sold_last_year: '0',
    retail_price: '',
    reference_id: '' // Using snake_case consistently
  }), []);

  const [formData, setFormData] = useState(defaultFormData);
  const [imagePreview, setImagePreview] = useState(null);
  const [retailPriceError, setRetailPriceError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Initialize form data when dialog opens or mode/item changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && itemData) {
        // Edit mode - use existing item data
        setFormData({
          item_id: itemData.item_id || '',
          hebrew_description: itemData.hebrew_description || '',
          english_description: itemData.english_description || '',
          import_markup: itemData.import_markup?.toString() || '1.30',
          hs_code: itemData.hs_code || '',
          retail_price: itemData.retail_price?.toString() || '',
          qty_in_stock: itemData.qty_in_stock?.toString() || '0',
          sold_this_year: itemData.sold_this_year?.toString() || '0',
          sold_last_year: itemData.sold_last_year?.toString() || '0',
          image: itemData.image || null,
          reference_id: itemData.reference_id || ''
        });
        
        if (itemData.image) {
          setImagePreview(`${API_BASE_URL}/uploads/${itemData.image}`);
        }
      } else {
        // Add mode - use default values
        setFormData(defaultFormData);
        setImagePreview(null);
      }
      setRetailPriceError('');
      setSubmitError('');
    } else {
      // Dialog closed - reset everything
      setFormData(defaultFormData);
      setImagePreview(null);
      setRetailPriceError('');
      setTabValue(0);
      setIsSubmitting(false);
      setSubmitError('');
    }
  }, [open, mode, itemData, defaultFormData, setTabValue]);

  // Calculate discount percentage from retail price
  const calculateDiscount = (priceEUR, importMarkup, retailPriceILS) => {
    if (!retailPriceILS) return null;
    const supplierPriceILS = priceEUR * EUR_TO_ILS * importMarkup;
    const discount = ((retailPriceILS - supplierPriceILS) / retailPriceILS) * 100;
    return Math.max(0, Math.min(100, discount));
  };

  const handleChange = (field) => (event) => {
    let value = event.target.value;
    
    if (['import_markup', 'qty_in_stock', 'sold_this_year', 'sold_last_year', 'retail_price'].includes(field)) {
      value = value.replace(/[^\d.]/g, '');
      const parts = value.split('.');
      if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
      }
      
      if (field === 'import_markup') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          value = Math.min(2.0, Math.max(1.0, numValue)).toFixed(2);
        }
      } else if (field === 'retail_price') {
        const numValue = parseFloat(value);
        if (value && (!numValue || numValue <= 0)) {
          setRetailPriceError('Retail price must be greater than 0');
        } else {
          setRetailPriceError('');
        }
      } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          value = Math.max(0, numValue).toString();
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Log form data changes
    dataDebug.log('Form data updated:', {
      field,
      value,
      currentData: formData
    });
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file,
      }));
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formData.retail_price) {
      const retailPrice = parseFloat(formData.retail_price);
      if (!retailPrice || retailPrice <= 0) {
        setRetailPriceError('Retail price must be greater than 0');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');

      // Create FormData object
      const submitData = new FormData();
      
      // Append all non-empty values
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          submitData.append(key, value);
        }
      });

      // Log FormData contents
      dataDebug.log('FormData contents:');
      for (let [key, value] of submitData.entries()) {
        dataDebug.log(`  ${key}:`, value);
      }

      const success = await onSave(submitData);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitError(error.message || 'Failed to save item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const renderSupplierPrices = () => {
    if (!itemData?.supplierPrices?.length) return null;

    const retailPrice = parseFloat(formData.retail_price);
    const importMarkup = parseFloat(formData.import_markup);

    const supplierDiscounts = {};
    itemData.supplierPrices.forEach(price => {
      const discount = calculateDiscount(price.price, importMarkup, retailPrice);
      if (discount !== null) {
        supplierDiscounts[price.supplier_name] = discount;
      }
    });

    const discounts = Object.entries(supplierDiscounts)
      .sort(([, a], [, b]) => b - a);
    const bestSupplier = discounts[0]?.[0];
    const delta = discounts[0] && discounts[1] ? 
      (discounts[0][1] - discounts[1][1]).toFixed(1) : null;

    return (
      <Box sx={{ mt: 2 }}>
        <h4>Supplier Prices</h4>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Supplier</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Price (EUR)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Change</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Delta</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {itemData.supplierPrices.map((price, index) => {
              const isBestSupplier = price.supplier_name === bestSupplier;
              const discount = supplierDiscounts[price.supplier_name];
              
              return (
                <TableRow 
                  key={index}
                  sx={isBestSupplier ? { backgroundColor: '#f0fff0' } : {}}
                >
                  <TableCell>{price.supplier_name}</TableCell>
                  <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                  <TableCell>€{price.price.toFixed(2)}</TableCell>
                  <TableCell>{price.status}</TableCell>
                  <TableCell>
                    <span style={{ color: price.change >= 0 ? 'green' : 'red' }}>
                      {price.change.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>{discount?.toFixed(1)}%</TableCell>
                  <TableCell>
                    {isBestSupplier && delta ? `${delta}%` : ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    );
  };

  const renderPromotions = () => {
    if (!itemData?.promotions?.length) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Supplier</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Price (EUR)</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {itemData.promotions.map((promo, index) => (
              <TableRow key={index}>
                <TableCell>{promo.supplier_name}</TableCell>
                <TableCell>{format(new Date(promo.start_date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{format(new Date(promo.end_date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>€{promo.price.toFixed(2)}</TableCell>
                <TableCell>{promo.is_active ? 'Active' : 'Inactive'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ p: 2, color: 'error.main' }}>
            {hookError || 'An error occurred while loading item data'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={isSubmitting}
      disableBackdropClick={isSubmitting}
    >
      <DialogTitle>
        {mode === 'add' ? 'Add New Item' : 'Edit Item'}
      </DialogTitle>
      <DialogContent>
        {(error || submitError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || submitError}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Details" />
            <Tab label="Supplier Prices" />
            <Tab label="Promotions" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box 
            component="form"
            id="item-form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label="Item ID"
              name="item_id"
              value={formData.item_id}
              onChange={handleChange('item_id')}
              disabled={mode === 'edit'}
              required
              error={!formData.item_id}
              helperText={!formData.item_id ? 'Item ID is required' : ''}
            />
            {/* Add reference ID field only in add mode */}
            {mode === 'add' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  label="Reference ID"
                  name="reference_id"
                  value={formData.reference_id}
                  onChange={handleChange('reference_id')}
                  fullWidth
                  helperText="Optional: Enter the ID of the item this new item references"
                />
                <Tooltip title="If this new item is meant to replace or reference another item, enter that item's ID here">
                  <InfoIcon color="action" sx={{ ml: 1 }} />
                </Tooltip>
              </Box>
            )}
            <TextField
              label="Hebrew Description"
              name="hebrew_description"
              value={formData.hebrew_description}
              onChange={handleChange('hebrew_description')}
              required
              dir="rtl"
              error={!formData.hebrew_description}
              helperText={!formData.hebrew_description ? 'Hebrew description is required' : ''}
            />
            <TextField
              label="English Description"
              name="english_description"
              value={formData.english_description}
              onChange={handleChange('english_description')}
            />
            <TextField
              label="Import Markup"
              name="import_markup"
              value={formData.import_markup}
              onChange={handleChange('import_markup')}
              required
              helperText="Enter value between 1.00 and 2.00 (e.g., 1.30 for 30% markup)"
              inputProps={{
                inputMode: 'decimal',
                pattern: '[1-2].[0-9]*'
              }}
            />
            <TextField
              label="HS Code"
              name="hs_code"
              value={formData.hs_code}
              onChange={handleChange('hs_code')}
            />
            <TextField
              label="Stock Quantity"
              name="qty_in_stock"
              value={formData.qty_in_stock}
              onChange={handleChange('qty_in_stock')}
              type="number"
              inputProps={{ min: "0" }}
            />
            <TextField
              label="Sold This Year"
              name="sold_this_year"
              value={formData.sold_this_year}
              onChange={handleChange('sold_this_year')}
              type="number"
              inputProps={{ min: "0" }}
            />
            <TextField
              label="Sold Last Year"
              name="sold_last_year"
              value={formData.sold_last_year}
              onChange={handleChange('sold_last_year')}
              type="number"
              inputProps={{ min: "0" }}
            />
            <TextField
              label="Retail Price (ILS)"
              name="retail_price"
              value={formData.retail_price}
              onChange={handleChange('retail_price')}
              type="number"
              inputProps={{ min: "0.01" }}
              error={!!retailPriceError}
              helperText={retailPriceError || 'Leave empty if price is not set'}
            />
            <Box>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="image-upload"
                type="file"
                onChange={handleImageChange}
              />
              <label htmlFor="image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImageIcon />}
                  disabled={isSubmitting}
                >
                  Upload Image
                </Button>
              </label>
              {imagePreview && (
                <Box sx={{ mt: 2 }}>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    style={{ maxWidth: '100%', maxHeight: '200px' }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {renderSupplierPrices()}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {renderPromotions()}
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          form="item-form"
          variant="contained" 
          color="primary"
          disabled={isSubmitting || !formData.item_id || !formData.hebrew_description || !!retailPriceError}
        >
          {isSubmitting ? <CircularProgress size={24} /> : (mode === 'add' ? 'Add' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ItemDialog;
