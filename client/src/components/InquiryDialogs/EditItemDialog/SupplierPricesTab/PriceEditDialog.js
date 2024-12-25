import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import SupplierSelect from './SupplierSelect';

function PriceEditDialog({
  open,
  onClose,
  price,
  onSave,
  availableSuppliers = [],
  isNew = false,
  item,
  loadPriceHistory,
}) {
  const [supplierPriceEur, setSupplierPriceEur] = useState('');
  const [retailPriceIls, setRetailPriceIls] = useState('');
  const [isPermanent, setIsPermanent] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Select Supplier', 'Enter Price Details'];

  // Format price with proper handling of null/undefined
  const formatPrice = (value, currency = '₪') => {
    if (value == null) return '-';
    const numValue = parseFloat(value);
    return isNaN(numValue) ? '-' : `${currency}${numValue.toFixed(2)}`;
  };

  useEffect(() => {
    if (open) {
      if (isNew) {
        setSupplierPriceEur('');
        setRetailPriceIls('');
        setIsPermanent(false);
        setNotes('');
        setSelectedSupplierId(availableSuppliers[0]?.supplier_id || '');
        setActiveStep(0);
      } else if (price) {
        setSupplierPriceEur(price.supplier_price_eur?.toString() || '');
        setRetailPriceIls(price.ils_retail_price?.toString() || '');
        setIsPermanent(!!price.is_permanent);
        setNotes(price.notes || '');
        setSelectedSupplierId(price.supplier_id);
        setActiveStep(1);
        loadPriceHistory && loadHistory(price.supplier_id);
      }
    }
  }, [open, price, isNew, availableSuppliers, loadPriceHistory]);

  const loadHistory = async (supplierId) => {
    if (!loadPriceHistory) return;

    try {
      setLoading(true);
      const history = await loadPriceHistory(supplierId);
      setPriceHistory(history);
    } catch (err) {
      console.error('Error loading price history:', err);
      setError('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !selectedSupplierId) {
      setError('Please select a supplier');
      return;
    }
    setActiveStep((prev) => prev + 1);
    setError(null);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!supplierPriceEur || isNaN(parseFloat(supplierPriceEur))) {
        throw new Error('Please enter a valid supplier price');
      }

      const success = await onSave({
        supplier_id: selectedSupplierId,
        price: parseFloat(supplierPriceEur),
        retail_price: retailPriceIls ? parseFloat(retailPriceIls) : null,
        is_permanent: isPermanent,
        notes: notes.trim(),
      });

      if (success) {
        onClose();
      }
    } catch (err) {
      console.error('Error saving price:', err);
      setError(err.message || 'Failed to save price');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
    case 0:
      return (
        <Box sx={{ mt: 2 }}>
          <SupplierSelect
            suppliers={availableSuppliers}
            selectedSupplierId={selectedSupplierId}
            onChange={setSelectedSupplierId}
            error={error}
          />
        </Box>
      );
    case 1:
      return (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Item: {item?.item_id}
            </Typography>
            {!isNew && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Current Supplier Price: {formatPrice(price?.supplier_price_eur, '€')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current Retail Price: {formatPrice(price?.ils_retail_price)}
                </Typography>
              </>
            )}
          </Box>

          <TextField
            label="Supplier Price (EUR)"
            type="number"
            value={supplierPriceEur}
            onChange={(e) => setSupplierPriceEur(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: '€',
            }}
          />

          <TextField
            label="Retail Price (ILS)"
            type="number"
            value={retailPriceIls}
            onChange={(e) => setRetailPriceIls(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: '₪',
            }}
            helperText="Optional - Leave empty to keep current retail price"
          />

          <FormControlLabel
            control={
              <Switch
                checked={isPermanent}
                onChange={(e) => setIsPermanent(e.target.checked)}
              />
            }
            label={
              <Typography>
                Make this a permanent price for this supplier
              </Typography>
            }
            sx={{ mb: 2 }}
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            sx={{ mb: 3 }}
          />

          {!isNew && priceHistory.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Price History
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Supplier Price (EUR)</TableCell>
                      <TableCell align="right">Retail Price (ILS)</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {priceHistory.map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          {formatPrice(record.supplier_price_eur, '€')}
                        </TableCell>
                        <TableCell align="right">
                          {formatPrice(record.ils_retail_price)}
                        </TableCell>
                        <TableCell>
                          {record.is_permanent ? 'Permanent' : 
                            record.is_promotion ? 'Promotion' : 'Inquiry'}
                        </TableCell>
                        <TableCell>{record.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      );
    default:
      return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {isNew ? 'Add New Supplier Price' : `Edit Price - ${price?.supplier_name}`}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} sx={{ pt: 2, pb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent(activeStep)}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack}>
            Back
          </Button>
        )}
        {activeStep === steps.length - 1 ? (
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={loading || !supplierPriceEur}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!selectedSupplierId}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default PriceEditDialog;