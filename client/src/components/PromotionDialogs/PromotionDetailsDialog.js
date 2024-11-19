import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Chip,
    TextField,
    InputAdornment,
    Pagination
} from '@mui/material';
import { format, isValid, parseISO } from 'date-fns';
import SearchIcon from '@mui/icons-material/Search';

function PromotionDetailsDialog({ 
    open, 
    onClose, 
    promotionDetails, 
    loading,
    currentPage,
    onPageChange
}) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = promotionDetails?.items.filter(item => 
        !searchTerm || item.ItemID.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const formatDate = (dateString) => {
        if (!dateString) return 'No date';
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'dd/MM/yyyy') : 'Invalid date';
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                <Box display="flex" alignItems="center" gap={1}>
                    {promotionDetails?.name || 'Promotion Details'}
                    {promotionDetails?.supplierName && (
                        <Chip 
                            label={`Supplier: ${promotionDetails.supplierName}`}
                            color="primary"
                            sx={{ ml: 2 }}
                        />
                    )}
                </Box>
            </DialogTitle>
            <DialogContent>
                {loading ? (
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
                                Start Date: {formatDate(promotionDetails.start_date)}
                            </Typography>
                            <Typography variant="body2">
                                End Date: {formatDate(promotionDetails.end_date)}
                            </Typography>
                            <Typography variant="body2">
                                Total Items: {promotionDetails.totalItems || 0}
                            </Typography>
                            <Typography variant="body2">
                                Status: {promotionDetails.is_active ? 'Active' : 'Inactive'}
                            </Typography>
                        </Box>

                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Search by Item ID"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            sx={{ mb: 2 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <TableContainer component={Paper} sx={{ mt: 2 }}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item ID</TableCell>
                                        <TableCell align="right">Promo Price (EUR)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredItems.map((item) => (
                                        <TableRow key={item.ItemID}>
                                            <TableCell>{item.ItemID}</TableCell>
                                            <TableCell align="right">
                                                {typeof item.PromoPrice === 'number' 
                                                    ? `€${item.PromoPrice.toFixed(2)}` 
                                                    : 'N/A'
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={2} align="center">
                                                {searchTerm ? 'No matching items found' : 'No items found'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {promotionDetails.totalPages > 1 && !searchTerm && (
                            <Box display="flex" justifyContent="center" mt={2}>
                                <Pagination
                                    count={promotionDetails.totalPages}
                                    page={currentPage}
                                    onChange={onPageChange}
                                    disabled={loading}
                                />
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

export default PromotionDetailsDialog;
