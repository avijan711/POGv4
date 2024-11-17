import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress,
    Alert,
    Snackbar,
    Pagination,
    Chip
} from '@mui/material';
import { format } from 'date-fns';
import { API_BASE_URL } from '../config';
import { uiDebug, dataDebug, perfDebug } from '../utils/debug';

const PromotionList = () => {
    const [promotions, setPromotions] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [columnSelectionOpen, setColumnSelectionOpen] = useState(false);
    const [newPromotion, setNewPromotion] = useState({
        name: '',
        startDate: '',
        endDate: '',
        supplierId: '',
        file: null
    });
    const [columns, setColumns] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState({
        itemId: '',
        price: ''
    });
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [promotionDetails, setPromotionDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(100);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        uiDebug.log('PromotionList component mounted');
        fetchPromotions();
        fetchSuppliers();
    }, []);

    const fetchPromotions = async () => {
        perfDebug.time('fetchPromotions');
        try {
            setLoading(true);
            setError(null);
            dataDebug.log('Fetching promotions...');
            
            const response = await fetch(`${API_BASE_URL}/api/promotions/active`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch promotions');
            }
            const data = await response.json();
            dataDebug.log('Fetched promotions:', data.length);
            setPromotions(data);
        } catch (error) {
            dataDebug.error('Error fetching promotions:', error);
            setError(error.message);
            setPromotions([]);
        } finally {
            perfDebug.timeEnd('fetchPromotions');
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        perfDebug.time('fetchSuppliers');
        try {
            dataDebug.log('Fetching suppliers...');
            setLoadingSuppliers(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/api/suppliers`);
            dataDebug.log('Suppliers API response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch suppliers');
            }
            
            const data = await response.json();
            dataDebug.log('Fetched suppliers count:', data.length);
            
            if (!data || data.length === 0) {
                dataDebug.warn('No suppliers found');
                setError('No suppliers found. Please add suppliers before creating promotions.');
            }
            
            setSuppliers(data);
        } catch (error) {
            dataDebug.error('Error fetching suppliers:', error);
            setError(error.message);
            setSuppliers([]);
        } finally {
            perfDebug.timeEnd('fetchSuppliers');
            setLoadingSuppliers(false);
        }
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setNewPromotion(prev => ({ ...prev, file }));
            setLoading(true);
            setError(null);
            
            const formData = new FormData();
            formData.append('excelFile', file);

            try {
                dataDebug.log('Uploading file for column detection:', file.name);
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
                setColumns(data.columns);
                setColumnSelectionOpen(true);
                setUploadDialogOpen(false);
                
                perfDebug.timeEnd('columnDetection');
            } catch (error) {
                dataDebug.error('Error reading Excel columns:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedColumns.itemId || !selectedColumns.price) {
            setError('Please select both Item ID and Price columns');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            perfDebug.time('uploadPromotion');

            const formData = new FormData();
            formData.append('name', newPromotion.name);
            formData.append('startDate', new Date(newPromotion.startDate).toISOString());
            formData.append('endDate', new Date(newPromotion.endDate).toISOString());
            formData.append('supplierId', newPromotion.supplierId);
            formData.append('excelFile', newPromotion.file);
            formData.append('itemIdColumn', selectedColumns.itemId);
            formData.append('priceColumn', selectedColumns.price);

            dataDebug.log('Creating promotion:', { name: newPromotion.name });
            const response = await fetch(`${API_BASE_URL}/api/promotions`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create promotion');
            }

            dataDebug.log('Promotion created successfully');
            setUploadDialogOpen(false);
            setColumnSelectionOpen(false);
            setNewPromotion({
                name: '',
                startDate: '',
                endDate: '',
                supplierId: '',
                file: null
            });
            setSelectedColumns({
                itemId: '',
                price: ''
            });
            
            perfDebug.timeEnd('uploadPromotion');
            fetchPromotions();
        } catch (error) {
            dataDebug.error('Error creating promotion:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (groupId, page = 1) => {
        try {
            setLoadingDetails(true);
            setError(null);
            perfDebug.time('viewPromotionDetails');

            dataDebug.log('Fetching promotion details:', { groupId, page });
            const response = await fetch(`${API_BASE_URL}/api/promotions/${groupId}?page=${page}&pageSize=${pageSize}`);
            
            if (response.status === 404) {
                throw new Error('Promotion not found. It may have been deleted.');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch promotion details');
            }

            const details = await response.json();
            dataDebug.log('Fetched promotion details:', { 
                name: details.Name, 
                itemCount: details.items?.length 
            });
            
            setPromotionDetails(details);
            setCurrentPage(page);
            setDetailsDialogOpen(true);
            
            perfDebug.timeEnd('viewPromotionDetails');
        } catch (error) {
            dataDebug.error('Error fetching promotion details:', error);
            setError(error.message);
            setDetailsDialogOpen(false);
            fetchPromotions();
        } finally {
            setLoadingDetails(false);
        }
    };

    const handlePageChange = (event, page) => {
        if (promotionDetails) {
            handleViewDetails(promotionDetails.PromotionGroupID, page);
        }
    };

    const handleUpdatePromotion = async (groupId, isActive) => {
        try {
            setLoading(true);
            setError(null);
            perfDebug.time('updatePromotion');

            const promotion = promotions.find(p => p.PromotionGroupID === groupId);
            dataDebug.log('Updating promotion:', { groupId, isActive });
            
            const response = await fetch(`${API_BASE_URL}/api/promotions/${groupId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: promotion.Name,
                    startDate: promotion.StartDate,
                    endDate: promotion.EndDate,
                    isActive
                })
            });

            if (response.status === 404) {
                throw new Error('Promotion not found. It may have been deleted.');
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update promotion');
            }

            dataDebug.log('Promotion updated successfully');
            perfDebug.timeEnd('updatePromotion');
            fetchPromotions();
        } catch (error) {
            dataDebug.error('Error updating promotion:', error);
            setError(error.message);
            fetchPromotions();
        } finally {
            setLoading(false);
        }
    };

    const handleCloseDetailsDialog = () => {
        uiDebug.log('Closing promotion details dialog');
        setDetailsDialogOpen(false);
        setPromotionDetails(null);
        setCurrentPage(1);
    };

    // Rest of the component remains the same...
    return (
        <Box>
            <Snackbar 
                open={!!error} 
                autoHideDuration={6000} 
                onClose={() => setError(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Promotions</Typography>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setUploadDialogOpen(true)}
                    disabled={loading}
                >
                    Upload New Promotion
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell>Start Date</TableCell>
                            <TableCell>End Date</TableCell>
                            <TableCell>Items</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {promotions.map((promotion) => (
                            <TableRow key={promotion.PromotionGroupID}>
                                <TableCell>{promotion.Name}</TableCell>
                                <TableCell>
                                    <Chip 
                                        label={promotion.SupplierName} 
                                        color="primary" 
                                        variant="outlined" 
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>{format(new Date(promotion.StartDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{format(new Date(promotion.EndDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{promotion.ItemCount}</TableCell>
                                <TableCell>{promotion.IsActive ? 'Active' : 'Inactive'}</TableCell>
                                <TableCell>
                                    <Button
                                        size="small"
                                        onClick={() => handleViewDetails(promotion.PromotionGroupID)}
                                        disabled={loading}
                                    >
                                        View Details
                                    </Button>
                                    <Button
                                        size="small"
                                        color={promotion.IsActive ? 'error' : 'primary'}
                                        onClick={() => handleUpdatePromotion(promotion.PromotionGroupID, !promotion.IsActive)}
                                        disabled={loading}
                                    >
                                        {promotion.IsActive ? 'Deactivate' : 'Activate'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!loading && promotions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    No promotions found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Upload Dialog */}
            <Dialog 
                open={uploadDialogOpen} 
                onClose={() => !loading && setUploadDialogOpen(false)}
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
                        {(loading || loadingSuppliers) && (
                            <Box display="flex" justifyContent="center" mt={2}>
                                <CircularProgress />
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUploadDialogOpen(false)} disabled={loading}>Cancel</Button>
                    <Button 
                        onClick={() => {
                            if (!newPromotion.file) {
                                setError('Please select an Excel file');
                                return;
                            }
                            if (!newPromotion.name || !newPromotion.startDate || !newPromotion.endDate || !newPromotion.supplierId) {
                                setError('Please fill in all fields');
                                return;
                            }
                            handleFileChange({ target: { files: [newPromotion.file] } });
                        }} 
                        variant="contained" 
                        color="primary"
                        disabled={loading || loadingSuppliers || suppliers.length === 0}
                    >
                        Next
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Column Selection Dialog */}
            <Dialog 
                open={columnSelectionOpen} 
                onClose={() => !loading && setColumnSelectionOpen(false)}
            >
                <DialogTitle>Select Excel Columns</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Item ID Column</InputLabel>
                            <Select
                                value={selectedColumns.itemId}
                                onChange={(e) => setSelectedColumns({ ...selectedColumns, itemId: e.target.value })}
                                label="Item ID Column"
                                disabled={loading}
                            >
                                {columns.map((column, index) => (
                                    <MenuItem key={`itemId-${index}-${column}`} value={column}>
                                        {column}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Price Column (EUR)</InputLabel>
                            <Select
                                value={selectedColumns.price}
                                onChange={(e) => setSelectedColumns({ ...selectedColumns, price: e.target.value })}
                                label="Price Column (EUR)"
                                disabled={loading}
                            >
                                {columns.map((column, index) => (
                                    <MenuItem key={`price-${index}-${column}`} value={column}>
                                        {column}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setColumnSelectionOpen(false)} disabled={loading}>Cancel</Button>
                    <Button onClick={handleUpload} variant="contained" color="primary" disabled={loading}>
                        Upload
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Details Dialog */}
            <Dialog
                open={detailsDialogOpen}
                onClose={handleCloseDetailsDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" gap={1}>
                        {promotionDetails?.Name || 'Promotion Details'}
                        {promotionDetails?.SupplierName && (
                            <Chip 
                                label={`Supplier: ${promotionDetails.SupplierName}`}
                                color="primary"
                                sx={{ ml: 2 }}
                            />
                        )}
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {loadingDetails ? (
                        <Box display="flex" justifyContent="center" mt={2}>
                            <CircularProgress />
                        </Box>
                    ) : promotionDetails && (
                        <Box>
                            <Box sx={{ 
                                display: 'flex', 
                                gap: 2, 
                                mb: 2, 
                                p: 2, 
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider'
                            }}>
                                <Typography variant="body2">
                                    Start Date: {format(new Date(promotionDetails.StartDate), 'dd/MM/yyyy')}
                                </Typography>
                                <Typography variant="body2">
                                    End Date: {format(new Date(promotionDetails.EndDate), 'dd/MM/yyyy')}
                                </Typography>
                                <Typography variant="body2">
                                    Total Items: {promotionDetails.totalItems}
                                </Typography>
                            </Box>
                            <TableContainer component={Paper} sx={{ mt: 2 }}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Item ID</TableCell>
                                            <TableCell>Promo Price (EUR)</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {promotionDetails.items.map((item) => (
                                            <TableRow key={item.ItemID}>
                                                <TableCell>{item.ItemID}</TableCell>
                                                <TableCell>€{item.PromoPrice.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {promotionDetails.items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} align="center">
                                                    No items found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {promotionDetails.totalPages > 1 && (
                                <Box display="flex" justifyContent="center" mt={2}>
                                    <Pagination
                                        count={promotionDetails.totalPages}
                                        page={currentPage}
                                        onChange={handlePageChange}
                                        disabled={loadingDetails}
                                    />
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDetailsDialog}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PromotionList;
