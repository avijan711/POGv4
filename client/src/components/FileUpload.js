import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  Description as FileIcon,
  Info as InfoIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import axios from 'axios';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [inquiryNumber, setInquiryNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ message: '', details: '', suggestion: '' });
  const [success, setSuccess] = useState('');

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setError({ message: '', details: '', suggestion: '' });
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError({ message: '', details: '', suggestion: '' });
    setSuccess('');

    if (!file) {
      setError({ message: 'Please select a file to upload' });
      setLoading(false);
      return;
    }

    if (!inquiryNumber) {
      setError({ message: 'Please enter an inquiry number' });
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('inquiryNumber', inquiryNumber);

    // Column mapping that exactly matches the Excel file headers
    const columnMapping = {
      itemID: 'Item ID',
      hebrewDescription: 'Hebrew Description',
      englishDescription: 'English Description',
      importMarkup: 'Import Markup',
      hsCode: 'HS Code',
      qtyInStock: 'Current Stock',
      retailPrice: 'Retail Price',  // Changed from 'Retail Price (ILS)' to match Excel header
      soldThisYear: 'Sold This Year',
      soldLastYear: 'Sold Last Year',
      requestedQty: 'Requested Quantity',
      newReferenceID: 'New Reference ID',
      referenceNotes: 'Reference Notes'
    };

    formData.append('columnMapping', JSON.stringify(columnMapping));

    try {
      console.log('Sending request to:', `${API_BASE_URL}/api/inquiries/upload`);
      console.log('Column mapping:', columnMapping);
      console.log('File:', file);
      console.log('Inquiry Number:', inquiryNumber);
      
      const response = await axios.post(`${API_BASE_URL}/api/inquiries/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true
      });

      console.log('Upload response:', response.data);

      setSuccess(`File uploaded successfully. Inquiry ID: ${response.data.inquiryId}`);
      setFile(null);
      setInquiryNumber('');
      
      // Reset the file input
      const fileInput = document.getElementById('file-upload');
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (error) {
      console.error('Upload error:', error);
      setError({
        message: error.response?.data?.error || 'Failed to upload file',
        details: error.response?.data?.details || error.message || '',
        suggestion: error.response?.data?.suggestion || 'Please try again or contact support'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleFile = () => {
    window.location.href = `${API_BASE_URL}/sample.xlsx`;
  };

  return (
    <Box sx={{ width: '100%', p: 2, maxHeight: '90vh', overflowY: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Upload Inventory File
        </Typography>

        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={downloadSampleFile}
          sx={{ mb: 3 }}
        >
          Download Sample File
        </Button>
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon />
            File Requirements
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              File Format:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <FileIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Excel file (.xlsx or .xls)" />
              </ListItem>
            </List>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Required Columns:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Item ID" 
                  secondary="Unique identifier for each item"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Hebrew Description" 
                  secondary="Item description in Hebrew"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Requested Quantity" 
                  secondary="Number of items being requested"
                />
              </ListItem>
            </List>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Optional Columns:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="secondary" />
                </ListItemIcon>
                <ListItemText 
                  primary="English Description" 
                  secondary="Item description in English"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="secondary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Import Markup" 
                  secondary="Value between 1.00 and 2.00 (e.g., 1.30 for 30% markup)"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="secondary" />
                </ListItemIcon>
                <ListItemText 
                  primary="HS Code" 
                  secondary="Harmonized System code"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="secondary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Current Stock, Sold This Year, Sold Last Year, Retail Price" 
                  secondary="Additional item information"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <SwapIcon color="secondary" />
                </ListItemIcon>
                <ListItemText 
                  primary="New Reference ID" 
                  secondary="ID of the item that replaces this item"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon color="secondary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Reference Notes" 
                  secondary="Additional information about the reference change"
                />
              </ListItem>
            </List>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Inquiry Number"
              value={inquiryNumber}
              onChange={(e) => setInquiryNumber(e.target.value)}
              required
              sx={{ maxWidth: 300 }}
              helperText="Enter a unique identifier for this inquiry"
            />

            <Box>
              <input
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                name="file"
              />
              <label htmlFor="file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                >
                  Select Excel File
                </Button>
              </label>
              {file && (
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                  Selected file: {file.name}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                type="submit"
                disabled={loading || !file || !inquiryNumber}
              >
                Upload
              </Button>
              {loading && <CircularProgress size={24} />}
            </Box>
          </Box>
        </form>

        {error.message && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="error">
              <Typography variant="subtitle1">{error.message}</Typography>
              {error.details && (
                <Typography variant="body2" sx={{ mt: 1 }}>{error.details}</Typography>
              )}
              {error.suggestion && (
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Suggestion: {error.suggestion}
                </Typography>
              )}
            </Alert>
          </Box>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default FileUpload;
