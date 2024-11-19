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
} from '@mui/icons-material';
import { API_BASE_URL } from '../../config';

function ItemReference({ item, isNewReference, referencingItems, getChangeSource, onReferenceClick }) {
  // Filter out self-references
  const filteredReferencingItems = referencingItems.filter(ref => ref.itemID !== item.itemID);
  
  // Check if this item has a self-reference
  const isSelfReferenced = item.hasReferenceChange && 
    item.referenceChange.newReferenceID === item.itemID;

  return (
    <TableCell>
      <Stack spacing={0.5}>
        {item.hasReferenceChange && !isSelfReferenced && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<SwapHorizIcon fontSize="small" />}
              label={`Replaced by ${item.referenceChange.newReferenceID}`}
              color="warning"
              variant="outlined"
              size="small"
              onClick={(e) => onReferenceClick(e, item.referenceChange.newReferenceID)}
              sx={{ cursor: 'pointer' }}
            />
            <Typography variant="caption" color="text.secondary">
              {getChangeSource(item.referenceChange)}
            </Typography>
          </Box>
        )}
        {isNewReference && filteredReferencingItems.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<SwapHorizIcon fontSize="small" />}
              label={`Replaces ${filteredReferencingItems.map(i => i.itemID).join(', ')}`}
              color="success"
              variant="outlined"
              size="small"
              onClick={(e) => {
                if (filteredReferencingItems.length === 1) {
                  onReferenceClick(e, filteredReferencingItems[0].itemID);
                }
              }}
              sx={{ cursor: 'pointer' }}
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
    return `${item.itemID}-${item.qtyInStock}-${item.soldThisYear}-${item.soldLastYear}-${index}`;
  };

  const getBackgroundColor = () => {
    if (isNewReference) {
      return '#e8f5e9'; // Light green background for new/replacement items
    }
    if (item.hasReferenceChange && item.referenceChange.newReferenceID !== item.itemID) {
      return 'rgba(255, 152, 0, 0.08)'; // Subtle orange for old/replaced items
    }
    return 'inherit';
  };

  const getHoverColor = () => {
    if (isNewReference) {
      return '#c8e6c9'; // Slightly darker green on hover
    }
    if (item.hasReferenceChange && item.referenceChange.newReferenceID !== item.itemID) {
      return 'rgba(255, 152, 0, 0.15)'; // Slightly darker orange on hover
    }
    return 'rgba(0, 0, 0, 0.04)';
  };

  return (
    <TableRow 
      key={generateUniqueKey(item, index)}
      onClick={() => onRowClick(item)}
      sx={{ 
        cursor: 'pointer',
        backgroundColor: getBackgroundColor(),
        '&:hover': { 
          backgroundColor: getHoverColor()
        },
        transition: 'background-color 0.2s ease',
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
          {item.itemID}
          {isNewReference && (
            <Chip
              size="small"
              label="New Item"
              sx={{ 
                backgroundColor: '#e8f5e9',
                color: '#2e7d32',
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
        {item.hebrewDescription}
      </TableCell>
      <TableCell sx={{ 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        minWidth: '180px',
        maxWidth: '300px'
      }}>
        {item.englishDescription}
      </TableCell>
      <TableCell align="right">{Number(item.importMarkup).toFixed(2)}</TableCell>
      <TableCell>{item.hsCode}</TableCell>
      <TableCell>
        {item.image && (
          <img 
            src={`${API_BASE_URL}/uploads/${item.image}`} 
            alt={item.englishDescription || item.hebrewDescription}
            style={{ maxWidth: '50px', maxHeight: '50px', objectFit: 'contain' }}
          />
        )}
      </TableCell>
      <TableCell align="right">{item.qtyInStock || 0}</TableCell>
      <TableCell align="right">{item.soldThisYear || 0}</TableCell>
      <TableCell align="right">{item.soldLastYear || 0}</TableCell>
      <TableCell align="right">
        {formatPrice(item.retailPrice) || (
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
        onDelete={(e) => onDelete(e, item.itemID)}
      />
    </TableRow>
  );
}

export default ItemTableRow;
