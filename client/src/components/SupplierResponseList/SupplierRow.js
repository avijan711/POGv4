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
import { formatPrice, parseMissingItems } from './utils';

export function SupplierRow({ 
    supplierId, 
    supplierData, 
    totalExpectedItems, 
    onDelete, 
    onDeleteItem, 
    onShowMissing 
}) {
    const [open, setOpen] = React.useState(false);
    
    const missingItemsData = React.useMemo(() => {
        return parseMissingItems(supplierData.missing_items, supplierId);
    }, [supplierData.missing_items, supplierId]);

    const missingItemsCount = supplierData.missing_count || missingItemsData.count;

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
                    <Chip
                        label={`${supplierData.total_items || 0} Items`}
                        size="small"
                        color="primary"
                        variant="outlined"
                    />
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
                            onClick={() => onShowMissing({
                                ...supplierData,
                                missing_items: missingItemsData.items
                            })}
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
