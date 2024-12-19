import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { AttachMoney as AttachMoneyIcon } from '@mui/icons-material';

function SupplierPriceChip({ supplierPrice }) {
  if (!supplierPrice || !supplierPrice.supplier_name || !supplierPrice.price_quoted) {
    return null;
  }

  return (
    <Tooltip title={`${supplierPrice.supplier_name} - ${new Date(supplierPrice.response_date).toLocaleDateString()}`}>
      <Chip
        icon={<AttachMoneyIcon />}
        label={`₪${supplierPrice.price_quoted}`}
        color={supplierPrice.is_promotion ? "secondary" : "primary"}
        size="small"
        variant="outlined"
        sx={{ margin: '2px' }}
      />
    </Tooltip>
  );
}

export default SupplierPriceChip;
