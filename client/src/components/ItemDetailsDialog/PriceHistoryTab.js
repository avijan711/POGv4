import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { usePriceHistory } from '../../hooks/usePriceHistory';
import PriceHistoryTable from '../PriceHistoryTable';

function PriceHistoryTab({ itemId, suppliers }) {
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [dateRange, setDateRange] = useState({
        start: null,
        end: null
    });
    const [priceHistory, setPriceHistory] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(null);
    const { loading, error, getPriceHistory, getCurrentPrice } = usePriceHistory();

    useEffect(() => {
        if (selectedSupplier && itemId) {
            loadPriceData();
        }
    }, [selectedSupplier, itemId]);

    const loadPriceData = async () => {
        try {
            // Get current price
            const price = await getCurrentPrice(itemId, selectedSupplier);
            setCurrentPrice(price);

            // Get price history with date range if set
            const range = dateRange.start && dateRange.end ? {
                start: dateRange.start.toISOString().split('T')[0],
                end: dateRange.end.toISOString().split('T')[0]
            } : null;

            const history = await getPriceHistory(itemId, selectedSupplier, range);
            setPriceHistory(history);
        } catch (error) {
            console.error('Error loading price data:', error);
        }
    };

    const handleSupplierChange = (event) => {
        setSelectedSupplier(event.target.value);
    };

    const handleDateChange = (field) => (newValue) => {
        setDateRange(prev => ({
            ...prev,
            [field]: newValue
        }));
    };

    const handleApplyFilter = () => {
        if (selectedSupplier && itemId) {
            loadPriceData();
        }
    };

    const handleClearFilter = () => {
        setDateRange({
            start: null,
            end: null
        });
        if (selectedSupplier && itemId) {
            loadPriceData();
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            {/* Filters */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                        <InputLabel>Supplier</InputLabel>
                        <Select
                            value={selectedSupplier}
                            onChange={handleSupplierChange}
                            label="Supplier"
                        >
                            {suppliers.map(supplier => (
                                <MenuItem key={supplier.supplier_id} value={supplier.supplier_id}>
                                    {supplier.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                    <DatePicker
                        label="Start Date"
                        value={dateRange.start}
                        onChange={handleDateChange('start')}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                </Grid>
                <Grid item xs={12} md={3}>
                    <DatePicker
                        label="End Date"
                        value={dateRange.end}
                        onChange={handleDateChange('end')}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                </Grid>
                <Grid item xs={12} md={2}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            onClick={handleApplyFilter}
                            disabled={!selectedSupplier}
                        >
                            Apply
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={handleClearFilter}
                            disabled={!selectedSupplier}
                        >
                            Clear
                        </Button>
                    </Box>
                </Grid>
            </Grid>

            {/* Current Price Card */}
            {currentPrice && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Current Price
                                </Typography>
                                <Typography variant="h4">
                                    ₪{Number(currentPrice.current_price).toFixed(2)}
                                </Typography>
                                {currentPrice.is_promotion && (
                                    <Typography variant="body2" color="secondary">
                                        Promotion: {currentPrice.promotion_name}
                                        {currentPrice.promotion_end_date && 
                                            ` (until ${new Date(currentPrice.promotion_end_date).toLocaleDateString()})`}
                                    </Typography>
                                )}
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" color="textSecondary">
                                    Last Updated
                                </Typography>
                                <Typography variant="body1">
                                    {new Date(currentPrice.last_updated).toLocaleString()}
                                </Typography>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Price History Table */}
            <Typography variant="h6" gutterBottom>
                Price History
            </Typography>
            <PriceHistoryTable
                data={priceHistory}
                loading={loading}
                error={error}
            />
        </Box>
    );
}

export default PriceHistoryTab;
