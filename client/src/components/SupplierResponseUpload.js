import React, { useState, useEffect } from 'react';
import { 
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    Alert,
    CircularProgress,
    Stepper,
    Step,
    StepLabel,
    Paper
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const steps = ['Select File & Supplier', 'Map Columns', 'Upload'];

const defaultColumnMapping = {
    ItemID: '',
    NewReferenceID: '',
    Price: '',
    Notes: '',
    HSCode: '',
    EnglishDescription: ''
};

// Required fields that must always be included in the mapping
const requiredFields = ['ItemID'];

const SupplierResponseUpload = ({ open, onClose, onUploadSuccess, inquiryId }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [error, setError] = useState(null);
    const [errorSuggestion, setErrorSuggestion] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [availableColumns, setAvailableColumns] = useState([]);
    const [tempFile, setTempFile] = useState(null);
    const [columnMapping, setColumnMapping] = useState(defaultColumnMapping);

    useEffect(() => {
        if (open) {
            fetchSuppliers();
            setActiveStep(0);
            setSelectedFile(null);
            setSelectedSupplier('');
            setError(null);
            setErrorSuggestion(null);
            setColumnMapping(defaultColumnMapping);
        }
    }, [open]);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/api/suppliers`);
            const data = response.data;
            if (Array.isArray(data)) {
                setSuppliers(data.map(supplier => ({
                    id: supplier.SupplierID,
                    name: supplier.Name
                })));
            } else {
                throw new Error('Invalid supplier data format');
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            setError('Failed to load suppliers');
            setErrorSuggestion('Please try refreshing the page or contact support');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setError(null);
        setErrorSuggestion(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`${API_BASE_URL}/api/supplier-responses/columns`, formData);
            const { columns } = response.data;
            setAvailableColumns(columns || []);
        } catch (error) {
            console.error('Error reading file:', error);
            setError('Failed to read file columns');
            setErrorSuggestion('Please ensure the file is a valid Excel file');
            setSelectedFile(null);
        }
    };

    const handleNext = () => {
        if (activeStep === 0 && (!selectedFile || !selectedSupplier)) {
            setError('Please select both a file and a supplier');
            setErrorSuggestion('You must choose a supplier and upload an Excel file before proceeding');
            return;
        }
        if (activeStep === 1 && !columnMapping.ItemID) {
            setError('Please map at least the Item ID column');
            setErrorSuggestion('The Item ID column is required to match items in the system');
            return;
        }
        setActiveStep((prev) => prev + 1);
        setError(null);
        setErrorSuggestion(null);
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
        setError(null);
        setErrorSuggestion(null);
    };

    const handleColumnMappingChange = (field, value) => {
        const safeValue = value != null ? String(value) : '';
        setColumnMapping(prev => ({
            ...prev,
            [field]: safeValue
        }));
    };

    const handleUpload = async () => {
        if (!inquiryId) {
            setError('Missing inquiry ID');
            setErrorSuggestion('Please ensure you are uploading a response for a valid inquiry');
            return;
        }

        setUploading(true);
        setError(null);
        setErrorSuggestion(null);

        try {
            const validMapping = Object.entries(columnMapping).reduce((acc, [key, value]) => {
                if (requiredFields.includes(key) || value) {
                    acc[key] = String(value || '');
                }
                return acc;
            }, {});

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('columnMapping', JSON.stringify(validMapping));
            formData.append('supplierId', selectedSupplier);
            formData.append('inquiryId', inquiryId);

            const response = await axios.post(`${API_BASE_URL}/api/supplier-responses/upload`, formData);

            if (onUploadSuccess) {
                onUploadSuccess(response.data);
            }
            onClose();
        } catch (error) {
            console.error('Upload error:', error);
            setError(error.response?.data?.message || 'Failed to upload file');
            setErrorSuggestion(error.response?.data?.suggestion || 'Please try again or contact support if the issue persists');
        } finally {
            setUploading(false);
        }
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel id="supplier-select-label">Supplier</InputLabel>
                            <Select
                                labelId="supplier-select-label"
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                                label="Supplier"
                                disabled={loading}
                            >
                                {suppliers.map((supplier) => (
                                    <MenuItem key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: '#f5f5f5',
                                '&:hover': {
                                    backgroundColor: '#eeeeee'
                                }
                            }}
                            onClick={() => document.getElementById('file-input').click()}
                        >
                            <input
                                id="file-input"
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                            <Typography variant="h6" gutterBottom>
                                Click to Upload Excel File
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                {selectedFile ? selectedFile.name : 'Supported formats: .xlsx, .xls'}
                            </Typography>
                        </Paper>
                    </Box>
                );
            case 1:
                return (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Map Excel Columns to Fields
                        </Typography>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Item ID (Required)</InputLabel>
                            <Select
                                value={columnMapping.ItemID}
                                onChange={(e) => handleColumnMappingChange('ItemID', e.target.value)}
                                label="Item ID (Required)"
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {availableColumns.map((col) => (
                                    <MenuItem key={col} value={col}>
                                        {col}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>New Reference ID</InputLabel>
                            <Select
                                value={columnMapping.NewReferenceID}
                                onChange={(e) => handleColumnMappingChange('NewReferenceID', e.target.value)}
                                label="New Reference ID"
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {availableColumns.map((col) => (
                                    <MenuItem key={col} value={col}>
                                        {col}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Price</InputLabel>
                            <Select
                                value={columnMapping.Price}
                                onChange={(e) => handleColumnMappingChange('Price', e.target.value)}
                                label="Price"
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {availableColumns.map((col) => (
                                    <MenuItem key={col} value={col}>
                                        {col}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Notes</InputLabel>
                            <Select
                                value={columnMapping.Notes}
                                onChange={(e) => handleColumnMappingChange('Notes', e.target.value)}
                                label="Notes"
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {availableColumns.map((col) => (
                                    <MenuItem key={col} value={col}>
                                        {col}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>HS Code</InputLabel>
                            <Select
                                value={columnMapping.HSCode}
                                onChange={(e) => handleColumnMappingChange('HSCode', e.target.value)}
                                label="HS Code"
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {availableColumns.map((col) => (
                                    <MenuItem key={col} value={col}>
                                        {col}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>English Description</InputLabel>
                            <Select
                                value={columnMapping.EnglishDescription}
                                onChange={(e) => handleColumnMappingChange('EnglishDescription', e.target.value)}
                                label="English Description"
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {availableColumns.map((col) => (
                                    <MenuItem key={col} value={col}>
                                        {col}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                );
            case 2:
                return (
                    <Box sx={{ mt: 2 }}>
                        <Typography>
                            Review your selections and click Upload to process the file.
                        </Typography>
                        <Typography variant="subtitle1" sx={{ mt: 2 }}>Selected Mappings:</Typography>
                        <Typography variant="body2">Item ID: {columnMapping.ItemID}</Typography>
                        {columnMapping.NewReferenceID && (
                            <Typography variant="body2">New Reference ID: {columnMapping.NewReferenceID}</Typography>
                        )}
                        {columnMapping.Price && (
                            <Typography variant="body2">Price: {columnMapping.Price}</Typography>
                        )}
                        {columnMapping.Notes && (
                            <Typography variant="body2">Notes: {columnMapping.Notes}</Typography>
                        )}
                        {columnMapping.HSCode && (
                            <Typography variant="body2">HS Code: {columnMapping.HSCode}</Typography>
                        )}
                        {columnMapping.EnglishDescription && (
                            <Typography variant="body2">English Description: {columnMapping.EnglishDescription}</Typography>
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
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: {
                    minHeight: '60vh'
                }
            }}
        >
            <DialogTitle>Upload Supplier Response</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ pt: 3, pb: 5 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    renderStepContent(activeStep)
                )}
                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                        {errorSuggestion && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                {errorSuggestion}
                            </Typography>
                        )}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                {activeStep > 0 && (
                    <Button onClick={handleBack}>Back</Button>
                )}
                {activeStep < steps.length - 1 ? (
                    <Button 
                        onClick={handleNext}
                        variant="contained"
                        color="primary"
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        onClick={handleUpload}
                        variant="contained"
                        color="primary"
                        disabled={uploading}
                        startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default SupplierResponseUpload;
