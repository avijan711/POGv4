import React from 'react';
import {
  Table,
  TableBody,
  TableContainer,
  TableRow,
  TableCell,
  Paper,
} from '@mui/material';
import ItemTableHeader from './ItemTableHeader';
import ItemTableRow from './ItemTableRow';

function ItemTable({ 
  items, 
  displayedItems, 
  getChangeSource, 
  onRowClick, 
  onEditItem, 
  onDeleteItem 
}) {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="inventory table">
        <ItemTableHeader />
        <TableBody>
          {displayedItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} align="center">
                No items found
              </TableCell>
            </TableRow>
          ) : (
            displayedItems.map((item, index) => {
              const isNewReference = items.some(otherItem => 
                otherItem.referenceChange && 
                otherItem.referenceChange.newReferenceID === item.itemID
              );

              const referencingItems = items.filter(otherItem => 
                otherItem.referenceChange && 
                otherItem.referenceChange.newReferenceID === item.itemID
              );

              return (
                <ItemTableRow
                  key={`${item.itemID}-${index}`}
                  item={item}
                  index={index}
                  isNewReference={isNewReference}
                  referencingItems={referencingItems}
                  getChangeSource={getChangeSource}
                  onRowClick={onRowClick}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                />
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ItemTable;
