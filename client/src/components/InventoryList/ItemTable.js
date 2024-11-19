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
  const findReferencingItems = (itemId) => {
    // Find items that reference this item as their new reference
    // Filter out self-references
    return items.filter(otherItem => {
      // Parse referenceChange if it's a string
      const referenceChange = otherItem.referenceChange ? 
        (typeof otherItem.referenceChange === 'string' ? 
          JSON.parse(otherItem.referenceChange) : 
          otherItem.referenceChange) : null;

      return referenceChange && 
             referenceChange.newReferenceID === itemId && 
             otherItem.itemID !== itemId; // Exclude self-references
    });
  };

  const handleReferenceClick = (e, itemId) => {
    e.stopPropagation();
    // Find the referenced item
    const referencedItem = items.find(item => item.itemID === itemId);
    if (referencedItem) {
      onRowClick(referencedItem);
    }
  };

  const processItem = (item) => {
    // Parse referenceChange if it's a string
    const referenceChange = item.referenceChange ? 
      (typeof item.referenceChange === 'string' ? 
        JSON.parse(item.referenceChange) : 
        item.referenceChange) : null;

    // Find items that reference this item
    const referencingItems = findReferencingItems(item.itemID);
    const isNewReference = referencingItems.length > 0;

    // Check if this item has a self-reference
    const isSelfReferenced = referenceChange && referenceChange.newReferenceID === item.itemID;

    return {
      ...item,
      referenceChange: isSelfReferenced ? null : referenceChange, // Remove self-references
      hasReferenceChange: !isSelfReferenced && referenceChange !== null,
      isReferencedBy: isNewReference,
      referencingItems
    };
  };

  return (
    <TableContainer 
      component={Paper} 
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '& .MuiTable-root': {
          borderCollapse: 'separate',
          borderSpacing: 0,
        },
        '& .MuiTableHead-root': {
          position: 'sticky',
          top: 0,
          backgroundColor: '#fff',
          zIndex: 1,
        }
      }}
    >
      <Table 
        stickyHeader 
        sx={{ 
          minWidth: 1200,
          '& td, & th': {
            borderBottom: '1px solid rgba(224, 224, 224, 1)',
          }
        }}
        aria-label="inventory table"
      >
        <ItemTableHeader />
        <TableBody>
          {displayedItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                No items found
              </TableCell>
            </TableRow>
          ) : (
            displayedItems.map((item, index) => {
              const processedItem = processItem(item);
              const referencingItems = findReferencingItems(processedItem.itemID);
              const isNewReference = referencingItems.length > 0;

              return (
                <ItemTableRow
                  key={`${processedItem.itemID}-${index}`}
                  item={processedItem}
                  index={index}
                  isNewReference={isNewReference}
                  referencingItems={referencingItems}
                  getChangeSource={getChangeSource}
                  onRowClick={onRowClick}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                  onReferenceClick={handleReferenceClick}
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
