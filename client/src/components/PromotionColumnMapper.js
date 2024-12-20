import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    Alert,
    Grid,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const REQUIRED_COLUMNS = [
    { key: 'item_id', label: 'Item ID', description: 'Unique identifier for the item' },
    { key: 'price', label: 'Price', description: 'Promotion price for the item' }
];

function PromotionColumnMapper({ 
    open, 
    onClose, 
    onComplete, 
    file,
    promotionData 
}) {
    const [columns, setColumns] = useState([]);
    const [mapping, setMapping] = useState({});
    const [error, setError] = useState('');
    const [errorDetails, setErrorDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && file) {
            fetchColumns();
        }
    }, [open, file]);

    const fetchColumns = async () => {
        try {
            setLoading(true);
            setError('');
            setErrorDetails(null);

            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(`${API_BASE_URL}/api/promotions/columns`, formData);
            if (response.data?.success) {
                setColumns(response.data.data.columns || []);

                // Try to auto-map columns
                const autoMapping = {};
                response.data.data.columns.forEach(column => {
                    const lowerColumn = column.toLowerCase();
                    if (lowerColumn.includes('item') || lowerColumn.includes('id') || lowerColumn.includes('sku')) {
                        autoMapping.item_id = column;
                    }
                    if (lowerColumn.includes('price') || lowerColumn.includes('cost')) {
                        autoMapping.price = column;
                    }
                });
                setMapping(autoMapping);
            } else {
                throw new Error(response.data?.message || 'Failed to read Excel columns');
            }
        } catch (err) {
            console.error('Error fetching columns:', err);
            setError(err.response?.data?.message || 'Failed to read Excel columns');
            if (err.response?.data?.suggestion) {
                setErrorDetails([err.response.data.suggestion]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!validateMapping()) return;

        try {
            setLoading(true);
            setError('');
            setErrorDetails(null);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', promotionData.name);
            formData.append('supplier_id', promotionData.supplier);
            formData.append('start_date', promotionData.startDate);
            formData.append('end_date', promotionData.endDate);
            formData.append('column_mapping', JSON.stringify(mapping));

            const response = await axios.post(`${API_BASE_URL}/api/promotions/upload`, formData);
            
            if (response.data?.success) {
                onComplete();
            } else {
                throw new Error(response.data?.message || 'Failed to upload promotion');
            }
        } catch (err) {
            console.error('Error uploading promotion:', err);
            
            const errorResponse = err.response?.data;
            setError(errorResponse?.message || 'Failed to upload promotion');
            
            // Handle detailed error information
            if (errorResponse?.code === 'INVALID_ITEMS_ERROR' && errorResponse?.details?.invalidItems) {
                setErrorDetails([
                    'The following items do not exist in the system:',
                    ...errorResponse.details.invalidItems
                ]);
            } else if (errorResponse?.suggestion) {
                setErrorDetails([errorResponse.suggestion]);
            }
        } finally {
            setLoading(false);
        }
    };

    const validateMapping = () => {
        const missingColumns = REQUIRED_COLUMNS.filter(col => !mapping[col.key]);
        if (missingColumns.length > 0) {
            setError(`Please map the following columns: ${missingColumns.map(c => c.label).join(', ')}`);
            return false;
        }
        return true;
    };

    const handleClose = () => {
        setColumns([]);
        setMapping({});
        setError('');
        setErrorDetails(null);
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>Map Excel Columns</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    {loading ? (
                        <Typography>
                            {columns.length ? 'Uploading promotion...' : 'Reading Excel columns...'}
                        </Typography>
                    ) : error ? (
                        <Alert 
                            severity="error" 
                            sx={{ mb: 2 }}
                            action={
                                <Button 
                                    color="inherit" 
                                    size="small" 
                                    onClick={fetchColumns}
                                >
                                    Retry
                                </Button>
                            }
                        >
                            {error}
                            {errorDetails && (
                                <List dense sx={{ mt: 1, mb: 0 }}>
                                    {errorDetails.map((detail, index) => (
                                        <ListItem key={index} sx={{ py: 0 }}>
                                            <ListItemText 
                                                primary={detail}
                                                primaryTypographyProps={{
                                                    variant: 'body2'
                                                }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </Alert>
                    ) : (
                        <>
                            <Typography gutterBottom>
                                Please map the Excel columns to the required fields:
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                {REQUIRED_COLUMNS.map(({ key, label, description }) => (
                                    <Grid item xs={12} key={key}>
                                        <FormControl fullWidth>
                                            <InputLabel>{label}</InputLabel>
                                            <Select
                                                value={mapping[key] || ''}
                                                onChange={(e) => setMapping(prev => ({
                                                    ...prev,
                                                    [key]: e.target.value
                                                }))}
                                                label={label}
                                            >
                                                <MenuItem value="">
                                                    <em>Select column</em>
                                                </MenuItem>
                                                {columns.map((column) => (
                                                    <MenuItem 
                                                        key={column} 
                                                        value={column}
                                                        disabled={Object.values(mapping).includes(column) && mapping[key] !== column}
                                                    >
                                                        {column}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {description}
                                            </Typography>
                                        </FormControl>
                                    </Grid>
                                ))}
                            </Grid>
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || !columns.length}
                >
                    {loading ? 'Uploading...' : 'Upload'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default PromotionColumnMapper;
