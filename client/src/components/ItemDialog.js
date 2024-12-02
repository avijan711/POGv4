/**
 * ItemDialog Component
 * 
 * This component provides a dialog for creating and editing inventory items.
 * It works in conjunction with ItemDetailsDialog but serves a different purpose:
 * - ItemDialog (this): Form-based editing with validation
 * - ItemDetailsDialog: Read-only view with reference tracking
 * 
 * @param {Object} props
 * @param {boolean} props.open - Controls dialog visibility
 * @param {Function} props.onClose - Handler for dialog close
 * @param {Object} props.item - Item data for editing (null for new items)
 * @param {Function} props.onSave - Handler for save action
 * @param {string} props.mode - Either 'add' or 'edit'
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
  CircularProgress
} from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { useItemDetails } from '../hooks/useItemDetails';
import { API_BASE_URL } from '../config';

// EUR to ILS conversion rate
const EUR_TO_ILS = 4.1;

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ marginTop: '16px' }}>
      {value === index && children}
    </div>
  );
}

function ItemDialog({ open, onClose, item, onSave, mode }) {
  // Use the enhanced useItemDetails hook in edit mode
  const {
    tabValue,
    setTabValue,
    itemData,
    isLoading,
    hasError,
    error
  } = useItemDetails(item, open, 'edit');

  const defaultFormData = useMemo(() => ({
    itemID: '',
    hebrewDescription: '',
    englishDescription: '',
    importMarkup: '1.30',
    hsCode: '',
    image: null,
    qtyInStock: '0',
    soldThisYear: '0',
    soldLastYear: '0',
    retailPrice: ''
  }), []);

  const [formData, setFormData] = useState(defaultFormData);
  const [imagePreview, setImagePreview] = useState(null);
  const [retailPriceError, setRetailPriceError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when itemData changes
  useEffect(() => {
    if (open && itemData) {
      setFormData({
        itemID: itemData.itemID || '',
        hebrewDescription: itemData.hebrewDescription || '',
        englishDescription: itemData.englishDescription || '',
        importMarkup: itemData.importMarkup.toString(),
        hsCode: itemData.hsCode || '',
        retailPrice: itemData.retailPrice?.toString() || '',
        qtyInStock: itemData.qtyInStock.toString(),
        soldThisYear: itemData.soldThisYear.toString(),
        soldLastYear: itemData.soldLastYear.toString(),
        image: itemData.image || null,
      });
      
      if (itemData.image) {
        setImagePreview(`${API_BASE_URL}/uploads/${itemData.image}`);
      }
    } else if (!open) {
      setFormData(defaultFormData);
      setImagePreview(null);
      setRetailPriceError('');
      setTabValue(0);
      setIsSubmitting(false);
    }
  }, [open, itemData, defaultFormData, setTabValue]);

  // Calculate discount percentage from retail price
  const calculateDiscount = (priceEUR, importMarkup, retailPriceILS) => {
    if (!retailPriceILS) return null;
    const supplierPriceILS = priceEUR * EUR_TO_ILS * importMarkup;
    const discount = ((retailPriceILS - supplierPriceILS) / retailPriceILS) * 100;
    return Math.max(0, Math.min(100, discount));
  };

  const handleChange = (field) => (event) => {
    let value = event.target.value;
    
    if (['importMarkup', 'qtyInStock', 'soldThisYear', 'soldLastYear', 'retailPrice'].includes(field)) {
      value = value.replace(/[^\d.]/g, '');
      const parts = value.split('.');
      if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
      }
      
      if (field === 'importMarkup') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          value = Math.min(2.0, Math.max(1.0, numValue)).toFixed(2);
        }
      } else if (field === 'retailPrice') {
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

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (formData.retailPrice) {
      const retailPrice = parseFloat(formData.retailPrice);
      if (!retailPrice || retailPrice <= 0) {
        setRetailPriceError('Retail price must be greater than 0');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const submitData = new FormData();
      
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          // Convert camelCase to snake_case for backend
          const backendKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          submitData.append(backendKey, value);
        }
      });

      if (formData.image instanceof File) {
        submitData.append('image', formData.image);
      }

      await onSave(submitData);
    } catch (error) {
      console.error('Error submitting form:', error);
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

    const retailPrice = parseFloat(formData.retailPrice);
    const importMarkup = parseFloat(formData.importMarkup);

    const supplierDiscounts = {};
    itemData.supplierPrices.forEach(price => {
      const discount = calculateDiscount(price.price, importMarkup, retailPrice);
      if (discount !== null) {
        supplierDiscounts[price.supplierName] = discount;
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
              const isBestSupplier = price.supplierName === bestSupplier;
              const discount = supplierDiscounts[price.supplierName];
              
              return (
                <TableRow 
                  key={index}
                  sx={isBestSupplier ? { backgroundColor: '#f0fff0' } : {}}
                >
                  <TableCell>{price.supplierName}</TableCell>
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
                <TableCell>{promo.supplierName}</TableCell>
                <TableCell>{format(new Date(promo.startDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{format(new Date(promo.endDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>€{promo.price.toFixed(2)}</TableCell>
                <TableCell>{promo.isActive ? 'Active' : 'Inactive'}</TableCell>
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
            {error || 'An error occurred while loading item data'}
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
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Details" />
            <Tab label="Supplier Prices" />
            <Tab label="Promotions" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Item ID"
              value={formData.itemID}
              onChange={handleChange('itemID')}
              disabled={mode === 'edit'}
              required
              error={!formData.itemID}
              helperText={!formData.itemID ? 'Item ID is required' : ''}
            />
            <TextField
              label="Hebrew Description"
              value={formData.hebrewDescription}
              onChange={handleChange('hebrewDescription')}
              required
              dir="rtl"
              error={!formData.hebrewDescription}
              helperText={!formData.hebrewDescription ? 'Hebrew description is required' : ''}
            />
            <TextField
              label="English Description"
              value={formData.englishDescription}
              onChange={handleChange('englishDescription')}
            />
            <TextField
              label="Import Markup"
              value={formData.importMarkup}
              onChange={handleChange('importMarkup')}
              required
              helperText="Enter value between 1.00 and 2.00 (e.g., 1.30 for 30% markup)"
              inputProps={{
                inputMode: 'decimal',
                pattern: '[1-2].[0-9]*'
              }}
            />
            <TextField
              label="HS Code"
              value={formData.hsCode}
              onChange={handleChange('hsCode')}
            />
            <TextField
              label="Stock Quantity"
              value={formData.qtyInStock}
              onChange={handleChange('qtyInStock')}
              type="number"
              inputProps={{ min: "0" }}
            />
            <TextField
              label="Sold This Year"
              value={formData.soldThisYear}
              onChange={handleChange('soldThisYear')}
              type="number"
              inputProps={{ min: "0" }}
            />
            <TextField
              label="Sold Last Year"
              value={formData.soldLastYear}
              onChange={handleChange('soldLastYear')}
              type="number"
              inputProps={{ min: "0" }}
            />
            <TextField
              label="Retail Price (ILS)"
              value={formData.retailPrice}
              onChange={handleChange('retailPrice')}
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
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={isSubmitting || !formData.itemID || !formData.hebrewDescription || !!retailPriceError}
        >
          {isSubmitting ? <CircularProgress size={24} /> : (mode === 'add' ? 'Add' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ItemDialog;
