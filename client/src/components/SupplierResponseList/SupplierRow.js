import React from 'react';
import {
    Box,
    Typography,
    Chip,
    IconButton,
    Button,
    TableRow,
    TableCell,
    Collapse,
    Table,
    TableHead,
    TableBody,
    Tooltip
} from '@mui/material';
import {
    Business as BusinessIcon,
    AttachMoney as AttachMoneyIcon,
    LocalOffer as LocalOfferIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    Info as InfoIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    KeyboardArrowUp as KeyboardArrowUpIcon,
} from '@mui/icons-material';
import { formatPrice } from './utils';

export function SupplierRow({ 
    supplierId, 
    supplierData, 
    totalExpectedItems, 
    onDelete, 
    onDeleteItem, 
    onShowMissing,
    onShowCovered 
}) {
    const [open, setOpen] = React.useState(false);

    // Enhanced debug logging for initial data
    React.useEffect(() => {
        console.log('SupplierRow mounted/updated:', {
            supplier_name: supplierData.supplier_name,
            missing_items_type: typeof supplierData.missing_items,
            isArray: Array.isArray(supplierData.missing_items),
            missing_items_length: supplierData.missing_items?.length,
            raw_missing_items: supplierData.missing_items,
            missing_count: supplierData.missing_count,
            first_missing_item: Array.isArray(supplierData.missing_items) ? supplierData.missing_items[0] : null
        });
    }, [supplierData]);

    const missingItemsCount = supplierData.missing_count || supplierData.missing_items?.length || 0;
    const respondedItemsCount = supplierData.item_count || supplierData.responses?.length || 0;
    const totalItems = totalExpectedItems || supplierData.total_expected_items || 0;

    const handleShowMissing = React.useCallback(() => {
        if (missingItemsCount > 0) {
            // Ensure missing_items is an array and create a clean copy
            const missingItems = Array.isArray(supplierData.missing_items) 
                ? [...supplierData.missing_items]
                : [];

            // Enhanced debug logging
            console.log('handleShowMissing triggered:', {
                supplier: supplierData.supplier_name,
                original_missing_items: supplierData.missing_items,
                processed_missing_items: missingItems,
                missing_items_length: missingItems.length,
                first_item: missingItems[0],
                missingCount: missingItemsCount,
                totalExpected: totalItems,
                responded: respondedItemsCount
            });
            
            // Create a clean copy of the supplier data
            const cleanSupplierData = {
                ...supplierData,
                missing_items: missingItems
            };

            onShowMissing(cleanSupplierData);
        }
    }, [
        missingItemsCount, 
        onShowMissing, 
        supplierData, 
        totalItems, 
        respondedItemsCount
    ]);

    const handleShowCovered = React.useCallback(() => {
        if (respondedItemsCount > 0) {
            // Enhanced debug logging
            console.log('handleShowCovered triggered:', {
                supplier: supplierData.supplier_name,
                responses: supplierData.responses,
                responses_length: supplierData.responses?.length,
                totalExpected: totalItems,
                responded: respondedItemsCount
            });
            
            onShowCovered({
                ...supplierData,
                responses: Array.isArray(supplierData.responses) 
                    ? [...supplierData.responses]
                    : []
            });
        }
    }, [respondedItemsCount, onShowCovered, supplierData, totalItems]);

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
                <TableCell component="th" scope="row">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight="bold">
                            {supplierData.supplier_name}
                        </Typography>
                    </Box>
                </TableCell>
                <TableCell align="right">
                    <Tooltip title={`Click to view ${respondedItemsCount} covered items`}>
                        <Chip
                            label={`${respondedItemsCount}/${totalItems} parts`}
                            size="small"
                            color={respondedItemsCount === totalItems ? "success" : "warning"}
                            variant="outlined"
                            onClick={handleShowCovered}
                            sx={{ 
                                cursor: respondedItemsCount > 0 ? 'pointer' : 'default',
                                '&:hover': respondedItemsCount > 0 ? {
                                    backgroundColor: 'action.hover',
                                    transform: 'scale(1.02)',
                                } : {},
                                transition: 'all 0.2s'
                            }}
                        />
                    </Tooltip>
                </TableCell>
                <TableCell align="right">{formatPrice(supplierData.average_price)}</TableCell>
                <TableCell align="right">
                    {new Date(supplierData.latest_response || new Date()).toLocaleDateString()}
                </TableCell>
                <TableCell align="right">
                    {missingItemsCount === 0 ? (
                        <Chip
                            icon={<CheckCircleIcon />}
                            label="Complete"
                            size="small"
                            color="success"
                        />
                    ) : (
                        <Chip
                            icon={<InfoIcon />}
                            label={`${missingItemsCount} Missing`}
                            size="small"
                            color="warning"
                            onClick={handleShowMissing}
                            sx={{ cursor: 'pointer' }}
                        />
                    )}
                </TableCell>
                <TableCell align="right">
                    <Button
                        startIcon={<DeleteIcon />}
                        color="error"
                        onClick={() => onDelete(supplierData)}
                    >
                        Delete All
                    </Button>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1 }}>
                            <Typography variant="h6" gutterBottom component="div">
                                Responses
                            </Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item ID</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell align="right">Price</TableCell>
                                        <TableCell>Response Date</TableCell>
                                        <TableCell>Notes</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {supplierData.responses.map((response, index) => (
                                        <TableRow key={response.supplier_response_id || `${response.item_id}-${response.response_date}-${index}`}>
                                            <TableCell component="th" scope="row">{response.item_id}</TableCell>
                                            <TableCell>
                                                <Typography>{response.hebrew_description}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {response.english_description}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                                    <Chip
                                                        icon={<AttachMoneyIcon />}
                                                        label={formatPrice(response.price_quoted)}
                                                        color={response.is_promotion ? "secondary" : "default"}
                                                        variant="outlined"
                                                        size="small"
                                                    />
                                                    {response.is_promotion && (
                                                        <Chip
                                                            icon={<LocalOfferIcon />}
                                                            label="Promotion"
                                                            color="secondary"
                                                            size="small"
                                                        />
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                {new Date(response.response_date || new Date()).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>{response.notes || '-'}</TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => onDeleteItem(response)}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}
