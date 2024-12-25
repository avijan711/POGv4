import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useSupplierPriceManagement } from '../../../../hooks/useSupplierPriceManagement';
import PriceRow from './PriceRow';
import PriceEditDialog from './PriceEditDialog';

function SupplierPricesTab({ item }) {
  const {
    loading,
    error,
    prices,
    availableSuppliers,
    updatePrice,
    loadPriceHistory,
  } = useSupplierPriceManagement(item?.item_id);

  const [editingPrice, setEditingPrice] = useState(null);
  const [addingNew, setAddingNew] = useState(false);

  const handlePriceUpdate = async (priceData) => {
    try {
      const success = await updatePrice(
        editingPrice?.supplier_id || priceData.supplier_id,
        priceData,
      );
      if (success) {
        setEditingPrice(null);
        setAddingNew(false);
      }
      return success;
    } catch (err) {
      console.error('Error updating price:', err);
      return false;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // Show "Add First Price" view when no prices exist
  if (prices.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          No supplier prices yet
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddingNew(true)}
          sx={{ mt: 2 }}
        >
          Add First Price
        </Button>

        {addingNew && (
          <PriceEditDialog
            open={true}
            onClose={() => setAddingNew(false)}
            onSave={handlePriceUpdate}
            availableSuppliers={availableSuppliers}
            isNew={true}
            item={item}
          />
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        {availableSuppliers.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAddingNew(true)}
          >
            Add New Supplier Price
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Supplier</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell>Last Update</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {prices.map((price, index) => (
              <PriceRow
                key={`${price.supplier_id}-${index}`}
                price={price}
                onEdit={() => setEditingPrice(price)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {(editingPrice || addingNew) && (
        <PriceEditDialog
          open={true}
          onClose={() => {
            setEditingPrice(null);
            setAddingNew(false);
          }}
          price={editingPrice}
          onSave={handlePriceUpdate}
          availableSuppliers={availableSuppliers}
          isNew={addingNew}
          item={item}
          loadPriceHistory={loadPriceHistory}
        />
      )}
    </Box>
  );
}

export default SupplierPricesTab;