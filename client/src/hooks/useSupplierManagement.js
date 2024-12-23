import { useState, useEffect } from 'react';
import { isWinningPrice } from '../utils/priceUtils';

export const useSupplierManagement = (prices) => {
  const [selectedSuppliers, setSelectedSuppliers] = useState({});

  // Get all unique suppliers from prices that have them
  const allSuppliers = (prices || []).reduce((acc, item) => {
    if (!item.SupplierID) return acc;
    const key = item.IsPromotion
      ? `${item.SupplierID}-${item.PromotionGroupID}`
      : `${item.SupplierID}-regular`;

    if (!acc[key]) {
      acc[key] = {
        supplierId: item.SupplierID,
        supplierName: item.SupplierName,
        isPromotion: item.IsPromotion || false,
        promotionName: item.PromotionName,
        promotionGroupId: item.PromotionGroupID
      };
    }
    return acc;
  }, {});

  const supplierGroups = Object.entries(allSuppliers).reduce((groups, [key, supplier]) => {
    groups[key] = {
      ...supplier,
      items: []
    };

    // Add all items to this supplier group
    (prices || []).forEach(item => {
      // If item has this supplier's price, use it
      if (item.SupplierID === supplier.supplierId &&
          ((!item.IsPromotion && !supplier.isPromotion) ||
           (item.IsPromotion && item.PromotionGroupID === supplier.promotionGroupId))) {
        groups[key].items.push(item);
      }
      // If item has no price for this supplier, add it with minimal data
      else if (!item.SupplierID || item.SupplierID !== supplier.supplierId) {
        groups[key].items.push({
          ...item,
          SupplierID: supplier.supplierId,
          SupplierName: supplier.supplierName,
          IsPromotion: supplier.isPromotion,
          PromotionName: supplier.promotionName,
          PromotionGroupID: supplier.promotionGroupId,
          PriceQuoted: null
        });
      }
    });

    return groups;
  }, {});

  // Only update selected suppliers when prices change
  useEffect(() => {
    if (prices?.length > 0) {
      const initial = Object.keys(supplierGroups).reduce((acc, key) => ({
        ...acc,
        [key]: true
      }), {});
      setSelectedSuppliers(initial);
    }
  }, [prices, supplierGroups]); // Include supplierGroups in dependencies

  const handleSupplierToggle = (key) => {
    setSelectedSuppliers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const calculateSupplierSummary = (group, quantities, temporaryPrices) => {
    const winningItems = group.items.filter(item => 
      isWinningPrice(
        temporaryPrices[`${item.ItemID}-${group.supplierId}`] || item.PriceQuoted,
        item.ItemID,
        supplierGroups,
        selectedSuppliers,
        temporaryPrices
      )
    );

    const totalValue = winningItems.reduce((sum, item) => {
      const qty = quantities[item.ItemID] || item.RequestedQty;
      const price = temporaryPrices[`${item.ItemID}-${group.supplierId}`] || item.PriceQuoted;
      return sum + (price * qty || 0);
    }, 0);

    return {
      totalItems: group.items.length,
      winningItems: winningItems.length,
      totalValue,
      winningItemsList: winningItems
    };
  };

  return {
    selectedSuppliers,
    supplierGroups,
    handleSupplierToggle,
    calculateSupplierSummary
  };
};
