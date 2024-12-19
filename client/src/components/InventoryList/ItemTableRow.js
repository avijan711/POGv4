import React from 'react';
import {
  TableRow,
  TableCell,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  SwapHoriz as SwapHorizIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../config';

function ItemReference({ item, isNewReference, referencingItems, getChangeSource, onReferenceClick }) {
  // Filter out self-references
  const filteredReferencingItems = referencingItems.filter(ref => ref.item_id !== item.item_id);
  
  // Check if this item has a self-reference
  const isSelfReferenced = item.has_reference_change && 
    item.reference_change.new_reference_id === item.item_id;

  return (
    <TableCell>
      <Stack spacing={0.5}>
        {item.has_reference_change && !isSelfReferenced && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<SwapHorizIcon fontSize="small" />}
              label={`Replaced by ${item.reference_change.new_reference_id}`}
              color="warning"
              variant="filled"
              size="small"
              onClick={(e) => onReferenceClick(e, item.reference_change.new_reference_id)}
              sx={{ 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
              {getChangeSource(item.reference_change)}
            </Typography>
          </Box>
        )}
        {isNewReference && filteredReferencingItems.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<SwapHorizIcon fontSize="small" />}
              label={`Replaces ${filteredReferencingItems.map(i => i.item_id).join(', ')}`}
              color="success"
              variant="filled"
              size="small"
              onClick={(e) => {
                if (filteredReferencingItems.length === 1) {
                  onReferenceClick(e, filteredReferencingItems[0].item_id);
                }
              }}
              sx={{ 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            />
          </Box>
        )}
      </Stack>
    </TableCell>
  );
}

function ItemActions({ onEdit, onDelete }) {
  return (
    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
        <Tooltip title="Edit Item">
          <IconButton 
            size="small" 
            onClick={onEdit}
            sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Item">
          <IconButton 
            size="small" 
            color="error"
            onClick={onDelete}
            sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </TableCell>
  );
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') {
    return null;
  }
  const numPrice = Number(price);
  if (isNaN(numPrice)) {
    return null;
  }
  return `₪${numPrice.toFixed(2)}`;
}

function ItemTableRow({ 
  item, 
  index, 
  isNewReference, 
  referencingItems, 
  getChangeSource, 
  onRowClick, 
  onEdit, 
  onDelete,
  onReferenceClick
}) {
  const generateUniqueKey = (item, index) => {
    return `${item.item_id}-${item.qty_in_stock}-${item.sold_this_year}-${item.sold_last_year}-${index}`;
  };

  const getBackgroundColor = () => {
    if (isNewReference) {
      return '#c8e6c9'; // Darker green background for new/replacement items
    }
    if (item.has_reference_change && item.reference_change.new_reference_id !== item.item_id) {
      return 'rgba(255, 152, 0, 0.2)'; // More visible orange for old/replaced items
    }
    return 'inherit';
  };

  const getHoverColor = () => {
    if (isNewReference) {
      return '#a5d6a7'; // Even darker green on hover
    }
    if (item.has_reference_change && item.reference_change.new_reference_id !== item.item_id) {
      return 'rgba(255, 152, 0, 0.3)'; // Darker orange on hover
    }
    return 'rgba(0, 0, 0, 0.04)';
  };

  const getBorderStyle = () => {
    if (isNewReference) {
      return '2px solid #4caf50'; // Green border for new items
    }
    if (item.has_reference_change && item.reference_change.new_reference_id !== item.item_id) {
      return '2px solid #ff9800'; // Orange border for replaced items
    }
    return '1px solid rgba(224, 224, 224, 1)';
  };

  return (
    <TableRow 
      key={generateUniqueKey(item, index)}
      onClick={() => onRowClick(item)}
      sx={{ 
        cursor: 'pointer',
        backgroundColor: getBackgroundColor(),
        border: getBorderStyle(),
        '&:hover': { 
          backgroundColor: getHoverColor()
        },
        transition: 'all 0.2s ease',
        '& td': {
          py: 1.5,
          px: 2,
          height: 'auto',
          maxHeight: 'none'
        }
      }}
    >
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {item.item_id}
          {isNewReference && (
            <Chip
              size="small"
              label="New Item"
              color="success"
              variant="filled"
              sx={{ 
                fontWeight: 'bold',
                '.MuiChip-label': { px: 1 }
              }}
            />
          )}
        </Box>
      </TableCell>
      <TableCell sx={{ 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        minWidth: '180px',
        maxWidth: '300px',
        direction: 'rtl', // Right-to-left for Hebrew text
        textAlign: 'right'
      }}>
        {item.hebrew_description}
      </TableCell>
      <TableCell sx={{ 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        minWidth: '180px',
        maxWidth: '300px'
      }}>
        {item.english_description}
      </TableCell>
      <TableCell align="right">{Number(item.import_markup).toFixed(2)}</TableCell>
      <TableCell>{item.hs_code}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PublicIcon fontSize="small" color="action" />
          <Typography>{item.origin || 'N/A'}</Typography>
        </Box>
      </TableCell>
      <TableCell>
        {item.image && (
          <img 
            src={`${API_BASE_URL}/uploads/${item.image}`} 
            alt={item.english_description || item.hebrew_description}
            style={{ maxWidth: '50px', maxHeight: '50px', objectFit: 'contain' }}
          />
        )}
      </TableCell>
      <TableCell align="right">{item.qty_in_stock || 0}</TableCell>
      <TableCell align="right">{item.sold_this_year || 0}</TableCell>
      <TableCell align="right">{item.sold_last_year || 0}</TableCell>
      <TableCell align="right">
        {formatPrice(item.retail_price) || (
          <Typography variant="body2" color="error">
            No Price
          </Typography>
        )}
      </TableCell>
      <ItemReference 
        item={item}
        isNewReference={isNewReference}
        referencingItems={referencingItems}
        getChangeSource={getChangeSource}
        onReferenceClick={onReferenceClick}
      />
      <ItemActions 
        onEdit={(e) => onEdit(e, item)}
        onDelete={(e) => onDelete(e, item.item_id)}
      />
    </TableRow>
  );
}

export default ItemTableRow;
