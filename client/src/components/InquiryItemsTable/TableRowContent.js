import React from 'react';
import { TableRow, TableCell, Box, Button, IconButton, Tooltip, Chip } from '@mui/material';
import { Edit as EditIcon, Visibility as VisibilityIcon, Delete as DeleteIcon, ContentCopy as ContentCopyIcon, LocalOffer as LocalOfferIcon } from '@mui/icons-material';
import QuantityCell from './QuantityCell';
import SupplierPriceChip from './SupplierPriceChip';
import ReferenceChip from './ReferenceChip';

function TableRowContent({
  item,
  index,
  editingQty,
  editedQty,
  onEditQty,
  onQtyChange,
  onQtyKeyPress,
  onSaveQty,
  onCancelEdit,
  onViewDetails,
  onEditItem,
  onDeleteItem,
  onDeleteReference,
  processSupplierPrices
}) {
  const supplierPrices = processSupplierPrices(item);
  const isReplacement = item.is_referenced_by === 1;

  return (
    <TableRow 
      onClick={() => {
        if (editingQty !== item.inquiry_item_id) {
          onViewDetails(item);
        }
      }}
      sx={{ 
        backgroundColor: item.is_duplicate 
          ? 'rgba(255, 152, 0, 0.1)'
          : item.has_reference_change && item.reference_change
            ? isReplacement 
              ? 'rgba(76, 175, 80, 0.1)'
              : 'rgba(244, 67, 54, 0.1)'
            : item.is_referenced_by
              ? '#e8f5e9'
              : item.promotion_id
                ? 'rgba(156, 39, 176, 0.1)'
                : 'inherit',
        '&:hover': { 
          backgroundColor: item.is_duplicate
            ? 'rgba(255, 152, 0, 0.2)'
            : item.has_reference_change && item.reference_change
              ? isReplacement
                ? 'rgba(76, 175, 80, 0.2)'
                : 'rgba(244, 67, 54, 0.2)'
              : item.is_referenced_by
                ? '#c8e6c9'
                : item.promotion_id
                  ? 'rgba(156, 39, 176, 0.2)'
                  : 'rgba(0, 0, 0, 0.04)' 
        },
        cursor: editingQty === item.inquiry_item_id ? 'default' : 'pointer',
      }}
    >
      <TableCell>{(item.excel_row_index || index) + 1}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {item.item_id}
          {item.is_duplicate && (
            <Tooltip title={`Duplicate of row ${(item.original_row_index || 0) + 1}`}>
              <ContentCopyIcon color="warning" fontSize="small" />
            </Tooltip>
          )}
        </Box>
      </TableCell>
      <TableCell>{item.hebrew_description}</TableCell>
      <TableCell>{item.english_description}</TableCell>
      <TableCell 
        align="right" 
        onClick={(e) => e.stopPropagation()}
        sx={{ minWidth: '180px' }}
      >
        <QuantityCell
          item={item}
          editingQty={editingQty}
          editedQty={editedQty}
          onEditQty={onEditQty}
          onQtyChange={onQtyChange}
          onQtyKeyPress={onQtyKeyPress}
          onSaveQty={onSaveQty}
          onCancelEdit={onCancelEdit}
        />
      </TableCell>
      <TableCell align="right">{item.qty_in_stock || 0}</TableCell>
      <TableCell align="right">₪{Number(item.retail_price).toFixed(2)}</TableCell>
      <TableCell align="right">{item.sold_this_year || 0}</TableCell>
      <TableCell align="right">{item.sold_last_year || 0}</TableCell>
      <TableCell align="right">{Number(item.import_markup).toFixed(2)}</TableCell>
      <TableCell>{item.hs_code}</TableCell>
      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <ReferenceChip
          reference_change={item.reference_change}
          onDelete={() => onDeleteReference(item)}
          isReplacement={isReplacement}
        />
      </TableCell>
      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(() => {
              const soldThisYear = Number(item.sold_this_year || 0);
              const soldLastYear = Number(item.sold_last_year || 0);
              const requestedQty = Number(item.requested_qty || 0);

              // If no sales history, treat as new item
              if (soldThisYear === 0 && soldLastYear === 0) {
                return (
                  <Tooltip title="New item - no sales history">
                    <Chip
                      label="New"
                      color="info"
                      size="small"
                      sx={{
                        height: '24px',
                        '& .MuiChip-label': {
                          fontSize: '0.75rem',
                          px: 1,
                        }
                      }}
                    />
                  </Tooltip>
                );
              }

              const avgSales = (soldThisYear + soldLastYear) / 2;
              const threshold = avgSales * 1.5;
              
              let color = 'success';
              let message = 'OK';
              
              if (requestedQty > threshold) {
                color = 'error';
                message = 'High';
              }
              
              return (
                <Tooltip title={`Average sales: ${avgSales.toFixed(0)} units/year. Threshold: ${threshold.toFixed(0)} units`}>
                  <Chip
                    label={message}
                    color={color}
                    size="small"
                    sx={{
                      height: '24px',
                      '& .MuiChip-label': {
                        fontSize: '0.75rem',
                        px: 1,
                      }
                    }}
                  />
                </Tooltip>
              );
            })()}
            <IconButton
              size="small"
              onClick={() => onEditItem(item)}
              sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onDeleteItem(item)}
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
        </Box>
      </TableCell>
    </TableRow>
  );
}

export default TableRowContent;
