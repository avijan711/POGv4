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
      const referenceChange = otherItem.reference_change ? 
        (typeof otherItem.reference_change === 'string' ? 
          JSON.parse(otherItem.reference_change) : 
          otherItem.reference_change) : null;

      return referenceChange && 
             referenceChange.new_reference_id === itemId && 
             otherItem.item_id !== itemId; // Exclude self-references
    });
  };

  const handleReferenceClick = (e, itemId) => {
    e.stopPropagation();
    // Find the referenced item
    const referencedItem = items.find(item => item.item_id === itemId);
    if (referencedItem) {
      onRowClick(referencedItem);
    }
  };

  const processItem = (item) => {
    // Parse referenceChange if it's a string
    const referenceChange = item.reference_change ? 
      (typeof item.reference_change === 'string' ? 
        JSON.parse(item.reference_change) : 
        item.reference_change) : null;

    // Find items that reference this item
    const referencingItems = findReferencingItems(item.item_id);
    const isNewReference = referencingItems.length > 0;

    // Check if this item has a self-reference
    const isSelfReferenced = referenceChange && referenceChange.new_reference_id === item.item_id;

    return {
      ...item,
      reference_change: isSelfReferenced ? null : referenceChange, // Remove self-references
      has_reference_change: !isSelfReferenced && referenceChange !== null,
      is_referenced_by: isNewReference,
      referencing_items: referencingItems
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
              const referencingItems = findReferencingItems(processedItem.item_id);
              const isNewReference = referencingItems.length > 0;

              return (
                <ItemTableRow
                  key={`${processedItem.item_id}-${index}`}
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
