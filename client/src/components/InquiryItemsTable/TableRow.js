import React, { useState, useEffect } from 'react';
import {
  TableRow as MuiTableRow,
  TableCell,
  Box,
  Button,
  IconButton,
  TextField,
  Chip,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  SwapHoriz as SwapHorizIcon,
  Close as CloseIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

function TableRow({
  item,
  index,
  editingQty,
  onEditQty,
  onUpdateQty,
  onViewDetails,
  onEditItem,
  onDeleteItem,
  onDeleteReference,
  getChangeSource,
}) {
  const [tempQty, setTempQty] = useState(item.requestedQty || 0);
  const [displayQty, setDisplayQty] = useState(item.requestedQty || 0);

  useEffect(() => {
    setDisplayQty(item.requestedQty || 0);
    if (editingQty === item.inquiryItemID) {
      setTempQty(item.requestedQty || 0);
    }
  }, [item.requestedQty, editingQty, item.inquiryItemID]);

  const handleStartEdit = (e) => {
    e.stopPropagation(); // Prevent row click
    setTempQty(displayQty);
    onEditQty(item.inquiryItemID);
  };

  const handleQtyChange = (value) => {
    const newQty = parseInt(value) || 0;
    if (newQty >= 0) {
      setTempQty(newQty);
    }
  };

  const handleQtyUpdate = async () => {
    if (editingQty === item.inquiryItemID) {
      const oldQty = displayQty;
      setDisplayQty(tempQty); // Optimistic update
      
      const success = await onUpdateQty(item.inquiryItemID, tempQty);
      if (!success) {
        setDisplayQty(oldQty); // Revert on failure
        setTempQty(oldQty);
      }
      onEditQty(null); // Exit edit mode after success/failure
    }
  };

  const handleQtyCancel = (e) => {
    e.stopPropagation(); // Prevent row click
    setTempQty(displayQty); // Reset to original value
    onEditQty(null); // Exit edit mode
  };

  const handleQtyBlur = (e) => {
    // Don't handle blur if clicking the confirm/cancel buttons
    if (e.relatedTarget && 
        (e.relatedTarget.classList.contains('confirm-qty') || 
         e.relatedTarget.classList.contains('cancel-qty'))) {
      return;
    }
    e.stopPropagation();
    handleQtyUpdate();
  };

  const handleQtyKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      handleQtyUpdate();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      handleQtyCancel(e);
    }
  };

  const getReferenceTooltip = (referenceChange) => {
    if (!referenceChange) return '';
    if (referenceChange.source === 'inquiry_item') {
      return 'Reference from inquiry';
    }
    return `Changed by ${referenceChange.supplierName || 'user'}`;
  };

  const handleRowClick = (e) => {
    // Only trigger view details if we're not editing quantity
    if (editingQty !== item.inquiryItemID) {
      onViewDetails(item);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDeleteItem) {
      onDeleteItem(item);
    }
  };

  return (
    <MuiTableRow 
      onClick={handleRowClick}
      sx={{ 
        backgroundColor: item.isDuplicate 
          ? 'rgba(255, 152, 0, 0.1)'
          : item.hasReferenceChange && item.referenceChange
            ? 'rgba(255, 243, 224, 0.9)'
            : item.isReferencedBy
              ? '#e8f5e9'
              : 'inherit',
        '&:hover': { 
          backgroundColor: item.isDuplicate
            ? 'rgba(255, 152, 0, 0.2)'
            : item.hasReferenceChange && item.referenceChange
              ? 'rgba(255, 243, 224, 1)' 
              : item.isReferencedBy
                ? '#c8e6c9'
                : 'rgba(0, 0, 0, 0.04)' 
        },
        cursor: editingQty === item.inquiryItemID ? 'default' : 'pointer',
      }}
    >
      <TableCell>{(item.excelRowIndex || index) + 1}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {item.itemID}
          {item.isDuplicate && (
            <Tooltip title={`Duplicate of row ${(item.originalRowIndex || 0) + 1}`}>
              <ContentCopyIcon color="warning" fontSize="small" />
            </Tooltip>
          )}
        </Box>
      </TableCell>
      <TableCell>{item.hebrewDescription}</TableCell>
      <TableCell>{item.englishDescription}</TableCell>
      <TableCell align="right">{Number(item.importMarkup).toFixed(2)}</TableCell>
      <TableCell>{item.hsCode}</TableCell>
      <TableCell align="right">{item.qtyInStock || 0}</TableCell>
      <TableCell 
        align="right" 
        onClick={(e) => e.stopPropagation()}
        sx={{ 
          position: 'relative',
          '& .qty-edit-container': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            width: '100%',
            height: '100%'
          }
        }}
      >
        <div className="qty-edit-container">
          {editingQty === item.inquiryItemID ? (
            <>
              <TextField
                type="number"
                size="small"
                value={tempQty}
                onChange={(e) => handleQtyChange(e.target.value)}
                onBlur={handleQtyBlur}
                onKeyDown={handleQtyKeyPress}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                sx={{ 
                  width: '80px',
                  '& .MuiInputBase-input': {
                    textAlign: 'right'
                  }
                }}
                inputProps={{ 
                  min: 0,
                  style: { textAlign: 'right' }
                }}
              />
              <IconButton
                size="small"
                color="primary"
                className="confirm-qty"
                onClick={handleQtyUpdate}
                sx={{ padding: '4px' }}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                className="cancel-qty"
                onClick={handleQtyCancel}
                sx={{ padding: '4px' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <Box 
              onClick={handleStartEdit}
              sx={{ 
                cursor: 'text',
                padding: '8px',
                minWidth: '60px',
                textAlign: 'right',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  borderRadius: '4px'
                }
              }}
            >
              {displayQty}
            </Box>
          )}
        </div>
      </TableCell>
      <TableCell align="right">
        {item.retailPrice ? (
          `₪${item.retailPrice}`
        ) : (
          <Typography variant="body2" color="error">
            No Price
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {item.hasReferenceChange && item.referenceChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={getReferenceTooltip(item.referenceChange)}>
              <Chip
                label={`→ ${item.referenceChange.newReferenceID}`}
                color="warning"
                variant="outlined"
                size="small"
                onDelete={item.referenceChange.source !== 'inquiry_item' ? (e) => {
                  e.stopPropagation();
                  onDeleteReference(item);
                } : undefined}
                deleteIcon={item.referenceChange.source !== 'inquiry_item' ? (
                  <IconButton size="small">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : undefined}
                icon={<SwapHorizIcon />}
              />
            </Tooltip>
            <Typography variant="caption" display="block">
              {item.referenceChange.source === 'inquiry_item' 
                ? 'Reference from inquiry'
                : getChangeSource(item.referenceChange)}
            </Typography>
          </Box>
        )}
        {item.isReferencedBy && item.referencingItems && (
          <Box sx={{ mt: item.hasReferenceChange ? 1 : 0 }}>
            {item.referencingItems.map((refItem, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: index > 0 ? 1 : 0 }}>
                {refItem.referenceChange && (
                  <Tooltip title={refItem.referenceChange.source === 'inquiry_item' 
                    ? 'Reference from inquiry'
                    : `Changed by ${refItem.referenceChange.supplierName || 'user'}`}>
                    <Chip
                      label={`← ${refItem.itemID}`}
                      color="success"
                      variant="outlined"
                      size="small"
                      icon={<SwapHorizIcon />}
                    />
                  </Tooltip>
                )}
                <Typography variant="caption" display="block">
                  {refItem.referenceChange?.source === 'inquiry_item'
                    ? 'Reference from inquiry'
                    : getChangeSource(refItem.referenceChange)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </TableCell>
      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(item);
            }}
            startIcon={<VisibilityIcon />}
            sx={{ 
              minWidth: '100px',
              padding: '8px 16px',
              '&:hover': { 
                backgroundColor: 'primary.dark',
                transform: 'scale(1.02)',
              },
              transition: 'all 0.2s',
              zIndex: 1,
            }}
          >
            View
          </Button>
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onEditItem(item);
            }}
            sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }}
          >
            <EditIcon />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={handleDelete}
            sx={{ 
              '&:hover': { 
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                color: 'error.main',
              },
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </TableCell>
    </MuiTableRow>
  );
}

export default TableRow;
