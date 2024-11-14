import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Alert,
    Typography
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { API_BASE_URL } from '../config';

const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [open, setOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        contactPerson: '',
        email: '',
        phone: ''
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/suppliers`);
            if (!response.ok) {
                throw new Error('Failed to fetch suppliers');
            }
            const data = await response.json();
            setSuppliers(data);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            setError('Failed to load suppliers');
        }
    };

    const handleOpen = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.Name,
                contactPerson: supplier.ContactPerson || '',
                email: supplier.Email || '',
                phone: supplier.Phone || ''
            });
        } else {
            setEditingSupplier(null);
            setFormData({
                name: '',
                contactPerson: '',
                email: '',
                phone: ''
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingSupplier(null);
        setFormData({
            name: '',
            contactPerson: '',
            email: '',
            phone: ''
        });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            setError('Supplier name is required');
            return;
        }

        try {
            const url = editingSupplier
                ? `${API_BASE_URL}/api/suppliers/${editingSupplier.SupplierID}`
                : `${API_BASE_URL}/api/suppliers`;
            
            const response = await fetch(url, {
                method: editingSupplier ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name,
                    contactPerson: formData.contactPerson,
                    email: formData.email,
                    phone: formData.phone
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save supplier');
            }

            await fetchSuppliers();
            handleClose();
        } catch (error) {
            console.error('Error saving supplier:', error);
            setError(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this supplier?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete supplier');
            }

            await fetchSuppliers();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            setError('Failed to delete supplier');
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">Suppliers</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpen()}
                >
                    Add Supplier
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Contact Person</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {suppliers.map((supplier) => (
                            <TableRow key={supplier.SupplierID}>
                                <TableCell>{supplier.Name}</TableCell>
                                <TableCell>{supplier.ContactPerson}</TableCell>
                                <TableCell>{supplier.Email}</TableCell>
                                <TableCell>{supplier.Phone}</TableCell>
                                <TableCell align="right">
                                    <IconButton
                                        color="primary"
                                        onClick={() => handleOpen(supplier)}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        color="error"
                                        onClick={() => handleDelete(supplier.SupplierID)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
                </DialogTitle>
                <DialogContent>
                    <Box component="form" sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Contact Person"
                            value={formData.contactPerson}
                            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained">
                        {editingSupplier ? 'Save' : 'Add'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Suppliers;
