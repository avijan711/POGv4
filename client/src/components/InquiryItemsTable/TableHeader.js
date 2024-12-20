import React from 'react';
import { TableHead, TableRow, TableCell } from '@mui/material';
import { ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';

function SortableTableCell({ field, children, align = 'left', currentSort, onSort }) {
  const isCurrentField = currentSort.field === field;
  
  return (
    <TableCell
      align={align}
      onClick={() => onSort(field)}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
        position: 'relative',
        paddingRight: isCurrentField ? '24px' : '16px',
        '& .sort-icon': {
          position: 'absolute',
          right: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
        },
      }}
    >
      {children}
      {isCurrentField && (
        <span className="sort-icon">
          {currentSort.direction === 'asc' ? (
            <ArrowUpwardIcon fontSize="small" />
          ) : (
            <ArrowDownwardIcon fontSize="small" />
          )}
        </span>
      )}
    </TableCell>
  );
}

function TableHeader({ sortConfig, onSort }) {
  return (
    <TableHead>
      <TableRow>
        <TableCell>#</TableCell>
        <SortableTableCell
          field="itemID"
          currentSort={sortConfig}
          onSort={onSort}
        >
          Item ID
        </SortableTableCell>
        <SortableTableCell
          field="hebrewDescription"
          currentSort={sortConfig}
          onSort={onSort}
        >
          Hebrew Description
        </SortableTableCell>
        <SortableTableCell
          field="englishDescription"
          currentSort={sortConfig}
          onSort={onSort}
        >
          English Description
        </SortableTableCell>
        <SortableTableCell
          field="importMarkup"
          align="right"
          currentSort={sortConfig}
          onSort={onSort}
        >
          Import Markup
        </SortableTableCell>
        <SortableTableCell
          field="hsCode"
          currentSort={sortConfig}
          onSort={onSort}
        >
          HS Code
        </SortableTableCell>
        <SortableTableCell
          field="qtyInStock"
          align="right"
          currentSort={sortConfig}
          onSort={onSort}
        >
          Stock
        </SortableTableCell>
        <SortableTableCell
          field="requestedQty"
          align="right"
          currentSort={sortConfig}
          onSort={onSort}
        >
          Requested Qty
        </SortableTableCell>
        <SortableTableCell
          field="retailPrice"
          align="right"
          currentSort={sortConfig}
          onSort={onSort}
        >
          Retail Price (ILS)
        </SortableTableCell>
        <TableCell>Reference</TableCell>
        <TableCell align="center">Actions</TableCell>
      </TableRow>
    </TableHead>
  );
}

export default TableHeader;
