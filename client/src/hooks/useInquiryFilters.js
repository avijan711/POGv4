import { useState, useMemo } from 'react';

export const QTY_INDICATORS = {
  OK: 'OK',
  NEW: 'NEW',
  HIGH: 'HIGH',
};

export const useInquiryFilters = (items = []) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showReplacements, setShowReplacements] = useState(false);
  const [qtyIndicatorFilter, setQtyIndicatorFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState({ field: 'item_id', direction: 'asc' });

  const getQtyIndicator = (item) => {
    if (!item) return null;
    const soldThisYear = Number(item.sold_this_year || 0);
    const soldLastYear = Number(item.sold_last_year || 0);
    const requestedQty = Number(item.requested_qty || 0);

    // If no sales history, treat as new item
    if (soldThisYear === 0 && soldLastYear === 0) {
      return QTY_INDICATORS.NEW;
    }

    const avgSales = (soldThisYear + soldLastYear) / 2;
    const threshold = avgSales * 1.5;

    if (requestedQty > threshold) {
      return QTY_INDICATORS.HIGH;
    }

    return QTY_INDICATORS.OK;
  };

  const toggleDuplicates = () => {
    setShowDuplicates(!showDuplicates);
    if (showReplacements) setShowReplacements(false);
  };

  const toggleReplacements = () => {
    setShowReplacements(!showReplacements);
    if (showDuplicates) setShowDuplicates(false);
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const searchInObject = (obj, searchTerm) => {
    if (!obj) return false;
    
    // Convert searchTerm to lowercase for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase();
    
    return Object.entries(obj).some(([key, value]) => {
      // Skip certain keys that shouldn't be searched
      if (['excel_row_index', 'original_row_index', 'is_duplicate'].includes(key)) {
        return false;
      }

      if (value == null) return false;

      // Handle different value types
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          // Search in array elements
          return value.some(item => searchInObject(item, searchTerm));
        }
        // Search in nested object
        return searchInObject(value, searchTerm);
      }

      // Convert value to string and search
      const stringValue = String(value).toLowerCase();
      return stringValue.includes(searchTermLower);
    });
  };

  const filteredAndSortedItems = useMemo(() => {
    if (!Array.isArray(items)) {
      console.warn('Items is not an array:', items);
      return [];
    }

    // First, filter items based on search term
    let filtered = items;
    if (searchTerm) {
      filtered = items.filter(item => searchInObject(item, searchTerm));
    }

    // Create map of duplicate items
    const duplicateItems = filtered.reduce((acc, item) => {
      if (!item || !item.item_id) return acc;
      
      const key = item.item_id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});

    // Apply duplicate/replacement filters
    if (showDuplicates) {
      filtered = filtered.filter(item => item && item.item_id && duplicateItems[item.item_id].length > 1);
    } else if (showReplacements) {
      filtered = filtered.filter(item => item && (item.has_reference_change || item.is_referenced_by));
    }

    // Apply qty indicator filter
    if (qtyIndicatorFilter) {
      filtered = filtered.filter(item => getQtyIndicator(item) === qtyIndicatorFilter);
    }

    // Sort items with proper null checks
    return [...filtered].sort((a, b) => {
      if (!a || !b) return 0;
      
      let aValue = a[sortConfig.field];
      let bValue = b[sortConfig.field];

      // Handle numeric fields
      if (['import_markup', 'qty_in_stock', 'requested_qty', 'retail_price'].includes(sortConfig.field)) {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else {
        // Convert to string only if the value exists
        aValue = aValue != null ? String(aValue) : '';
        bValue = bValue != null ? String(bValue) : '';
      }

      if (aValue === bValue) {
        // If values are equal, sort by Excel row index as secondary sort
        return (a.excel_row_index || 0) - (b.excel_row_index || 0);
      }
      return sortConfig.direction === 'asc'
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1;
    });
  }, [items, searchTerm, showDuplicates, showReplacements, qtyIndicatorFilter, sortConfig]);

  return {
    searchTerm,
    setSearchTerm,
    showDuplicates,
    showReplacements,
    qtyIndicatorFilter,
    setQtyIndicatorFilter,
    sortConfig,
    toggleDuplicates,
    toggleReplacements,
    handleSort,
    filteredAndSortedItems,
    getQtyIndicator,
  };
};
