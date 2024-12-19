import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link,
  Button,
  CircularProgress
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { getDisplayPrice, calculateDiscount } from '../utils/priceUtils';
import { MissingItemsDialog } from './SupplierResponseList/dialogs/MissingItemsDialog';
import OrderCharts from './OrderCharts';

// Helper function to normalize item IDs for comparison
const normalizeItemId = (id) => id?.toString().toLowerCase();

// Helper function to get supplier group key
const getSupplierGroupKey = (supplierId, isPromotion, promotionGroupId) => 
  isPromotion ? `${supplierId}-${promotionGroupId}` : `${supplierId}-regular`;

const parseMissingItems = (missingItemsData) => {
  console.log('Parsing missing items:', {
    type: typeof missingItemsData,
    isArray: Array.isArray(missingItemsData),
    raw: missingItemsData
  });

  // If it's already an array of objects with the right structure, return it
  if (Array.isArray(missingItemsData) && missingItemsData.length > 0 && typeof missingItemsData[0] === 'object') {
    console.log('Using existing array:', missingItemsData);
    return missingItemsData;
  }

  // If it's a string, try parsing as JSON first
  if (typeof missingItemsData === 'string') {
    try {
      // Split by semicolon and parse each item as JSON
      const items = missingItemsData.split(';')
        .filter(Boolean)
        .map(item => {
          try {
            // Try parsing as JSON first
            return JSON.parse(item);
          } catch (e) {
            // If JSON parse fails, try parsing as delimited string
            const [
              item_id,
              hebrew_description,
              english_description,
              requested_qty,
              retail_price,
              origin
            ] = item.split('|').map(field => field?.trim());

            return {
              item_id,
              hebrew_description,
              english_description: english_description || '',
              requested_qty: parseInt(requested_qty, 10) || 0,
              retail_price: parseFloat(retail_price) || 0,
              origin: origin || ''
            };
          }
        });

      console.log('Parsed items from string:', {
        count: items.length,
        first: items[0]
      });

      return items;
    } catch (e) {
      console.error('Error parsing missing items string:', e);
      return [];
    }
  }

  console.log('No valid items found, returning empty array');
  return [];
};

const SuppliersView = ({
  supplierGroups,
  selectedSuppliers,
  calculateSupplierSummary,
  quantities,
  temporaryPrices,
  handleItemClick,
  shouldShowItem,
  eurToIls,
  responses,
  fetchMissingItems,
  prices = []
}) => {
  const [missingItemsDialogOpen, setMissingItemsDialogOpen] = useState(false);
  const [currentMissingItems, setCurrentMissingItems] = useState([]);
  const [currentSupplierName, setCurrentSupplierName] = useState('');
  const [orderLevelMissingItems, setOrderLevelMissingItems] = useState([]);
  const [totalUniqueItems, setTotalUniqueItems] = useState(0);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);

  // Calculate total unique items from supplier groups
  useEffect(() => {
    const uniqueItems = new Set();
    Object.entries(supplierGroups)
      .filter(([key]) => selectedSuppliers[key])
      .forEach(([_, group]) => {
        group.items.forEach(item => uniqueItems.add(normalizeItemId(item.ItemID)));
      });
    setTotalUniqueItems(uniqueItems.size);
  }, [supplierGroups, selectedSuppliers]);

  // Calculate items missing at the order level
  useEffect(() => {
    console.log('Calculating order level missing items');
    setIsLoadingResponses(true);

    // Debug log the input data
    console.log('Input data:', {
      supplierGroups: {
        count: Object.keys(supplierGroups).length,
        keys: Object.keys(supplierGroups),
        sample: supplierGroups[Object.keys(supplierGroups)[0]]
      },
      selectedSuppliers: {
        count: Object.keys(selectedSuppliers).length,
        selected: Object.entries(selectedSuppliers)
          .filter(([_, selected]) => selected)
          .map(([key]) => key)
      },
      responses: {
        count: Object.keys(responses || {}).length,
        keys: Object.keys(responses || {}),
        sample: responses?.[Object.keys(responses || {})[0]]
      }
    });
    
    // Get selected suppliers and their responses, considering promotion groups
    const selectedSupplierResponses = Object.entries(responses || {})
      .filter(([supplierId, data]) => {
        // Check if any group (regular or promotion) for this supplier is selected
        const isSelected = Object.entries(supplierGroups).some(([key, group]) => {
          const groupKey = getSupplierGroupKey(
            supplierId, 
            group.isPromotion, 
            group.promotionGroupId
          );
          const matches = selectedSuppliers[groupKey];
          console.log('Checking supplier group selection:', {
            supplierId,
            groupKey,
            isPromotion: group.isPromotion,
            promotionGroupId: group.promotionGroupId,
            isSelected: matches
          });
          return matches;
        });
        return isSelected;
      });

    console.log('Selected supplier responses:', {
      count: selectedSupplierResponses.length,
      suppliers: selectedSupplierResponses.map(([id, data]) => ({
        id,
        name: data.supplier_name,
        missing_count: data.missing_count,
        missing_items_length: Array.isArray(data.missing_items) ? data.missing_items.length : 'not array',
        missing_items_type: typeof data.missing_items,
        raw_missing_items: data.missing_items
      }))
    });

    if (selectedSupplierResponses.length === 0) {
      console.log('No selected supplier responses found');
      setOrderLevelMissingItems([]);
      setIsLoadingResponses(false);
      return;
    }

    // Get all covered items from selected suppliers
    const coveredItemIds = new Set();
    Object.entries(supplierGroups)
      .filter(([key]) => selectedSuppliers[key])
      .forEach(([_, group]) => {
        group.items.forEach(item => {
          const normalizedId = normalizeItemId(item.ItemID);
          console.log('Adding covered item:', {
            original: item.ItemID,
            normalized: normalizedId,
            group: group.supplierName,
            isPromotion: group.isPromotion,
            promotionName: group.promotionName
          });
          coveredItemIds.add(normalizedId);
        });
      });

    console.log('Covered items:', {
      count: coveredItemIds.size,
      items: Array.from(coveredItemIds)
    });

    // Find a supplier with missing items
    const supplierWithMissingItems = selectedSupplierResponses.find(([_, data]) => {
      const hasMissingItems = Array.isArray(data.missing_items) ? 
        data.missing_items.length > 0 : 
        data.missing_items?.length > 0;
      
      console.log('Checking supplier for missing items:', {
        name: data.supplier_name,
        missing_items_type: typeof data.missing_items,
        isArray: Array.isArray(data.missing_items),
        length: data.missing_items?.length,
        hasMissingItems
      });
      
      return hasMissingItems;
    });

    if (!supplierWithMissingItems) {
      console.log('No supplier found with missing items');
      setOrderLevelMissingItems([]);
      setIsLoadingResponses(false);
      return;
    }

    const [supplierId, supplierData] = supplierWithMissingItems;
    console.log('Found supplier with missing items:', {
      id: supplierId,
      name: supplierData.supplier_name,
      missing_items_type: typeof supplierData.missing_items,
      missing_items: supplierData.missing_items
    });

    // Use missing items directly from supplier data if it's already an array
    const allItems = Array.isArray(supplierData.missing_items) ?
      supplierData.missing_items :
      parseMissingItems(supplierData.missing_items);

    console.log('All items from supplier:', {
      count: allItems.length,
      sample: allItems[0],
      missing_items_type: typeof supplierData.missing_items,
      isArray: Array.isArray(supplierData.missing_items),
      raw_missing_items: supplierData.missing_items
    });

    // Filter to only items not covered by selected suppliers
    const uncoveredItems = allItems
      .filter(item => {
        const normalizedId = normalizeItemId(item.item_id);
        const isCovered = coveredItemIds.has(normalizedId);
        console.log('Checking item coverage:', {
          original: item.item_id,
          normalized: normalizedId,
          isCovered,
          coveredItemsCount: coveredItemIds.size
        });
        return !isCovered;
      })
      .sort((a, b) => a.item_id.localeCompare(b.item_id));

    console.log('Final uncovered items:', {
      count: uncoveredItems.length,
      sample: uncoveredItems[0],
      all_items_count: allItems.length,
      covered_items_count: coveredItemIds.size
    });

    setOrderLevelMissingItems(uncoveredItems);
    setIsLoadingResponses(false);
  }, [responses, selectedSuppliers, supplierGroups]);

  // Calculate grand total across all selected suppliers
  const grandTotal = Object.entries(supplierGroups)
    .filter(([key]) => selectedSuppliers[key])
    .reduce((total, [key, group]) => {
      const summary = calculateSupplierSummary(group, quantities, temporaryPrices);
      return total + summary.totalValue;
    }, 0);

  const handleShowMissingItems = async (supplierId, supplierName) => {
    const supplierResponse = responses[supplierId];
    // Use missing items directly if it's already an array
    const items = Array.isArray(supplierResponse?.missing_items) ?
      supplierResponse.missing_items :
      parseMissingItems(supplierResponse?.missing_items);

    console.log('Showing missing items for supplier:', {
      supplierId,
      supplierName,
      items_count: items.length,
      first_item: items[0],
      raw_missing_items: supplierResponse?.missing_items
    });
    setCurrentMissingItems(items);
    setCurrentSupplierName(supplierName);
    setMissingItemsDialogOpen(true);
  };

  const handleShowOrderLevelMissingItems = () => {
    console.log('Showing order level missing items:', {
      items_count: orderLevelMissingItems.length,
      first_item: orderLevelMissingItems[0],
      raw_items: orderLevelMissingItems
    });
    setCurrentMissingItems(orderLevelMissingItems);
    setCurrentSupplierName('Uncovered Items');
    setMissingItemsDialogOpen(true);
  };

  // Get total items from first supplier's total_expected_items
  const firstSupplier = Object.values(responses)[0];
  const totalInquiryItems = firstSupplier?.total_expected_items || 0;

  // Calculate covered items as total minus uncovered
  const coveredItems = totalInquiryItems - (orderLevelMissingItems?.length || 0);

  // Check if any suppliers are selected
  const hasSelectedSuppliers = Object.values(selectedSuppliers).some(selected => selected);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Grand Total Section - Only show when suppliers are selected */}
      {hasSelectedSuppliers && (
        <Box>
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h5" sx={{ color: '#1976d2', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 2 }}>
                Total Order Value: €{grandTotal.toFixed(2)}
                {totalInquiryItems > 0 && (
                  <Box 
                    component="span" 
                    sx={{ 
                      display: 'inline-flex', 
                      alignItems: 'center',
                      cursor: !isLoadingResponses ? 'pointer' : 'default',
                      '&:hover': !isLoadingResponses ? {
                        textDecoration: 'underline'
                      } : {},
                      bgcolor: isLoadingResponses ? 'grey.200' : 'warning.light',
                      px: 2,
                      py: 0.5,
                      borderRadius: 1,
                    }}
                    onClick={!isLoadingResponses ? handleShowOrderLevelMissingItems : undefined}
                  >
                    {isLoadingResponses ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography component="span">
                          Loading items coverage...
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Typography 
                          component="span" 
                          sx={{ 
                            color: 'warning.dark',
                            fontWeight: 'bold'
                          }}
                        >
                          {coveredItems} of {totalInquiryItems} items covered
                        </Typography>
                        <WarningIcon sx={{ ml: 1 }} />
                      </>
                    )}
                  </Box>
                )}
              </Typography>
            </Box>
          </Paper>

          {/* Add OrderCharts component */}
          <OrderCharts
            supplierGroups={supplierGroups}
            selectedSuppliers={selectedSuppliers}
            calculateSupplierSummary={calculateSupplierSummary}
            quantities={quantities}
            temporaryPrices={temporaryPrices}
          />
        </Box>
      )}

      {/* Individual Supplier Sections */}
      {Object.entries(supplierGroups)
        .filter(([key]) => selectedSuppliers[key])
        .map(([key, group]) => {
          const summary = calculateSupplierSummary(group, quantities, temporaryPrices);
          
          if (summary.winningItems === 0) return null;

          // Get missing items count for this supplier
          const supplierResponse = responses?.[group.supplierId];
          const missingCount = supplierResponse?.missing_count || 0;

          return (
            <Paper key={key} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName}
              </Typography>
              
              <Box sx={{ mb: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                <Typography>
                  Winning Items: {summary.winningItems} / {summary.totalItems}
                </Typography>
                <Typography>
                  Total Value: €{summary.totalValue.toFixed(2)}
                </Typography>
                {missingCount > 0 && (
                  <Button
                    startIcon={<WarningIcon />}
                    color="warning"
                    size="small"
                    onClick={() => handleShowMissingItems(group.supplierId, group.supplierName)}
                    sx={{
                      bgcolor: 'warning.light',
                      '&:hover': {
                        bgcolor: 'warning.main',
                      }
                    }}
                  >
                    {missingCount} missing items
                  </Button>
                )}
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item ID</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Requested Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Discount Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.winningItemsList
                      .filter(item => shouldShowItem(item.ItemID))
                      .map(item => {
                        const qty = quantities[item.ItemID] || item.RequestedQty;
                        const displayPrice = getDisplayPrice(item.ItemID, key, item.PriceQuoted, temporaryPrices);
                        const total = (displayPrice * qty) || 0;
                        const discount = calculateDiscount(
                          displayPrice,
                          parseFloat(item.ImportMarkup),
                          parseFloat(item.RetailPrice),
                          eurToIls
                        );

                        return (
                          <TableRow 
                            key={item.ItemID}
                            sx={{
                              backgroundColor: '#4caf5066',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <TableCell>
                              <Link
                                component="button"
                                variant="body2"
                                onClick={() => handleItemClick(item.ItemID)}
                                sx={{ textDecoration: 'none' }}
                              >
                                {item.ItemID}
                              </Link>
                            </TableCell>
                            <TableCell>{item.HebrewDescription}</TableCell>
                            <TableCell align="right">{qty}</TableCell>
                            <TableCell align="right">€{displayPrice?.toFixed(2) || 'N/A'}</TableCell>
                            <TableCell align="right">€{total.toFixed(2)}</TableCell>
                            <TableCell align="right">
                              {discount !== null ? `${discount.toFixed(1)}%` : ''}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          );
        })}

      {/* Missing Items Dialog */}
      <MissingItemsDialog
        open={missingItemsDialogOpen}
        onClose={() => setMissingItemsDialogOpen(false)}
        items={currentMissingItems}
        supplierName={currentSupplierName}
      />
    </Box>
  );
};

export default SuppliersView;
