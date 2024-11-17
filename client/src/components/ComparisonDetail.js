import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

import ItemDetailsDialog from './ItemDetailsDialog';
import ItemsView from './ItemsView';
import SuppliersView from './SuppliersView';
import ComparisonToolbar from './ComparisonToolbar';
import { useSupplierManagement } from '../hooks/useSupplierManagement';
import { 
  fetchSettings, 
  isWinningPrice, 
  getDisplayPrice,
  calculateDiscount 
} from '../utils/priceUtils';

function ComparisonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editingQty, setEditingQty] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [viewMode, setViewMode] = useState('items');
  const [editingPrice, setEditingPrice] = useState(null);
  const [temporaryPrices, setTemporaryPrices] = useState({});
  const [prices, setPrices] = useState([]);
  const [replacementItems, setReplacementItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replacementsError, setReplacementsError] = useState(null);
  const [eurToIls, setEurToIls] = useState(3.95);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [discountFilter, setDiscountFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    selectedSuppliers,
    supplierGroups,
    handleSupplierToggle,
    calculateSupplierSummary
  } = useSupplierManagement(prices);

  const initializeSettings = async () => {
    const rate = await fetchSettings();
    setEurToIls(rate);
  };

  const fetchItemDetails = async (itemId) => {
    try {
      console.log('Fetching details for item:', itemId);
      const response = await axios.get(`${API_BASE_URL}/api/items/${itemId}`);
      
      const priceData = prices.find(p => p.ItemID === itemId);
      const replacement = replacementItems[itemId];
      
      console.log('Found replacement data:', {
        itemId,
        replacement,
        allReplacements: replacementItems
      });

      // Check if this item is referenced by others
      const isReferencedBy = Object.entries(replacementItems).some(([originalId, rep]) => 
        rep.newItemId === itemId
      );

      // Get referencing items if any
      const referencingItems = Object.entries(replacementItems)
        .filter(([originalId, rep]) => rep.newItemId === itemId)
        .map(([originalId, rep]) => ({
          itemID: originalId,
          referenceChange: {
            source: rep.source,
            supplierName: rep.supplierName,
            changeDate: rep.changeDate,
            notes: rep.description,
            originalDescription: rep.originalDescription,
            newDescription: rep.newDescription
          }
        }));

      // Debug log the reference data
      console.log('Reference data for item', itemId, ':', {
        fromAPI: response.data.item?.referenceChange,
        fromReplacements: replacement,
        isReferencedBy,
        referencingItems
      });
      
      const itemData = {
        ...response.data,
        item: {
          ...response.data.item,
          itemID: itemId,
          hebrewDescription: priceData?.HebrewDescription || response.data.item?.hebrewDescription,
          englishDescription: priceData?.EnglishDescription || response.data.item?.englishDescription,
          hsCode: priceData?.HSCode || response.data.item?.hsCode,
          importMarkup: priceData?.ImportMarkup || response.data.item?.importMarkup,
          retailPrice: priceData?.RetailPrice || response.data.item?.retailPrice,
          qtyInStock: priceData?.QtyInStock || response.data.item?.qtyInStock,
          soldThisYear: priceData?.SoldThisYear || response.data.item?.soldThisYear,
          soldLastYear: priceData?.SoldLastYear || response.data.item?.soldLastYear,
          hasReferenceChange: !!response.data.item?.referenceChange || !!replacement,
          referenceChange: response.data.item?.referenceChange || (replacement ? {
            newReferenceID: replacement.newItemId,
            source: replacement.source,
            supplierName: replacement.supplierName,
            changeDate: replacement.changeDate,
            notes: replacement.description,
            originalDescription: replacement.originalDescription,
            newDescription: replacement.newDescription
          } : null),
          isReferencedBy: response.data.item?.isReferencedBy || isReferencedBy,
          referencingItems: response.data.item?.referencingItems || referencingItems
        }
      };

      console.log('Constructed item data:', itemData);
      setSelectedItem(itemData);
      setItemDetailsOpen(true);
    } catch (err) {
      console.error('Error fetching item details:', err);
      setError('Failed to load item details');
    }
  };

  const handleItemClick = (itemId) => {
    fetchItemDetails(itemId);
  };

  const handleCloseItemDetails = () => {
    setItemDetailsOpen(false);
    setSelectedItem(null);
  };

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      setError(null);
      setReplacementsError(null);
      
      // First get the prices data
      console.log('Fetching prices for inquiry:', id);
      const pricesResponse = await axios.get(`${API_BASE_URL}/api/orders/best-prices/${id}`);
      const processedData = pricesResponse.data.map(item => ({
        ...item,
        ImportMarkup: Number(item.ImportMarkup) || 1.3,
        RetailPrice: Number(item.RetailPrice) || 0,
        PriceQuoted: Number(item.PriceQuoted) || 0
      }));

      console.log('Processed prices data:', processedData);
      setPrices(processedData);

      // Then try to get the replacements data
      try {
        console.log('Fetching replacements for inquiry:', id);
        const replacementsResponse = await axios.get(`${API_BASE_URL}/api/orders/${id}/replacements`);
        console.log('Raw replacements response:', replacementsResponse.data);
        
        // Process replacements data
        const replacementsMap = {};
        replacementsResponse.data.forEach(replacement => {
          if (replacement.originalItemId && replacement.newItemId) {
            console.log('Processing replacement:', replacement);
            replacementsMap[replacement.originalItemId] = {
              newItemId: replacement.newItemId,
              source: replacement.source,
              supplierName: replacement.supplierName,
              description: replacement.description,
              changeDate: replacement.changeDate,
              originalDescription: replacement.originalDescription,
              newDescription: replacement.newDescription,
              inquiryDescription: replacement.inquiryDescription
            };
          }
        });

        // Debug log the replacements data
        console.log('Final replacements map:', replacementsMap);
        setReplacementItems(replacementsMap);
      } catch (err) {
        console.error('Error fetching replacements:', err);
        if (err.response?.status === 404) {
          setReplacementsError('No replacements found for this inquiry');
          setReplacementItems({});
        } else {
          console.error('Failed to fetch replacements:', err);
          setReplacementsError('Failed to load replacement items');
        }
      }
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      if (err.response?.status === 404) {
        setError('Inquiry not found');
      } else {
        setError('Failed to load comparison data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchComparisonData();
      initializeSettings();
    }
  }, [id]);

  const handleQuantityChange = (itemId, value) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handlePriceChange = (itemId, supplierKey, value) => {
    const priceKey = `${itemId}-${supplierKey}`;
    setTemporaryPrices(prev => ({
      ...prev,
      [priceKey]: parseFloat(value) || 0
    }));
  };

  const shouldShowItem = (itemId) => {
    if (searchQuery) {
      const item = prices.find(item => item.ItemID === itemId);
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        itemId.toLowerCase().includes(searchLower) ||
        (item?.HebrewDescription || '').toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    if (!discountFilter) return true;
    
    const filterValue = parseFloat(discountFilter);
    if (isNaN(filterValue)) return true;

    let maxDiscount = -Infinity;
    Object.entries(supplierGroups)
      .filter(([key]) => selectedSuppliers[key])
      .forEach(([key, group]) => {
        const supplierItem = group.items.find(item => item.ItemID === itemId);
        if (supplierItem) {
          const displayPrice = getDisplayPrice(itemId, key, supplierItem.PriceQuoted, temporaryPrices);
          const discount = calculateDiscount(
            displayPrice,
            Number(supplierItem.ImportMarkup),
            Number(supplierItem.RetailPrice),
            eurToIls
          );
          if (discount !== null) {
            maxDiscount = Math.max(maxDiscount, discount);
          }
        }
      });
    return maxDiscount !== -Infinity && maxDiscount < filterValue;
  };

  const handleCreateOrders = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/orders/from-inquiry/${id}`, {
        selectedSuppliers,
        quantities,
        prices: temporaryPrices
      });
      navigate('/orders');
    } catch (err) {
      console.error('Error creating orders:', err);
      setError('Failed to create orders');
    }
  };

  const uniqueItems = Array.from(new Set(prices?.map(item => item.ItemID))) || [];
  const filteredItems = uniqueItems.filter(shouldShowItem);

  // Debug log the current state
  console.log('Current state:', {
    prices,
    replacementItems,
    filteredItems,
    uniqueItems
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {replacementsError && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {replacementsError}
        </Alert>
      )}

      <ComparisonToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        discountFilter={discountFilter}
        setDiscountFilter={setDiscountFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleCreateOrders={handleCreateOrders}
        selectedSuppliers={selectedSuppliers}
        supplierGroups={supplierGroups}
        handleSupplierToggle={handleSupplierToggle}
      />

      {viewMode === 'items' ? (
        <ItemsView
          filteredItems={filteredItems}
          prices={prices}
          supplierGroups={supplierGroups}
          selectedSuppliers={selectedSuppliers}
          editingQty={editingQty}
          setEditingQty={setEditingQty}
          quantities={quantities}
          handleQuantityChange={handleQuantityChange}
          editingPrice={editingPrice}
          setEditingPrice={setEditingPrice}
          temporaryPrices={temporaryPrices}
          handlePriceChange={handlePriceChange}
          handleItemClick={handleItemClick}
          eurToIls={eurToIls}
          replacementItems={replacementItems}
        />
      ) : (
        <SuppliersView
          supplierGroups={supplierGroups}
          selectedSuppliers={selectedSuppliers}
          calculateSupplierSummary={calculateSupplierSummary}
          quantities={quantities}
          temporaryPrices={temporaryPrices}
          handleItemClick={handleItemClick}
          shouldShowItem={shouldShowItem}
          eurToIls={eurToIls}
        />
      )}

      <ItemDetailsDialog
        open={itemDetailsOpen}
        onClose={handleCloseItemDetails}
        item={selectedItem}
        showReferenceDetails={true}
      />
    </Box>
  );
}

export default ComparisonDetail;
