import React from 'react';
import {
  TableRow,
  TableCell,
  IconButton,
  Chip,
  Tooltip,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  LocalOffer as LocalOfferIcon,
  Euro as EuroIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';

function PriceRow({ price, onEdit }) {
  const getPriceTypeChip = () => {
    if (price.is_promotion) {
      return (
        <Chip
          icon={<LocalOfferIcon />}
          label="Promotion"
          color="secondary"
          size="small"
        />
      );
    }
    
    if (price.is_permanent) {
      return (
        <Chip
          icon={<LockIcon />}
          label="Permanent"
          color="primary"
          variant="filled"
          size="small"
        />
      );
    }

    return (
      <Chip
        icon={<LockOpenIcon />}
        label="Inquiry"
        color="primary"
        variant="outlined"
        size="small"
      />
    );
  };

  // Format price with proper handling of null/undefined
  const formatPrice = (value, currency = '₪') => {
    if (value == null) return '-';
    const numValue = parseFloat(value);
    return isNaN(numValue) ? '-' : `${currency}${numValue.toFixed(2)}`;
  };

  return (
    <TableRow
      sx={{
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
    >
      <TableCell>{price.supplier_name || 'Unknown Supplier'}</TableCell>
      <TableCell align="right">
        <Stack spacing={1} alignItems="flex-end">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EuroIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {formatPrice(price.supplier_price_eur, '€')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoneyIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {formatPrice(price.ils_retail_price)}
            </Typography>
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        {price.response_date || price.date ? 
          new Date(price.response_date || price.date).toLocaleDateString() :
          '-'
        }
      </TableCell>
      <TableCell>
        {getPriceTypeChip()}
      </TableCell>
      <TableCell>
        {price.notes || '-'}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Edit price">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(price);
            }}
            sx={{ 
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

export default PriceRow;