import React from 'react';
import { TableCell } from '@mui/material';
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
        backgroundColor: '#f5f5f5',
        fontWeight: 'bold',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
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

export default SortableTableCell;
