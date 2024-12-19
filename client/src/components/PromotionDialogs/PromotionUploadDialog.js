import React, { useState } from 'react';
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
    Typography,
    Box,
    CircularProgress,
    LinearProgress
} from '@mui/material';
import { API_BASE_URL } from '../../config';
import { dataDebug, perfDebug } from '../../utils/debug';

function PromotionUploadDialog({ 
    open, 
    onClose, 
    onUpload, 
    suppliers, 
    loading, 
    loadingSuppliers,
    uploadProgress,
    processingStatus,
    setError 
}) {
    const [newPromotion, setNewPromotion] = useState({
        name: '',
        startDate: '',
        endDate: '',
        supplierId: '',
        file: null
    });

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setNewPromotion(prev => ({ ...prev, file }));
        }
    };

    const handleNext = async () => {
        if (!newPromotion.file) {
            setError('Please select an Excel file');
            return;
        }
        if (!newPromotion.name || !newPromotion.startDate || !newPromotion.endDate || !newPromotion.supplierId) {
            setError('Please fill in all fields');
            return;
        }

        const formData = new FormData();
        formData.append('excelFile', newPromotion.file);
        formData.append('name', newPromotion.name);
        formData.append('supplierId', newPromotion.supplierId);
        formData.append('startDate', newPromotion.startDate);
        formData.append('endDate', newPromotion.endDate);

        try {
            dataDebug.log('Uploading file for column detection:', newPromotion.file.name);
            perfDebug.time('columnDetection');
            
            const response = await fetch(`${API_BASE_URL}/api/promotions/columns`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to read Excel columns');
            }

            const data = await response.json();
            dataDebug.log('Detected columns:', data.columns);
            
            perfDebug.timeEnd('columnDetection');
            onUpload(newPromotion.file, data.columns, {
                name: newPromotion.name,
                supplierId: newPromotion.supplierId,
                startDate: newPromotion.startDate,
                endDate: newPromotion.endDate
            });
        } catch (error) {
            dataDebug.error('Error reading Excel columns:', error);
            setError(error.message);
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={() => !loading && onClose()}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Upload New Promotion</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <TextField
                        fullWidth
                        label="Promotion Name"
                        value={newPromotion.name}
                        onChange={(e) => setNewPromotion({ ...newPromotion, name: e.target.value })}
                        sx={{ mb: 2 }}
                        disabled={loading}
                    />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Supplier</InputLabel>
                        <Select
                            value={newPromotion.supplierId}
                            onChange={(e) => setNewPromotion({ ...newPromotion, supplierId: e.target.value })}
                            label="Supplier"
                            disabled={loading || loadingSuppliers}
                            error={!loadingSuppliers && suppliers.length === 0}
                        >
                            {loadingSuppliers ? (
                                <MenuItem disabled value="">
                                    Loading suppliers...
                                </MenuItem>
                            ) : suppliers.length === 0 ? (
                                <MenuItem disabled value="">
                                    No suppliers available
                                </MenuItem>
                            ) : (
                                suppliers.map((supplier) => (
                                    <MenuItem key={supplier.SupplierID} value={supplier.SupplierID}>
                                        {supplier.Name}
                                    </MenuItem>
                                ))
                            )}
                        </Select>
                        {!loadingSuppliers && suppliers.length === 0 && (
                            <Typography color="error" variant="caption" sx={{ mt: 1 }}>
                                Please add suppliers before creating promotions
                            </Typography>
                        )}
                    </FormControl>
                    <TextField
                        fullWidth
                        label="Start Date"
                        type="date"
                        value={newPromotion.startDate}
                        onChange={(e) => setNewPromotion({ ...newPromotion, startDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 2 }}
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label="End Date"
                        type="date"
                        value={newPromotion.endDate}
                        onChange={(e) => setNewPromotion({ ...newPromotion, endDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 2 }}
                        disabled={loading}
                    />
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                        Upload Excel file with promotion prices in EUR
                    </Typography>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        style={{ marginTop: '1rem' }}
                        disabled={loading}
                    />
                    {loading && (
                        <Box sx={{ mt: 2 }}>
                            <LinearProgress 
                                variant="determinate" 
                                value={uploadProgress} 
                                sx={{ mb: 1 }}
                            />
                            <Typography variant="body2" color="textSecondary" align="center">
                                {processingStatus}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button 
                    onClick={handleNext}
                    variant="contained" 
                    color="primary"
                    disabled={loading || loadingSuppliers || suppliers.length === 0}
                >
                    {loading ? <CircularProgress size={24} /> : 'Next'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default PromotionUploadDialog;
