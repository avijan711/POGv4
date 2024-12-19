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
    IconButton,
    Chip,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import PromotionUploadDialog from './PromotionUploadDialog';
import PromotionItemsDialog from './PromotionItemsDialog';

function PromotionList() {
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedPromotion, setSelectedPromotion] = useState(null);
    const [itemsDialogOpen, setItemsDialogOpen] = useState(false);

    useEffect(() => {
        fetchPromotions();
    }, []);

    const fetchPromotions = async () => {
        try {
            setLoading(true);
            setError(null);
            // Use the /api/promotions endpoint instead of /api/promotions/active
            const response = await axios.get(`${API_BASE_URL}/api/promotions`);
            if (response.data?.success) {
                setPromotions(response.data.data || []);
            } else {
                throw new Error(response.data?.message || 'Failed to load promotions');
            }
        } catch (err) {
            console.error('Error fetching promotions:', err);
            const errorMessage = err.response?.data?.message || 'Failed to load promotions';
            const suggestion = err.response?.data?.suggestion;
            setError(suggestion ? `${errorMessage} - ${suggestion}` : errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (promotionId) => {
        if (!window.confirm('Are you sure you want to delete this promotion?')) {
            return;
        }

        try {
            const response = await axios.delete(`${API_BASE_URL}/api/promotions/${promotionId}`);
            if (response.data?.success) {
                await fetchPromotions();
            } else {
                throw new Error(response.data?.message || 'Failed to delete promotion');
            }
        } catch (err) {
            console.error('Error deleting promotion:', err);
            const errorMessage = err.response?.data?.message || 'Failed to delete promotion';
            const suggestion = err.response?.data?.suggestion;
            setError(suggestion ? `${errorMessage} - ${suggestion}` : errorMessage);
        }
    };

    const handleUploadComplete = () => {
        setUploadDialogOpen(false);
        fetchPromotions();
    };

    const handleViewItems = (promotion) => {
        setSelectedPromotion(promotion);
        setItemsDialogOpen(true);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">Promotions</Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setUploadDialogOpen(true)}
                >
                    Upload New Promotion
                </Button>
            </Box>

            {loading ? (
                <Typography>Loading promotions...</Typography>
            ) : error ? (
                <Box>
                    <Typography color="error">{error}</Typography>
                    <Button 
                        sx={{ mt: 2 }}
                        variant="outlined" 
                        onClick={fetchPromotions}
                    >
                        Retry
                    </Button>
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Supplier</TableCell>
                                <TableCell>Start Date</TableCell>
                                <TableCell>End Date</TableCell>
                                <TableCell align="right">Items</TableCell>
                                <TableCell align="right">Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {promotions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">
                                        <Typography color="textSecondary">
                                            No promotions found
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                promotions.map((promotion) => (
                                    <TableRow key={promotion.promotion_id}>
                                        <TableCell>{promotion.name}</TableCell>
                                        <TableCell>{promotion.supplier_name}</TableCell>
                                        <TableCell>
                                            {new Date(promotion.start_date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(promotion.end_date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Chip
                                                label={`${promotion.item_count} items`}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Chip
                                                label={isPromotionActive(promotion) ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={isPromotionActive(promotion) ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleViewItems(promotion)}
                                                title="View Items"
                                            >
                                                <VisibilityIcon />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDelete(promotion.promotion_id)}
                                                title="Delete Promotion"
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <PromotionUploadDialog
                open={uploadDialogOpen}
                onClose={() => setUploadDialogOpen(false)}
                onComplete={handleUploadComplete}
            />

            <PromotionItemsDialog
                open={itemsDialogOpen}
                onClose={() => {
                    setItemsDialogOpen(false);
                    setSelectedPromotion(null);
                }}
                promotion={selectedPromotion}
            />
        </Box>
    );
}

function isPromotionActive(promotion) {
    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);
    return now >= startDate && now <= endDate;
}

export default PromotionList;
