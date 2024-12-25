import { useState, useCallback } from 'react';
import { InquiryItem, InquiryFiltersResult } from '../types/inquiry';

export enum QtyIndicator {
  OK = 'OK',
  NEW = 'NEW',
  HIGH = 'HIGH',
}

export const useInquiryFilters = (items: InquiryItem[]): InquiryFiltersResult => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showReplacements, setShowReplacements] = useState(false);
  const [qtyIndicatorFilter, setQtyIndicatorFilter] = useState<QtyIndicator | null>(null);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: '',
    direction: 'asc',
  });

  const toggleDuplicates = useCallback(() => {
    setShowDuplicates(prev => !prev);
  }, []);

  const toggleReplacements = useCallback(() => {
    setShowReplacements(prev => !prev);
  }, []);

  const handleSort = useCallback((field: string) => {
    setSortConfig(prevConfig => ({
      field,
      direction:
        prevConfig.field === field && prevConfig.direction === 'asc'
          ? 'desc'
          : 'asc',
    }));
  }, []);

  const getQtyIndicator = useCallback((item: InquiryItem | null): QtyIndicator | null => {
    if (!item) return null;

    const inStock = item.qtyInStock || 0;
    const requested = item.requestedQty || 0;

    if (inStock === 0 && requested > 0) {
      return QtyIndicator.NEW;
    } else if (requested > inStock) {
      return QtyIndicator.HIGH;
    } else if (requested > 0 && requested <= inStock) {
      return QtyIndicator.OK;
    }

    return null;
  }, []);

  const filteredAndSortedItems = items
    .filter(item => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          item.itemID?.toLowerCase().includes(searchLower) ||
          item.hebrewDescription?.toLowerCase().includes(searchLower) ||
          item.englishDescription?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter(item => {
      // Apply duplicate filter
      if (!showDuplicates && item.isDuplicate) {
        return false;
      }
      return true;
    })
    .filter(item => {
      // Apply replacement filter
      if (!showReplacements && item.isReplacement) {
        return false;
      }
      return true;
    })
    .filter(item => {
      // Apply quantity indicator filter
      if (qtyIndicatorFilter) {
        return getQtyIndicator(item) === qtyIndicatorFilter;
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortConfig.field) return 0;

      const aValue = a[sortConfig.field as keyof InquiryItem];
      const bValue = b[sortConfig.field as keyof InquiryItem];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
      return aValue < bValue ? -1 * multiplier : 1 * multiplier;
    });

  return {
    searchTerm,
    setSearchTerm,
    showDuplicates,
    showReplacements,
    sortConfig,
    toggleDuplicates,
    toggleReplacements,
    handleSort,
    filteredAndSortedItems,
    qtyIndicatorFilter,
    setQtyIndicatorFilter,
  };
};