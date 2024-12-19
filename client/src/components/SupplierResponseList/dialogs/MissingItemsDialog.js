import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import { Warning as WarningIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { API_BASE_URL } from '../../../config';

export function MissingItemsDialog({ open, onClose, items = [], supplierName = '' }) {
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);

  // Log props on mount and updates
  React.useEffect(() => {
    console.log('MissingItemsDialog props updated:', {
      open,
      supplierName,
      items_type: typeof items,
      isArray: Array.isArray(items),
      items_length: items?.length,
      raw_items: items,
      first_item: Array.isArray(items) && items.length > 0 ? items[0] : null,
      all_items: items
    });
  }, [open, items, supplierName]);

  const parsedItems = React.useMemo(() => {
    try {
      setLoading(true);
      
      // Enhanced debug logging
      console.log('MissingItemsDialog processing items:', {
        items_type: typeof items,
        isArray: Array.isArray(items),
        items_length: items?.length,
        raw_items: items,
        first_item: Array.isArray(items) && items.length > 0 ? items[0] : null
      });

      // Ensure items is an array
      if (!Array.isArray(items)) {
        console.log('Items is not an array, returning empty array');
        return [];
      }

      // Filter out any invalid items and ensure required properties
      const validItems = items.filter(item => {
        const isValid = item && 
          typeof item === 'object' && 
          item.item_id &&
          (item.hebrew_description || item.english_description);
        
        if (!isValid) {
          console.log('Invalid item found:', item);
        }
        
        return isValid;
      });

      console.log('Processed valid items:', {
        original_length: items.length,
        valid_length: validItems.length,
        first_valid_item: validItems[0]
      });

      return validItems;
    } catch (e) {
      console.error('Error processing items:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [items]);

  // Log the final parsed items
  React.useEffect(() => {
    console.log('MissingItemsDialog final parsed items:', {
      length: parsedItems.length,
      items: parsedItems,
      first_item: parsedItems[0]
    });
  }, [parsedItems]);

  const handleExport = async () => {
    try {
      setExporting(true);
      console.log('Exporting missing items:', {
        url: `${API_BASE_URL}/api/supplier-responses/export-missing-items`,
        itemCount: parsedItems.length,
        supplierName
      });

      const response = await fetch(`${API_BASE_URL}/api/supplier-responses/export-missing-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: parsedItems,
          supplierName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export missing items');
      }

      // Get the filename from the Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `missing_items_${supplierName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Convert response to blob
      const blob = await response.blob();
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting missing items:', error);
      // You might want to show a snackbar or other error notification here
    } finally {
      setExporting(false);
    }
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
          <WarningIcon color="warning" />
          <Typography>Missing Items for {supplierName} ({parsedItems.length})</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item ID</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Requested Qty</TableCell>
                  <TableCell align="right">Retail Price</TableCell>
                  <TableCell>Origin</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedItems.length > 0 ? (
                  parsedItems.map((item) => (
                    <TableRow 
                      key={item.item_id}
                      hover
                      sx={{
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        }
                      }}
                    >
                      <TableCell>{item.item_id}</TableCell>
                      <TableCell>
                        <Typography>{item.hebrew_description}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.english_description}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.requested_qty}</TableCell>
                      <TableCell align="right">₪{Number(item.retail_price).toFixed(2)}</TableCell>
                      <TableCell>{item.origin || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary">No missing items found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
          disabled={exporting || parsedItems.length === 0}
          color="primary"
        >
          {exporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
