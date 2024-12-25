import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import DetailsTab from './DetailsTab';
import SupplierPricesTab from './SupplierPricesTab';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ marginTop: '16px' }}>
      {value === index && children}
    </div>
  );
}

function EditItemDialog({
  open,
  onClose,
  onSave,
  selectedItem,
  error,
}) {
  const [tabValue, setTabValue] = useState(0);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Item</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Details" />
            <Tab label="Edit Supplier Pricing" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <DetailsTab
            item={selectedItem}
            onSubmit={handleSave}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <SupplierPricesTab
            item={selectedItem}
          />
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          type="submit"
          form="item-details-form"
          variant="contained"
          disabled={tabValue !== 0} // Only enable save button on Details tab
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default EditItemDialog;