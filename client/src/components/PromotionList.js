import React, { useState } from 'react';
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
    Chip,
    Alert,
    Snackbar,
    CircularProgress
} from '@mui/material';
import { format } from 'date-fns';
import { usePromotionManagement } from '../hooks/usePromotionManagement';
import { PromotionUploadDialog, PromotionDetailsDialog } from './PromotionDialogs';
import PromotionColumnMappingDialog from './PromotionColumnMappingDialog';

function PromotionList() {
    const {
        promotions,
        suppliers,
        loading,
        loadingSuppliers,
        error,
        uploadProgress,
        processingStatus,
        setError,
        handleUpload,
        handleUpdatePromotion,
        getPromotionDetails
    } = usePromotionManagement();

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [columnMappingOpen, setColumnMappingOpen] = useState(false);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [promotionDetails, setPromotionDetails] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [columns, setColumns] = useState([]);
    const [uploadFile, setUploadFile] = useState(null);
    const [promotionMetadata, setPromotionMetadata] = useState(null);

    const handleFileUpload = (file, detectedColumns, metadata) => {
        setUploadFile(file);
        setColumns(detectedColumns || []);
        setPromotionMetadata(metadata);
        setColumnMappingOpen(true);
        setUploadDialogOpen(false);
    };

    const handleColumnMappingConfirm = async (columnMapping) => {
        const formData = new FormData();
        formData.append('excelFile', uploadFile);
        formData.append('itemIdColumn', columnMapping.itemId);
        formData.append('priceColumn', columnMapping.price);
        
        // Add promotion metadata
        if (promotionMetadata) {
            formData.append('name', promotionMetadata.name);
            formData.append('supplierId', promotionMetadata.supplierId);
            formData.append('startDate', promotionMetadata.startDate);
            formData.append('endDate', promotionMetadata.endDate);
        }

        const success = await handleUpload(formData);
        if (success) {
            setColumnMappingOpen(false);
            setUploadFile(null);
            setColumns([]);
            setPromotionMetadata(null);
        }
    };

    const handleViewDetails = async (groupId, page = 1) => {
        setLoadingDetails(true);
        const details = await getPromotionDetails(groupId, page);
        if (details) {
            setPromotionDetails(details);
            setCurrentPage(page);
            setDetailsDialogOpen(true);
        }
        setLoadingDetails(false);
    };

    const handlePageChange = (event, page) => {
        if (promotionDetails) {
            handleViewDetails(promotionDetails.PromotionGroupID, page);
        }
    };

    const handleCloseDetailsDialog = () => {
        setDetailsDialogOpen(false);
        setPromotionDetails(null);
        setCurrentPage(1);
    };

    const renderContent = () => {
        if (loading && !uploadDialogOpen && !columnMappingOpen) {
            return (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                    <CircularProgress />
                </Box>
            );
        }

        if (!Array.isArray(promotions) || promotions.length === 0) {
            return (
                <TableRow>
                    <TableCell colSpan={7} align="center">
                        No promotions found
                    </TableCell>
                </TableRow>
            );
        }

        return promotions.map((promotion) => (
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
        ));
    };

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
                        {renderContent()}
                    </TableBody>
                </Table>
            </TableContainer>

            <PromotionUploadDialog
                open={uploadDialogOpen}
                onClose={() => setUploadDialogOpen(false)}
                onUpload={handleFileUpload}
                suppliers={suppliers || []}
                loading={loading}
                loadingSuppliers={loadingSuppliers}
                uploadProgress={uploadProgress}
                processingStatus={processingStatus}
                setError={setError}
            />

            <PromotionColumnMappingDialog
                open={columnMappingOpen}
                onClose={() => setColumnMappingOpen(false)}
                excelColumns={columns}
                onConfirm={handleColumnMappingConfirm}
            />

            <PromotionDetailsDialog
                open={detailsDialogOpen}
                onClose={handleCloseDetailsDialog}
                promotionDetails={promotionDetails}
                loading={loadingDetails}
                currentPage={currentPage}
                onPageChange={handlePageChange}
            />
        </Box>
    );
}

export default PromotionList;
