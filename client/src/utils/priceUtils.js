import { DEFAULT_EXCHANGE_RATE } from '../constants';

export const formatIlsPrice = (price) => {
  if (price === null || price === undefined || price === '') {
    return null;
  }
  const numPrice = Number(price);
  if (isNaN(numPrice)) {
    return null;
  }
  return `₪${numPrice.toFixed(2)}`;
};

export const formatEurPrice = (price) => {
  if (price === null || price === undefined || price === '') {
    return null;
  }
  
  // Handle price if it's a string with comma decimal separator
  let numPrice;
  if (typeof price === 'string' && price.includes(',')) {
    numPrice = Number(price.replace(',', '.'));
  } else {
    numPrice = Number(price);
  }
  
  if (isNaN(numPrice)) {
    return null;
  }
  return `€${numPrice.toFixed(2)}`;
};

export const formatPercentage = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const calculateDiscount = (priceEUR, importMarkup, retailPrice, eurToIls = DEFAULT_EXCHANGE_RATE) => {
  if (!retailPrice || !importMarkup || !priceEUR) {
    return null;
  }

  // Handle priceEUR if it's a string with comma decimal separator
  let numPriceEUR;
  if (typeof priceEUR === 'string' && priceEUR.includes(',')) {
    numPriceEUR = Number(priceEUR.replace(',', '.'));
  } else {
    numPriceEUR = Number(priceEUR);
  }

  const supplierPriceILS = numPriceEUR * eurToIls * importMarkup;
  const discount = ((retailPrice - supplierPriceILS) / retailPrice) * 100;
  return Math.max(0, Math.min(100, discount));
};

export const getDisplayPrice = (itemId, supplierKey, originalPrice, temporaryPrices) => {
  const priceKey = `${itemId}-${supplierKey}`;
  const tempPrice = Object.hasOwn(temporaryPrices, priceKey) ? temporaryPrices[priceKey] : null;
  
  // If we have a temporary price, use it
  if (tempPrice !== null) return tempPrice;
  
  // If we have an original price, use it
  if (originalPrice !== null && originalPrice !== undefined) return originalPrice;
  
  // No price available
  return null;
};

export const getBestPriceForItem = (itemId, supplierGroups, selectedSuppliers, temporaryPrices) => {
  let bestPrice = Infinity;
  Object.entries(supplierGroups)
    .filter(([key]) => selectedSuppliers[key])
    .forEach(([key, group]) => {
      const supplierItem = group.items.find(item => item.ItemID === itemId);
      if (supplierItem) {
        const displayPrice = getDisplayPrice(itemId, key, supplierItem.PriceQuoted, temporaryPrices);
        if (displayPrice && displayPrice < bestPrice) {
          bestPrice = displayPrice;
        }
      }
    });
  return bestPrice === Infinity ? null : bestPrice;
};

export const isWinningPrice = (price, itemId, supplierGroups, selectedSuppliers, temporaryPrices) => {
  if (!price) return false;
  const currentBestPrice = getBestPriceForItem(itemId, supplierGroups, selectedSuppliers, temporaryPrices);
  if (!currentBestPrice) return false;
  const epsilon = 0.01;
  return Math.abs(price - currentBestPrice) <= epsilon;
};

// New utility functions for margin calculations
export const calculateIlsPrice = (eurPrice, importMarkup, eurToIls = DEFAULT_EXCHANGE_RATE) => {
  if (!eurPrice || !importMarkup) return null;
  return eurPrice * eurToIls * importMarkup;
};

export const calculateMargin = (retailPrice, costPrice) => {
  if (!retailPrice || !costPrice) return null;
  return ((retailPrice - costPrice) / retailPrice) * 100;
};

export const getMarginInfo = (eurPrice, retailPrice, importMarkup, eurToIls = DEFAULT_EXCHANGE_RATE) => {
  if (!eurPrice || !retailPrice || !importMarkup) return null;
  
  const costPrice = calculateIlsPrice(eurPrice, importMarkup, eurToIls);
  if (!costPrice) return null;
  
  const margin = calculateMargin(retailPrice, costPrice);
  if (margin === null) return null;
  
  return {
    margin,
    color: margin < 20 ? 'error' : 
      margin < 30 ? 'warning' : 
        'success',
  };
};

export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
  case 'active': return 'success';
  case 'pending': return 'warning';
  case 'rejected': return 'error';
  default: return 'default';
  }
};

export const getPriceAnalysis = (prices) => {
  if (!Array.isArray(prices) || !prices.length) return null;

  const validPrices = prices.filter(p => typeof p === 'number' && !isNaN(p));
  if (!validPrices.length) return null;

  return {
    lowest: Math.min(...validPrices),
    highest: Math.max(...validPrices),
    average: validPrices.reduce((a, b) => a + b, 0) / validPrices.length,
  };
};
