import React, { useState } from 'react';
import { Chip, Tooltip, IconButton, Box } from '@mui/material';
import { 
  AttachMoney as AttachMoneyIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import PriceEditDialog from './PriceEditDialog';

function SupplierPriceChip({ 
  supplierPrice,
  item,
  onPriceUpdate,
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (!supplierPrice || !supplierPrice.supplier_name || !supplierPrice.price_quoted) {
    return null;
  }

  const handleEditClick = (event) => {
    event.stopPropagation();
    setEditDialogOpen(true);
  };

  const handleSave = async (priceData) => {
    await onPriceUpdate(supplierPrice.supplier_id, priceData);
  };

  const getPriceTypeLabel = () => {
    if (supplierPrice.is_promotion) return 'Promotion Price';
    if (supplierPrice.is_permanent) return 'Permanent Price';
    return 'Inquiry-specific Price';
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip 
        title={`${supplierPrice.supplier_name} - ${getPriceTypeLabel()} - ${new Date(supplierPrice.response_date).toLocaleDateString()}`}
      >
        <Chip
          icon={<AttachMoneyIcon />}
          label={`₪${supplierPrice.price_quoted}`}
          color={supplierPrice.is_promotion ? 'secondary' : 'primary'}
          size="small"
          variant={supplierPrice.is_permanent ? 'filled' : 'outlined'}
          sx={{ 
            margin: '2px',
            '&:hover': {
              backgroundColor: (theme) => 
                supplierPrice.is_permanent 
                  ? theme.palette.primary.dark
                  : theme.palette.action.hover,
            },
          }}
        />
      </Tooltip>

      <IconButton 
        size="small" 
        onClick={handleEditClick}
        sx={{ 
          padding: '2px',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <EditIcon fontSize="small" />
      </IconButton>

      <PriceEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        item={item}
        supplierPrice={supplierPrice}
        onSave={handleSave}
      />
    </Box>
  );
}

export default SupplierPriceChip;
