import React from 'react';
import {
  TableRow,
  TableCell,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../../config';

function ItemReference({ item, isNewReference, referencingItems, getChangeSource }) {
  return (
    <TableCell>
      {item.hasReferenceChange && (
        <Box>
          <Chip
            label={`→ ${item.referenceChange.newReferenceID}`}
            color="warning"
            variant="outlined"
            size="small"
          />
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            {getChangeSource(item.referenceChange)}
          </Typography>
        </Box>
      )}
      {isNewReference && (
        <Box sx={{ mt: item.hasReferenceChange ? 1 : 0 }}>
          <Chip
            label={`← ${referencingItems.map(i => i.itemID).join(', ')}`}
            color="success"
            variant="outlined"
            size="small"
          />
          {referencingItems.map((refItem, index) => (
            <Typography 
              key={`${refItem.itemID}-${index}`}
              variant="caption" 
              display="block" 
              sx={{ mt: 0.5 }}
            >
              {getChangeSource(refItem.referenceChange)}
            </Typography>
          ))}
        </Box>
      )}
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
  onDelete 
}) {
  const generateUniqueKey = (item, index) => {
    return `${item.itemID}-${item.qtyInStock}-${item.soldThisYear}-${item.soldLastYear}-${index}`;
  };

  return (
    <TableRow 
      key={generateUniqueKey(item, index)}
      onClick={() => onRowClick(item)}
      sx={{ 
        cursor: 'pointer',
        backgroundColor: item.hasReferenceChange 
          ? 'rgba(255, 243, 224, 0.9)'
          : isNewReference
            ? '#e8f5e9'
            : 'inherit',
        '&:hover': { 
          backgroundColor: item.hasReferenceChange 
            ? 'rgba(255, 243, 224, 1)' 
            : isNewReference
              ? '#c8e6c9'
              : 'rgba(0, 0, 0, 0.04)' 
        }
      }}
    >
      <TableCell>{item.itemID}</TableCell>
      <TableCell>{item.hebrewDescription}</TableCell>
      <TableCell>{item.englishDescription}</TableCell>
      <TableCell align="right">{Number(item.importMarkup).toFixed(2)}</TableCell>
      <TableCell>{item.hsCode}</TableCell>
      <TableCell>
        {item.image && (
          <img 
            src={`${API_BASE_URL}/uploads/${item.image}`} 
            alt={item.englishDescription || item.hebrewDescription}
            style={{ maxWidth: '50px', maxHeight: '50px' }}
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
      />
      <ItemActions 
        onEdit={(e) => onEdit(e, item)}
        onDelete={(e) => onDelete(e, item.itemID)}
      />
    </TableRow>
  );
}

export default ItemTableRow;
