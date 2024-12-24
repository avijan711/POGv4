import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  LinearProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import ColumnMappingDialog from './ColumnMappingDialog';

function SupplierResponseUpload({ open, onClose, onSuccess, inquiryId }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [columns, setColumns] = useState([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  useEffect(() => {
    const fetchSuppliers = async () => {
      setLoadingSuppliers(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/suppliers`);
        setSuppliers(response.data);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
        setError('Failed to load suppliers. Please try again.');
      } finally {
        setLoadingSuppliers(false);
      }
    };

    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  const handleFileSelect = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx')) {
      setError('Please select an Excel (.xlsx) file');
      return;
    }

    if (!selectedSupplierId) {
      setError('Please select a supplier first');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Get columns for mapping
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/supplier-responses/columns`, formData);
      setColumns(response.data.columns);
      setMappingOpen(true);
    } catch (err) {
      console.error('Error reading columns:', err);
      setError('Failed to read Excel columns. Please try again.');
    }
  };

  const handleUpload = async (columnMapping) => {
    if (!file || !columnMapping || !selectedSupplierId) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('inquiry_id', inquiryId);
    formData.append('supplier_id', selectedSupplierId);
    formData.append('column_mapping', JSON.stringify(columnMapping));

    try {
      await axios.post(`${API_BASE_URL}/api/supplier-responses/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          setUploadProgress(progress);
        },
      });

      setFile(null);
      setError('');
      setMappingOpen(false);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.response?.data?.error || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setError('');
      setUploadProgress(0);
      setSelectedSupplierId('');
      onClose();
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography>Upload Supplier Response</Typography>
            {!uploading && (
              <IconButton onClick={handleClose} size="small">
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="supplier-select-label">Select Supplier</InputLabel>
            <Select
              labelId="supplier-select-label"
              id="supplier-select"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              label="Select Supplier"
              disabled={uploading || loadingSuppliers}
            >
              {suppliers.map((supplier) => (
                <MenuItem key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Paper
            variant="outlined"
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: uploading || !selectedSupplierId ? 'not-allowed' : 'pointer',
              '&:hover': {
                backgroundColor: uploading || !selectedSupplierId ? 'inherit' : 'action.hover',
              },
            }}
            component="label"
          >
            <input
              type="file"
              accept=".xlsx"
              hidden
              onChange={handleFileSelect}
              disabled={uploading || !selectedSupplierId}
            />
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {file ? file.name : 'Select Excel File'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedSupplierId 
                ? 'Click or drag and drop an Excel file here'
                : 'Please select a supplier first'}
            </Typography>
          </Paper>

          {uploading && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Uploading...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(uploadProgress)}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <ColumnMappingDialog
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        columns={columns}
        onConfirm={handleUpload}
        uploadType="supplier_response"
      />
    </>
  );
}

export default SupplierResponseUpload;
