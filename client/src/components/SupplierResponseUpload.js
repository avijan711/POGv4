import React, { useState } from 'react';
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
    StepLabel
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { API_BASE_URL } from '../config';

const steps = ['Select File & Supplier', 'Map Columns', 'Upload'];

const defaultColumnMapping = {
    itemID: '',
    newReferenceID: '',
    price: '',
    notes: '',
    hsCode: '',
    englishDescription: ''
};

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

    // Validate required props
    React.useEffect(() => {
        if (!inquiryId) {
            console.error('InquiryId is required for SupplierResponseUpload');
            setError('Missing inquiry ID');
            setErrorSuggestion('Please ensure you are uploading a response for a valid inquiry');
        }
    }, [inquiryId]);

    React.useEffect(() => {
        if (open) {
            fetchSuppliers();
        }
    }, [open]);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/suppliers`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch suppliers');
            }
            const data = await response.json();
            setSuppliers(data || []);
            setError(null);
            setErrorSuggestion(null);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            setSuppliers([]);
            setError('Failed to load suppliers: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            const ext = file.name.toLowerCase();
            if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
                setSelectedFile(file);
                setError(null);
                setErrorSuggestion(null);

                const formData = new FormData();
                formData.append('file', file);

                try {
                    const response = await fetch(`${API_BASE_URL}/api/supplier-responses/columns`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw {
                            message: errorData.message || errorData.error || 'Failed to read columns',
                            suggestion: errorData.suggestion
                        };
                    }

                    const data = await response.json();
                    
                    // Process columns to ensure they are strings
                    const processedColumns = (data.columns || [])
                        .filter(col => col != null)
                        .map(col => String(col).trim())
                        .filter(col => col.length > 0);

                    if (processedColumns.length === 0) {
                        throw {
                            message: 'No valid columns found in the file',
                            suggestion: 'Please ensure your Excel file has headers in the first row'
                        };
                    }

                    setAvailableColumns(processedColumns);
                    setTempFile(data.tempFile);
                } catch (error) {
                    console.error('Error reading columns:', error);
                    setError(error.message || 'Failed to read file columns');
                    setErrorSuggestion(error.suggestion);
                    setSelectedFile(null);
                    event.target.value = '';
                }
            } else {
                setError('Please select an Excel file (.xlsx or .xls)');
                setErrorSuggestion('Only Excel files with extensions .xlsx or .xls are supported');
                setSelectedFile(null);
                event.target.value = '';
            }
        }
    };

    const handleNext = () => {
        if (activeStep === 0 && (!selectedFile || !selectedSupplier)) {
            setError('Please select both a file and a supplier');
            setErrorSuggestion('You must choose a supplier and upload an Excel file before proceeding');
            return;
        }
        if (activeStep === 1 && !columnMapping.itemID) {
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
        // Ensure value is a string
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
            // Validate column mapping before sending
            const validMapping = Object.entries(columnMapping).reduce((acc, [key, value]) => {
                // Only include non-empty values and ensure they are strings
                if (value) {
                    acc[key] = String(value);
                }
                return acc;
            }, {});

            // Create FormData and append all necessary data
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('columnMapping', JSON.stringify(validMapping));
            formData.append('supplierId', selectedSupplier);
            formData.append('inquiryId', inquiryId);

            const response = await fetch(`${API_BASE_URL}/api/supplier-responses/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw {
                    message: errorData.message || errorData.error || 'Upload failed',
                    suggestion: errorData.suggestion
                };
            }

            const data = await response.json();
            if (onUploadSuccess) {
                onUploadSuccess(data);
            }
            handleClose();
        } catch (error) {
            console.error('Upload error:', error);
            setError(error.message || 'Failed to upload file');
            setErrorSuggestion(error.suggestion || 'Please try again or contact support if the issue persists');
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setSelectedSupplier('');
        setError(null);
        setErrorSuggestion(null);
        setActiveStep(0);
        setAvailableColumns([]);
        setTempFile(null);
        setColumnMapping(defaultColumnMapping);
        onClose();
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 3 }} disabled={loading}>
                            <InputLabel>Select Supplier</InputLabel>
                            <Select
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                                label="Select Supplier"
                            >
                                {suppliers.map((supplier) => (
                                    <MenuItem key={supplier.SupplierID} value={supplier.SupplierID}>
                                        {supplier.Name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box
                            sx={{
                                border: '2px dashed #ccc',
                                borderRadius: 2,
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                },
                                backgroundColor: selectedFile ? 'rgba(0, 0, 0, 0.04)' : 'inherit'
                            }}
                            onClick={() => !uploading && document.getElementById('file-input').click()}
                        >
                            <input
                                id="file-input"
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                disabled={uploading}
                            />
                            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                            <Typography>
                                {selectedFile ? selectedFile.name : 'Click to select Excel file'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                                Only Excel files (.xlsx, .xls) are allowed
                            </Typography>
                        </Box>
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
                                value={columnMapping.itemID}
                                onChange={(e) => handleColumnMappingChange('itemID', e.target.value)}
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
                                value={columnMapping.newReferenceID}
                                onChange={(e) => handleColumnMappingChange('newReferenceID', e.target.value)}
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
                                value={columnMapping.price}
                                onChange={(e) => handleColumnMappingChange('price', e.target.value)}
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
                                value={columnMapping.notes}
                                onChange={(e) => handleColumnMappingChange('notes', e.target.value)}
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
                                value={columnMapping.hsCode}
                                onChange={(e) => handleColumnMappingChange('hsCode', e.target.value)}
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
                                value={columnMapping.englishDescription}
                                onChange={(e) => handleColumnMappingChange('englishDescription', e.target.value)}
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
                        <Typography variant="body2">Item ID: {columnMapping.itemID}</Typography>
                        {columnMapping.newReferenceID && (
                            <Typography variant="body2">New Reference ID: {columnMapping.newReferenceID}</Typography>
                        )}
                        {columnMapping.price && (
                            <Typography variant="body2">Price: {columnMapping.price}</Typography>
                        )}
                        {columnMapping.notes && (
                            <Typography variant="body2">Notes: {columnMapping.notes}</Typography>
                        )}
                        {columnMapping.hsCode && (
                            <Typography variant="body2">HS Code: {columnMapping.hsCode}</Typography>
                        )}
                        {columnMapping.englishDescription && (
                            <Typography variant="body2">English Description: {columnMapping.englishDescription}</Typography>
                        )}
                    </Box>
                );
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Upload Supplier Response</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {renderStepContent(activeStep)}

                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                        {errorSuggestion && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Suggestion: {errorSuggestion}
                            </Typography>
                        )}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={uploading}>
                    Cancel
                </Button>
                {activeStep > 0 && (
                    <Button onClick={handleBack} disabled={uploading}>
                        Back
                    </Button>
                )}
                {activeStep < steps.length - 1 ? (
                    <Button onClick={handleNext} variant="contained" disabled={uploading || loading}>
                        Next
                    </Button>
                ) : (
                    <Button
                        onClick={handleUpload}
                        variant="contained"
                        disabled={uploading || loading || !inquiryId}
                        startIcon={uploading ? <CircularProgress size={20} /> : null}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default SupplierResponseUpload;
