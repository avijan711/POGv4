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
    IconButton,
    Collapse,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    KeyboardArrowDown as KeyboardArrowDownIcon,
    KeyboardArrowUp as KeyboardArrowUpIcon,
} from '@mui/icons-material';
import { formatDate } from '../utils/dateUtils';
import { API_BASE_URL } from '../config';

// Row component for each order
function OrderRow({ order, onStatusChange }) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState(order.Status);

    const handleStatusChange = (event) => {
        const newStatus = event.target.value;
        setStatus(newStatus);
        onStatusChange(order.OrderID, newStatus);
    };

    const totalItems = order.Items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = order.Items.reduce(
        (sum, item) => sum + item.quantity * item.priceQuoted,
        0
    ).toFixed(2);

    return (
        <>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                <TableCell>
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => setOpen(!open)}
                    >
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell>{order.OrderID}</TableCell>
                <TableCell>{order.SupplierName}</TableCell>
                <TableCell>{formatDate(order.OrderDate)}</TableCell>
                <TableCell>{totalItems}</TableCell>
                <TableCell>${totalValue}</TableCell>
                <TableCell>
                    <FormControl size="small">
                        <Select
                            value={status}
                            onChange={handleStatusChange}
                            sx={{ minWidth: 120 }}
                        >
                            <MenuItem value="Pending">Pending</MenuItem>
                            <MenuItem value="Sent">Sent</MenuItem>
                            <MenuItem value="Confirmed">Confirmed</MenuItem>
                            <MenuItem value="Shipped">Shipped</MenuItem>
                            <MenuItem value="Completed">Completed</MenuItem>
                            <MenuItem value="Cancelled">Cancelled</MenuItem>
                        </Select>
                    </FormControl>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1 }}>
                            <Typography variant="h6" gutterBottom component="div">
                                Order Details
                            </Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item ID</TableCell>
                                        <TableCell>Hebrew Description</TableCell>
                                        <TableCell>English Description</TableCell>
                                        <TableCell align="right">Quantity</TableCell>
                                        <TableCell align="right">Price</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {order.Items.map((item) => (
                                        <TableRow key={item.orderItemId}>
                                            <TableCell>{item.itemId}</TableCell>
                                            <TableCell>{item.hebrewDescription}</TableCell>
                                            <TableCell>{item.englishDescription}</TableCell>
                                            <TableCell align="right">{item.quantity}</TableCell>
                                            <TableCell align="right">
                                                ${item.priceQuoted.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="right">
                                                ${(item.quantity * item.priceQuoted).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2">
                                    Supplier Contact: {order.ContactPerson}
                                </Typography>
                                <Typography variant="subtitle2">
                                    Email: {order.Email}
                                </Typography>
                                <Typography variant="subtitle2">
                                    Phone: {order.Phone}
                                </Typography>
                                {order.Notes && (
                                    <Typography variant="subtitle2">
                                        Notes: {order.Notes}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

export default function OrderList() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch orders');
            }
            const data = await response.json();
            setOrders(data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching orders:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update order status');
            }

            // Update local state
            setOrders(orders.map(order => 
                order.OrderID === orderId 
                    ? { ...order, Status: newStatus }
                    : order
            ));
        } catch (err) {
            console.error('Error updating order status:', err);
            // Revert the status change in the UI
            setOrders([...orders]);
        }
    };

    if (loading) {
        return <Typography>Loading orders...</Typography>;
    }

    if (error) {
        return <Typography color="error">Error: {error}</Typography>;
    }

    return (
        <Box sx={{ width: '100%', p: 2 }}>
            <Typography variant="h5" gutterBottom>
                Orders
            </Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell />
                            <TableCell>Order ID</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Total Items</TableCell>
                            <TableCell>Total Value</TableCell>
                            <TableCell>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {orders.map((order) => (
                            <OrderRow
                                key={order.OrderID}
                                order={order}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
