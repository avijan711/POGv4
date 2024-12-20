import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    CircularProgress,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import PriceHistoryTable from './PriceHistoryTable';

function SupplierPriceHistoryDialog({ open, onClose, itemId, supplierId, supplierName }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [priceHistory, setPriceHistory] = useState([]);

    useEffect(() => {
        if (open && itemId && supplierId) {
            setLoading(true);
            setError(null);
            
            axios.get(`${API_BASE_URL}/api/prices/history/${itemId}/${supplierId}`)
                .then(response => {
                    // If there's no data, show at least one row with current data
                    if (!response.data.length) {
                        setPriceHistory([{
                            date: new Date().toISOString(),
                            retailPrice: null,
                            stock: null,
                            soldThisYear: null,
                            soldLastYear: null,
                            supplier_name: supplierName,
                            promotion_name: null
                        }]);
                        return;
                    }

                    // Transform the data to match PriceHistoryTable format
                    const formattedHistory = response.data.map(record => ({
                        date: record.date,
                        retailPrice: record.price, // Use price as retail price since it's supplier specific
                        stock: record.qty_in_stock || '—',
                        soldThisYear: record.sold_this_year || '—',
                        soldLastYear: record.sold_last_year || '—',
                        supplier_name: record.supplier_name || supplierName,
                        promotion_name: record.source_name || null
                    }));
                    setPriceHistory(formattedHistory);
                })
                .catch(err => {
                    console.error('Error fetching supplier price history:', err);
                    setError('Failed to load price history');
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open, itemId, supplierId, supplierName]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Typography variant="h6">
                    Price History - {supplierName}
                </Typography>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <PriceHistoryTable
                        data={priceHistory}
                        loading={loading}
                        error={error}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

export default SupplierPriceHistoryDialog;
