import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import PromotionColumnMapper from './PromotionColumnMapper';

function PromotionUploadDialog({ open, onClose, onComplete }) {
  const [name, setName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [file, setFile] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showColumnMapper, setShowColumnMapper] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setSupplier('');
      setStartDate('');
      setEndDate('');
      setFile(null);
      setError('');
      setShowColumnMapper(false);
      fetchSuppliers();
    }
  }, [open]);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/suppliers`);
      setSuppliers(response.data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError('Failed to load suppliers');
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
        setError('Please upload an Excel file (.xlsx)');
        setFile(null);
        event.target.value = null;
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleNext = () => {
    if (!validateForm()) return;
    setShowColumnMapper(true);
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Please enter a promotion name');
      return false;
    }
    if (!supplier) {
      setError('Please select a supplier');
      return false;
    }
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return false;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date');
      return false;
    }
    if (!file) {
      setError('Please select a file to upload');
      return false;
    }
    return true;
  };

  const handleClose = () => {
    setName('');
    setSupplier('');
    setStartDate('');
    setEndDate('');
    setFile(null);
    setError('');
    setShowColumnMapper(false);
    onClose();
  };

  const handleUploadComplete = () => {
    handleClose();
    onComplete();
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <Dialog open={open && !showColumnMapper} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Upload New Promotion</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Promotion Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Supplier</InputLabel>
              <Select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                label="Supplier"
              >
                {suppliers.map((s) => (
                  <MenuItem key={s.supplier_id} value={s.supplier_id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: today }}
            />

            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: startDate || today }}
            />

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Upload Excel file with promotion prices
              </Typography>
              <Button
                variant="outlined"
                component="label"
                fullWidth
              >
                {file ? file.name : 'Choose File'}
                <input
                  type="file"
                  hidden
                  accept=".xlsx"
                  onChange={handleFileChange}
                />
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                File should contain Item ID and Price columns
              </Typography>
            </Box>

            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
                        Cancel
          </Button>
          <Button 
            onClick={handleNext}
            variant="contained"
          >
                        Next
          </Button>
        </DialogActions>
      </Dialog>

      <PromotionColumnMapper
        open={showColumnMapper}
        onClose={() => setShowColumnMapper(false)}
        onComplete={handleUploadComplete}
        file={file}
        promotionData={{
          name,
          supplier,
          startDate,
          endDate,
        }}
      />
    </>
  );
}

export default PromotionUploadDialog;
