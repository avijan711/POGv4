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
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  Description as FileIcon,
  Info as InfoIcon,
  SwapHoriz as SwapIcon,
  Numbers as NumbersIcon,
} from '@mui/icons-material';
import axios from 'axios';
import ColumnMappingDialog from './ColumnMappingDialog';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [inquiryNumber, setInquiryNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ message: '', details: '', suggestion: '' });
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [columns, setColumns] = useState([]);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [columnMapping, setColumnMapping] = useState(null);

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    console.log('Selected file:', {
      name: selectedFile?.name,
      type: selectedFile?.type,
      size: selectedFile?.size
    });

    // Validate file type
    if (selectedFile && !selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setError({
        message: 'Invalid file type',
        details: 'Please upload an Excel file (.xlsx or .xls)',
        suggestion: 'Download the sample file for reference'
      });
      event.target.value = '';
      return;
    }

    // Validate file size (50MB limit)
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      setError({
        message: 'File too large',
        details: 'Maximum file size is 50MB',
        suggestion: 'Please reduce the file size or split into multiple files'
      });
      event.target.value = '';
      return;
    }

    setFile(selectedFile);
    setError({ message: '', details: '', suggestion: '' });
    setSuccess('');

    // Get Excel columns for mapping
    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await axios.post(`${API_BASE_URL}/api/inquiries/columns`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true
        });

        // Ensure columns are strings
        const processedColumns = response.data.columns
          .filter(col => col != null)
          .map(col => String(col).trim())
          .filter(col => col.length > 0);

        if (processedColumns.length === 0) {
          throw new Error('No valid columns found in the Excel file');
        }

        setColumns(processedColumns);
        setShowMappingDialog(true);
      } catch (error) {
        console.error('Failed to read Excel columns:', error);
        setError({
          message: 'Failed to read Excel file',
          details: error.response?.data?.error || error.message,
          suggestion: 'Please ensure the file is a valid Excel file and try again'
        });
        setFile(null);
        event.target.value = '';
      }
    }
  };

  const handleMappingConfirm = (mapping) => {
    // Ensure all mapping values are strings
    const processedMapping = Object.entries(mapping).reduce((acc, [key, value]) => {
      acc[key] = value ? String(value).trim() : '';
      return acc;
    }, {});

    setColumnMapping(processedMapping);
    setShowMappingDialog(false);
    if (activeStep === 0) setActiveStep(1);
  };

  const handleInquiryNumberChange = (e) => {
    const value = e.target.value;
    // Allow any numeric input
    if (value === '' || /^\d+$/.test(value)) {
      setInquiryNumber(value);
    }
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

    if (!columnMapping) {
      setError({ message: 'Please map the Excel columns first' });
      setLoading(false);
      return;
    }

    // Validate inquiry number format
    if (!/^\d+$/.test(inquiryNumber)) {
      setError({
        message: 'Invalid inquiry number',
        details: 'Inquiry number must be numeric',
        suggestion: 'Please enter a valid numeric inquiry number'
      });
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('inquiryNumber', inquiryNumber);
    
    // Properly stringify the column mapping
    const mappingString = JSON.stringify(columnMapping);
    formData.append('columnMapping', mappingString);

    try {
      console.log('Initiating file upload:', {
        endpoint: `${API_BASE_URL}/api/inquiries/upload`,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        inquiryNumber,
        columnMapping: mappingString // Log the actual string being sent
      });
      
      const response = await axios.post(`${API_BASE_URL}/api/inquiries/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      });

      console.log('Upload successful:', response.data);

      setSuccess(`File uploaded successfully. Inquiry ID: ${response.data.inquiryId}`);
      setFile(null);
      setInquiryNumber('');
      setColumnMapping(null);
      setActiveStep(0);
      
      // Reset the file input
      const fileInput = document.getElementById('file-upload');
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (error) {
      console.error('Upload failed:', {
        error,
        response: error.response,
        request: error.request,
        config: error.config
      });

      let errorMessage = 'Failed to upload file';
      let errorDetails = '';
      let errorSuggestion = 'Please try again or contact support';

      if (error.response) {
        errorMessage = error.response.data?.error || errorMessage;
        errorDetails = error.response.data?.details || error.message;
        errorSuggestion = error.response.data?.suggestion || errorSuggestion;
      } else if (error.request) {
        errorMessage = 'No response from server';
        errorDetails = 'The server is not responding';
        errorSuggestion = 'Please check your internet connection and try again';
      } else {
        errorMessage = 'Request failed';
        errorDetails = error.message;
        errorSuggestion = 'Please check your connection and try again';
      }

      setError({
        message: errorMessage,
        details: errorDetails,
        suggestion: errorSuggestion
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleFile = async () => {
    try {
      console.log('Downloading sample file...');
      const response = await axios.get(`${API_BASE_URL}/sample.xlsx`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_inventory.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('Sample file downloaded successfully');
    } catch (error) {
      console.error('Failed to download sample file:', error);
      setError({
        message: 'Failed to download sample file',
        details: error.message,
        suggestion: 'Please try again or contact support'
      });
    }
  };

  return (
    <Box sx={{ width: '100%', p: 2, maxHeight: '90vh', overflowY: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Upload Inventory File
        </Typography>

        {/* Upload Form Section */}
        <Card variant="outlined" sx={{ mb: 4, mt: 2 }}>
          <CardContent>
            <form onSubmit={handleSubmit} encType="multipart/form-data">
              <Stepper activeStep={activeStep} orientation="vertical">
                <Step>
                  <StepLabel>
                    <Typography variant="subtitle1">Select and Map Excel File</Typography>
                  </StepLabel>
                  <StepContent>
                    <Box sx={{ mb: 2 }}>
                      <input
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        id="file-upload"
                        type="file"
                        onChange={handleFileChange}
                        name="file"
                      />
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                        <label htmlFor="file-upload">
                          <Button
                            variant="contained"
                            component="span"
                            startIcon={<CloudUploadIcon />}
                            sx={{ minWidth: 200, height: 48 }}
                            color="primary"
                          >
                            Select Excel File
                          </Button>
                        </label>
                        <Button
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={downloadSampleFile}
                          sx={{ height: 48 }}
                        >
                          Download Sample
                        </Button>
                      </Box>
                      {file && (
                        <Alert severity="success" icon={<FileIcon />}>
                          Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          {columnMapping && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Column mapping completed ✓
                            </Typography>
                          )}
                        </Alert>
                      )}
                    </Box>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>
                    <Typography variant="subtitle1">Enter Inquiry Number</Typography>
                  </StepLabel>
                  <StepContent>
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        label="Inquiry Number"
                        value={inquiryNumber}
                        onChange={handleInquiryNumberChange}
                        required
                        sx={{ maxWidth: 300 }}
                        helperText="Enter any numeric identifier for this inquiry"
                        error={inquiryNumber !== '' && !/^\d+$/.test(inquiryNumber)}
                        variant="outlined"
                        type="number"
                        inputProps={{
                          inputMode: 'numeric',
                          pattern: '[0-9]*',
                          min: "0",
                          step: "1"
                        }}
                        InputProps={{
                          startAdornment: <NumbersIcon sx={{ mr: 1, color: 'action.active' }} />,
                        }}
                      />
                      {inquiryNumber && /^\d+$/.test(inquiryNumber) && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => setActiveStep(2)}
                          sx={{ ml: 2, height: 56 }}
                        >
                          Next
                        </Button>
                      )}
                    </Box>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>
                    <Typography variant="subtitle1">Upload File</Typography>
                  </StepLabel>
                  <StepContent>
                    <Box sx={{ mb: 2 }}>
                      <Button
                        variant="contained"
                        type="submit"
                        disabled={loading || !file || !inquiryNumber || !/^\d+$/.test(inquiryNumber) || !columnMapping}
                        sx={{ minWidth: 120, height: 48 }}
                        color="primary"
                        startIcon={loading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                      >
                        {loading ? 'Uploading...' : 'Upload File'}
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              </Stepper>
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
          </CardContent>
        </Card>

        <Divider sx={{ my: 3 }} />
        
        {/* File Requirements Section */}
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
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
                  <ListItemText primary="Excel file (.xlsx or .xls)" secondary="Maximum size: 50MB" />
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
                    primary="Current Stock, Sold This Year, Sold Last Year, Retail Price (ILS)" 
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
          </CardContent>
        </Card>
      </Paper>

      <ColumnMappingDialog
        open={showMappingDialog}
        onClose={() => setShowMappingDialog(false)}
        columns={columns}
        onConfirm={handleMappingConfirm}
      />
    </Box>
  );
}

export default FileUpload;
