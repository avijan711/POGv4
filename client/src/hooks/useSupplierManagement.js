import { useState, useEffect } from 'react';
import { isWinningPrice } from '../utils/priceUtils';

export const useSupplierManagement = (prices) => {
  const [selectedSuppliers, setSelectedSuppliers] = useState({});

  // Filter out items without supplier data
  const validPrices = prices?.filter(item => item.SupplierID != null) || [];

  const allSuppliers = validPrices.reduce((acc, item) => {
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

  const supplierGroups = validPrices.reduce((groups, item) => {
    const key = item.IsPromotion
      ? `${item.SupplierID}-${item.PromotionGroupID}`
      : `${item.SupplierID}-regular`;

    if (!groups[key]) {
      groups[key] = {
        ...allSuppliers[key],
        items: []
      };
    }
    groups[key].items.push(item);
    return groups;
  }, {}) || {};

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
