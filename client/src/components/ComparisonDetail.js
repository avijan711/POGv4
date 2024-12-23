import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

import ItemDetailsDialogWrapper from './ItemDetailsDialogWrapper';
import ItemsView from './ItemsView';
import SuppliersView from './SuppliersView';
import ComparisonToolbar from './ComparisonToolbar';
import { useSupplierManagement } from '../hooks/useSupplierManagement';
import { useSupplierResponses } from '../hooks/useSupplierResponses';
import { useSettings } from '../hooks/useSettings';
import { useSupplierPrices } from '../hooks/useSupplierPrices';
import { 
  isWinningPrice, 
  getDisplayPrice,
  calculateDiscount 
} from '../utils/priceUtils';

const EXCHANGE_RATE_KEY = 'eurToIls';
const DEFAULT_RATE = 3.95;

function ComparisonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getSettingValue } = useSettings();
  const [editingQty, setEditingQty] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [viewMode, setViewMode] = useState('items');
  const [editingPrice, setEditingPrice] = useState(null);
  const [temporaryPrices, setTemporaryPrices] = useState({});
  const [prices, setPrices] = useState([]);
  const [replacementItems, setReplacementItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Use the supplier prices hook at component level
  const {
    updatePrice,
    updating,
    updateError
  } = useSupplierPrices(selectedItemId);
  const [replacementsError, setReplacementsError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [discountFilter, setDiscountFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Get exchange rate from settings
  const eurToIls = getSettingValue(EXCHANGE_RATE_KEY, DEFAULT_RATE);

  const {
    selectedSuppliers,
    supplierGroups,
    handleSupplierToggle,
    calculateSupplierSummary
  } = useSupplierManagement(prices);

  // Add supplier responses hook for missing items
  const { responses, fetchMissingItems } = useSupplierResponses(id);

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
      setError(err.response?.data?.error || 'Failed to load item details');
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
    if (!id) {
      console.log('No inquiry ID provided, redirecting to comparisons list');
      navigate('/comparisons');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setReplacementsError(null);
      
      // First get the prices data
      console.log('Fetching prices for inquiry:', id);
      const pricesResponse = await axios.get(`${API_BASE_URL}/api/orders/best-prices/${id}`);
      const processedData = (pricesResponse.data || []).map(item => ({
        ...item,
        ImportMarkup: Number(item.ImportMarkup) || 1.3,
        RetailPrice: Number(item.RetailPrice) || 0,
        PriceQuoted: Number(item.PriceQuoted) || 0
      }));

      // Debug log the processed data with focus on promotions
      console.log('Processed prices data:', {
        count: processedData.length,
        regularPrices: processedData.filter(p => !p.IsPromotion).length,
        promotionalPrices: processedData.filter(p => p.IsPromotion).length,
        promotions: [...new Set(processedData.filter(p => p.IsPromotion).map(p => p.PromotionName))],
        sample: processedData.length > 0 ? {
          ItemID: processedData[0].ItemID,
          RetailPrice: processedData[0].RetailPrice,
          PriceQuoted: processedData[0].PriceQuoted,
          ImportMarkup: processedData[0].ImportMarkup,
          IsPromotion: processedData[0].IsPromotion,
          PromotionName: processedData[0].PromotionName,
          PromotionGroupID: processedData[0].PromotionGroupID
        } : null
      });

      setPrices(processedData);

      // Then try to get the replacements data
      try {
        console.log('Fetching replacements for inquiry:', id);
        const replacementsResponse = await axios.get(`${API_BASE_URL}/api/orders/${id}/replacements`);
        console.log('Raw replacements response:', replacementsResponse.data);
        
        // Process replacements data
        const replacementsMap = {};
        (replacementsResponse.data || []).forEach(replacement => {
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
        console.log('Final replacements map:', {
          count: Object.keys(replacementsMap).length,
          sample: Object.keys(replacementsMap).length > 0 ? 
            replacementsMap[Object.keys(replacementsMap)[0]] : null
        });
        setReplacementItems(replacementsMap);
      } catch (err) {
        console.error('Error fetching replacements:', err);
        if (err.response?.status === 404) {
          setReplacementsError('No replacements found for this inquiry');
          setReplacementItems({});
        } else {
          console.error('Failed to fetch replacements:', err);
          setReplacementsError(err.response?.data?.error || 'Failed to load replacement items');
        }
      }
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.details ||
                          'Failed to load comparison data';
      
      if (err.response?.status === 404) {
        setError('Inquiry not found or has no supplier responses');
        navigate('/comparisons');
      } else {
        setError(`${errorMessage}. Please try again later.`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisonData();
  }, [id, navigate]);

  const handleQuantityChange = (itemId, value) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  // Extract supplierId from supplierKey (format: "supplierId-regular" or "supplierId-promotionId")
  const extractSupplierId = (supplierKey) => {
    return supplierKey.split('-')[0];
  };

  const handlePriceChange = async (itemId, supplierKey, value) => {
    const priceKey = `${itemId}-${supplierKey}`;
    const newPrice = parseFloat(value) || 0;
    const supplierId = extractSupplierId(supplierKey);

    // Set the selected item ID for the hook
    setSelectedItemId(itemId);

    // First update local state for immediate UI feedback
    setTemporaryPrices(prev => ({
      ...prev,
      [priceKey]: newPrice
    }));

    try {
      const success = await updatePrice(supplierId, newPrice);

      if (!success) {
        // If update failed, revert the temporary price
        setTemporaryPrices(prev => ({
          ...prev,
          [priceKey]: prev[priceKey] || 0
        }));
        setError('Failed to update price. Please try again.');
      }
    } catch (err) {
      console.error('Error updating price:', err);
      setError(err.message || 'Failed to update price. Please try again.');
      // Revert the temporary price on error
      setTemporaryPrices(prev => ({
        ...prev,
        [priceKey]: prev[priceKey] || 0
      }));
    }
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
      setError(err.response?.data?.error || 'Failed to create orders. Please try again later.');
    }
  };

  const uniqueItems = Array.from(new Set(prices?.map(item => item.ItemID))) || [];
  const filteredItems = uniqueItems.filter(shouldShowItem);

  // Debug log the current state with focus on supplier groups
  console.log('Current state:', {
    prices: {
      count: prices.length,
      regularPrices: prices.filter(p => !p.IsPromotion).length,
      promotionalPrices: prices.filter(p => p.IsPromotion).length,
      promotions: [...new Set(prices.filter(p => p.IsPromotion).map(p => p.PromotionName))]
    },
    supplierGroups: Object.entries(supplierGroups).reduce((acc, [key, group]) => ({
      ...acc,
      [key]: {
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        isPromotion: group.isPromotion,
        promotionName: group.promotionName,
        itemCount: group.items.length
      }
    }), {}),
    replacementItems: {
      count: Object.keys(replacementItems).length,
      sample: Object.keys(replacementItems).length > 0 ? 
        replacementItems[Object.keys(replacementItems)[0]] : null
    },
    filteredItems: {
      count: filteredItems.length,
      sample: filteredItems[0] || null
    }
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
          updating={updating}
          updateError={updateError}
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
          responses={responses}
          fetchMissingItems={fetchMissingItems}
          prices={prices}
        />
      )}

      <ItemDetailsDialogWrapper
        open={itemDetailsOpen}
        onClose={handleCloseItemDetails}
        item={selectedItem}
        onItemClick={handleItemClick}
        showReferenceDetails={true}
      />
    </Box>
  );
}

export default ComparisonDetail;
