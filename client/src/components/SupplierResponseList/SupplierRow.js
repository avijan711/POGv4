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
  Tooltip,
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
  Edit as EditIcon,
} from '@mui/icons-material';
import { formatPrice } from './utils';
import PriceEditDialog from '../InquiryItemsTable/PriceEditDialog';

export function SupplierRow({ 
  supplierId, 
  supplierData, 
  totalExpectedItems, 
  onDelete, 
  onDeleteItem, 
  onShowMissing,
  onShowCovered,
  onPriceUpdate,
}) {
  const [open, setOpen] = React.useState(false);
  const [editingPrice, setEditingPrice] = React.useState(null);

  const handlePriceUpdate = async (priceData) => {
    try {
      await onPriceUpdate(supplierId, {
        ...priceData,
        item_id: editingPrice.item_id,
      });
      setEditingPrice(null);
    } catch (err) {
      console.error('Error updating price:', err);
      throw err;
    }
  };

  const missingItemsCount = supplierData.missing_count || supplierData.missing_items?.length || 0;
  const respondedItemsCount = supplierData.item_count || supplierData.responses?.length || 0;
  const totalItems = totalExpectedItems || supplierData.total_expected_items || 0;

  const handleShowMissing = React.useCallback(() => {
    if (missingItemsCount > 0) {
      const missingItems = Array.isArray(supplierData.missing_items) 
        ? [...supplierData.missing_items]
        : [];

      const cleanSupplierData = {
        ...supplierData,
        missing_items: missingItems,
      };

      onShowMissing(cleanSupplierData);
    }
  }, [
    missingItemsCount, 
    onShowMissing, 
    supplierData, 
    totalItems, 
    respondedItemsCount,
  ]);

  const handleShowCovered = React.useCallback(() => {
    if (respondedItemsCount > 0) {
      onShowCovered({
        ...supplierData,
        responses: Array.isArray(supplierData.responses) 
          ? [...supplierData.responses]
          : [],
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
              color={respondedItemsCount === totalItems ? 'success' : 'warning'}
              variant="outlined"
              onClick={handleShowCovered}
              sx={{ 
                cursor: respondedItemsCount > 0 ? 'pointer' : 'default',
                '&:hover': respondedItemsCount > 0 ? {
                  backgroundColor: 'action.hover',
                  transform: 'scale(1.02)',
                } : {},
                transition: 'all 0.2s',
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
              data-testid="status-chip"
            />
          ) : (
            <Chip
              icon={<InfoIcon />}
              label={`${missingItemsCount} Missing`}
              size="small"
              color="warning"
              onClick={handleShowMissing}
              sx={{ cursor: 'pointer' }}
              data-testid="status-chip"
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
                            color={response.is_promotion ? 'secondary' : 'default'}
                            variant={response.is_permanent ? 'filled' : 'outlined'}
                            size="small"
                            onClick={() => setEditingPrice(response)}
                            sx={{ cursor: 'pointer' }}
                          />
                          {response.is_promotion && (
                            <Chip
                              icon={<LocalOfferIcon />}
                              label="Promotion"
                              color="secondary"
                              size="small"
                            />
                          )}
                          <IconButton
                            size="small"
                            onClick={() => setEditingPrice(response)}
                            sx={{ 
                              padding: '2px',
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
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

      {editingPrice && (
        <PriceEditDialog
          open={!!editingPrice}
          onClose={() => setEditingPrice(null)}
          item={{
            item_id: editingPrice.item_id,
            hebrewDescription: editingPrice.hebrew_description,
            englishDescription: editingPrice.english_description,
          }}
          supplierPrice={{
            ...editingPrice,
            supplier_name: supplierData.supplier_name,
          }}
          onSave={handlePriceUpdate}
        />
      )}
    </>
  );
}
