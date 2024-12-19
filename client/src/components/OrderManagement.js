import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    LinearProgress,
    Alert,
    Tabs,
    Tab,
    IconButton,
    Tooltip
} from '@mui/material';
import { 
    Visibility as VisibilityIcon,
    Edit as EditIcon 
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import OrderFulfillment from './OrderFulfillment';

function TabPanel({ children, value, index }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`order-tabpanel-${index}`}
            aria-labelledby={`order-tab-${index}`}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function OrderManagement() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`${API_BASE_URL}/api/orders`);
            setOrders(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleOrderSelect = (order) => {
        setSelectedOrder(order);
        setActiveTab(0);
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    if (loading) {
        return <LinearProgress />;
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>
                Order Management
            </Typography>

            {selectedOrder ? (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Button 
                            onClick={() => setSelectedOrder(null)}
                            sx={{ mb: 2 }}
                        >
                            Back to Orders
                        </Button>
                        <Typography variant="h6">
                            Order #{selectedOrder.order_id} - {selectedOrder.supplier_name}
                        </Typography>
                        <Tabs value={activeTab} onChange={handleTabChange}>
                            <Tab label="Details" />
                            <Tab label="Fulfillment" />
                        </Tabs>
                    </Box>

                    <TabPanel value={activeTab} index={0}>
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item ID</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell align="right">Quantity</TableCell>
                                        <TableCell align="right">Price</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {selectedOrder.Items.map((item) => (
                                        <TableRow key={item.order_item_id}>
                                            <TableCell>{item.item_id}</TableCell>
                                            <TableCell>{item.description || '-'}</TableCell>
                                            <TableCell align="right">{item.quantity}</TableCell>
                                            <TableCell align="right">
                                                ${item.price_quoted.toFixed(2)}
                                            </TableCell>
                                            <TableCell>{item.status || 'Pending'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </TabPanel>

                    <TabPanel value={activeTab} index={1}>
                        <OrderFulfillment orderId={selectedOrder.order_id} />
                    </TabPanel>
                </>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Order ID</TableCell>
                                <TableCell>Supplier</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.order_id}>
                                    <TableCell>{order.order_id}</TableCell>
                                    <TableCell>{order.supplier_name}</TableCell>
                                    <TableCell>
                                        {new Date(order.order_date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>{order.status}</TableCell>
                                    <TableCell align="right">
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                            <Tooltip title="View Details">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOrderSelect(order)}
                                                >
                                                    <VisibilityIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit Order">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOrderSelect(order)}
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}

export default OrderManagement;
