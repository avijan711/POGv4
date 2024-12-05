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

            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(`${API_BASE_URL}/api/promotions/columns`, formData);
            setColumns(response.data.columns || []);

            // Try to auto-map columns
            const autoMapping = {};
            response.data.columns.forEach(column => {
                const lowerColumn = column.toLowerCase();
                if (lowerColumn.includes('item') || lowerColumn.includes('id') || lowerColumn.includes('sku')) {
                    autoMapping.item_id = column;
                }
                if (lowerColumn.includes('price') || lowerColumn.includes('cost')) {
                    autoMapping.price = column;
                }
            });
            setMapping(autoMapping);

        } catch (err) {
            console.error('Error fetching columns:', err);
            setError('Failed to read Excel columns');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!validateMapping()) return;

        try {
            setLoading(true);
            setError('');

            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', promotionData.name);
            formData.append('supplier_id', promotionData.supplier);
            formData.append('start_date', promotionData.startDate);
            formData.append('end_date', promotionData.endDate);
            formData.append('column_mapping', JSON.stringify(mapping));

            await axios.post(`${API_BASE_URL}/api/promotions/upload`, formData);
            onComplete();
        } catch (err) {
            console.error('Error uploading promotion:', err);
            setError(err.response?.data?.message || 'Failed to upload promotion');
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
                        <Typography>Reading Excel columns...</Typography>
                    ) : error ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
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
