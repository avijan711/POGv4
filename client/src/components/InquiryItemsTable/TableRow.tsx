import React, { useState, useEffect, useRef } from 'react';
import {
  TableRow as MuiTableRow,
  TableCell,
  Box,
  Typography,
  Tooltip,
  TextField,
  SxProps,
  Theme,
} from '@mui/material';
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import ReferenceChip from './ReferenceChip';
import ActionButtons from './ActionButtons';
import SupplierPriceChip from './SupplierPriceChip';
import { CustomTableRowProps } from '../../types/inquiry';

interface StyleProps {
  isDuplicate?: boolean;
  hasReferenceChange?: boolean;
  isReferencedBy?: boolean;
}

const styles: Record<string, (props: StyleProps) => SxProps<Theme>> = {
  row: (props) => ({
    backgroundColor: props.isDuplicate 
      ? 'rgba(255, 152, 0, 0.1)'
      : props.hasReferenceChange
        ? 'rgba(255, 243, 224, 0.9)'
        : props.isReferencedBy
          ? '#e8f5e9'
          : 'inherit',
    '&:hover': { 
      backgroundColor: props.isDuplicate
        ? 'rgba(255, 152, 0, 0.2)'
        : props.hasReferenceChange
          ? 'rgba(255, 243, 224, 1)' 
          : props.isReferencedBy
            ? '#c8e6c9'
            : 'rgba(0, 0, 0, 0.04)', 
    },
  }),
  idContainer: () => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  }),
  pricesContainer: () => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: '40px', // Ensure consistent height even when empty
  }),
};

const TableRow: React.FC<CustomTableRowProps> = ({
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
  onPriceUpdate,
}) => {
  const [tempQty, setTempQty] = useState<string | number>(item.requestedQty || 0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingQty === item.inquiryItemID && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingQty, item.inquiryItemID]);

  // Update tempQty when item changes or editing starts
  useEffect(() => {
    if (editingQty === item.inquiryItemID) {
      setTempQty(item.requestedQty || 0);
    }
  }, [editingQty, item.inquiryItemID, item.requestedQty]);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
      setTempQty(value);
      onEditQty(item.inquiryItemID, value);
    }
  };

  const handleQtyBlur = async () => {
    const newQty = Number(tempQty) || 0;
    const success = await onUpdateQty(item.inquiryItemID, newQty);
    if (!success) {
      setTempQty(item.requestedQty || 0);
    }
  };

  const handleQtyKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newQty = Number(tempQty) || 0;
      const success = await onUpdateQty(item.inquiryItemID, newQty);
      if (!success) {
        setTempQty(item.requestedQty || 0);
      }
    } else if (e.key === 'Escape') {
      setTempQty(item.requestedQty || 0);
      onEditQty(item.inquiryItemID, null);
    }
  };

  return (
    <MuiTableRow 
      onClick={() => !editingQty && onViewDetails(item)}
      sx={styles.row({ 
        isDuplicate: item.isDuplicate,
        hasReferenceChange: Boolean(item.hasReferenceChange && item.referenceChange),
        isReferencedBy: item.isReferencedBy,
      })}
    >
      <TableCell>{item.inquiryNumber || item.customNumber || (item.excelRowIndex || index) + 1}</TableCell>
      <TableCell>
        <Box sx={styles.idContainer({})}>
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
      <TableCell align="right">{Number(item.importMarkup || 0).toFixed(2)}</TableCell>
      <TableCell>{item.hsCode}</TableCell>
      <TableCell align="right">{item.qtyInStock || 0}</TableCell>
      <TableCell 
        align="right" 
        onClick={(e) => e.stopPropagation()}
      >
        {editingQty === item.inquiryItemID ? (
          <TextField
            type="number"
            size="small"
            value={tempQty}
            onChange={handleQtyChange}
            onBlur={handleQtyBlur}
            onKeyDown={handleQtyKeyPress}
            inputRef={inputRef}
            sx={{ width: '80px' }}
            inputProps={{
              min: 0,
              style: { textAlign: 'right' },
            }}
          />
        ) : (
          <Box 
            onClick={() => onEditQty(item.inquiryItemID)}
            sx={{ 
              cursor: 'text',
              padding: '8px',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
            }}
          >
            {item.requestedQty || 0}
          </Box>
        )}
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
      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <Box sx={styles.pricesContainer({})}>
          {item.supplierResponses?.length > 0 ? (
            item.supplierResponses.map((response, idx) => (
              <SupplierPriceChip
                key={`${response.supplier_id}-${idx}`}
                supplierPrice={response}
                item={item}
                onPriceUpdate={onPriceUpdate}
              />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No supplier prices
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell>
        {item.referenceChange && (
          <ReferenceChip
            reference_change={item.referenceChange}
            onDelete={() => onDeleteReference(item)}
            isReplacement={item.isReplacement || false}
          />
        )}
      </TableCell>
      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <ActionButtons
          onView={() => onViewDetails(item)}
          onEdit={() => onEditItem(item)}
          onDelete={(e: React.MouseEvent) => {
            e.stopPropagation();
            onDeleteItem(item);
          }}
        />
      </TableCell>
    </MuiTableRow>
  );
};

export default TableRow;