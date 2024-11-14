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
  Paper,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';
import { format } from 'date-fns';

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
  const [tabValue, setTabValue] = useState(0);

  // Calculate discount percentage from retail price
  const calculateDiscount = (priceEUR, importMarkup, retailPriceILS) => {
    if (!retailPriceILS) return null;
    // Convert supplier price to ILS and apply markup
    const supplierPriceILS = priceEUR * EUR_TO_ILS * importMarkup;
    // Calculate discount percentage
    const discount = ((retailPriceILS - supplierPriceILS) / retailPriceILS) * 100;
    return Math.max(0, Math.min(100, discount)); // Clamp between 0-100%
  };

  useEffect(() => {
    if (open && item) {
      console.log('ItemDialog opened with item:', item);
      setFormData({
        itemID: item.itemID || '',
        hebrewDescription: item.hebrewDescription || '',
        englishDescription: item.englishDescription || '',
        importMarkup: item.importMarkup?.toString() || '1.30',
        hsCode: item.hsCode || '',
        retailPrice: item.retailPrice?.toString().replace(/[₪]/g, '') || '',
        qtyInStock: item.qtyInStock?.toString() || '0',
        soldThisYear: item.soldThisYear?.toString() || '0',
        soldLastYear: item.soldLastYear?.toString() || '0',
        image: item.image || null,
      });
      if (item.image) {
        setImagePreview(`http://localhost:5000/uploads/${item.image}`);
      }
    } else if (!open) {
      setFormData(defaultFormData);
      setImagePreview(null);
      setRetailPriceError('');
      setTabValue(0);
    }
  }, [open, item, defaultFormData]);

  const handleChange = (field) => (event) => {
    let value = event.target.value;
    
    // Handle numeric fields
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
        // For other numeric fields, ensure non-negative values
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

  const handleSubmit = () => {
    // Validate retail price if provided
    if (formData.retailPrice) {
      const retailPrice = parseFloat(formData.retailPrice);
      if (!retailPrice || retailPrice <= 0) {
        setRetailPriceError('Retail price must be greater than 0');
        return;
      }
    }

    const submitData = new FormData();
    
    // Add all form fields to FormData
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== '') {
        submitData.append(key, value);
      }
    });

    // Add image only if it's a File object (new upload)
    if (formData.image instanceof File) {
      submitData.append('image', formData.image);
    }

    console.log('Submitting form data:', {
      itemID: formData.itemID,
      hebrewDescription: formData.hebrewDescription,
      englishDescription: formData.englishDescription,
      importMarkup: formData.importMarkup,
      hsCode: formData.hsCode,
      qtyInStock: formData.qtyInStock,
      soldThisYear: formData.soldThisYear,
      soldLastYear: formData.soldLastYear,
      retailPrice: formData.retailPrice,
      hasImage: formData.image instanceof File
    });

    onSave(submitData);
  };

  const handleClose = () => {
    setFormData(defaultFormData);
    setImagePreview(null);
    setRetailPriceError('');
    setTabValue(0);
    onClose();
  };

  // Format supplier prices section
  const renderSupplierPrices = () => {
    if (!item?.supplierPrices?.length) return null;

    const retailPrice = parseFloat(formData.retailPrice);
    const importMarkup = parseFloat(formData.importMarkup);

    // Calculate discounts and find the best supplier
    const supplierDiscounts = {};
    item.supplierPrices.forEach(price => {
      const discount = calculateDiscount(price.price, importMarkup, retailPrice);
      if (discount !== null) {
        supplierDiscounts[price.supplierName] = discount;
      }
    });

    // Find highest and second highest discounts
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
              <TableCell>History</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {item.supplierPrices.map((price, index) => {
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
                  <TableCell>
                    <Button size="small">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    );
  };

  // Format promotions section
  const renderPromotions = () => {
    if (!item?.promotions?.length) return null;

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
            {item.promotions.map((promo, index) => (
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

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
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
            />
            <TextField
              label="Hebrew Description"
              value={formData.hebrewDescription}
              onChange={handleChange('hebrewDescription')}
              required
              dir="rtl"
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
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={!formData.itemID || !formData.hebrewDescription || !!retailPriceError}
        >
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ItemDialog;
