import { API_BASE_URL } from '../config';
import axios from 'axios';

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

export const calculateDiscount = (priceEUR, importMarkup, retailPrice, eurToIls) => {
  if (!retailPrice) {
    console.log('Missing retail price (ILS)');
    return null;
  }
  if (!importMarkup) {
    console.log('Missing import markup');
    return null;
  }
  if (!priceEUR) {
    console.log('Missing EUR price');
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
  console.log('Discount calculation:', {
    priceEUR,
    numPriceEUR,
    importMarkup,
    retailPrice,
    supplierPriceILS,
    eurToIls,
    message: 'RetailPrice is already in ILS from query COALESCE'
  });

  const discount = ((retailPrice - supplierPriceILS) / retailPrice) * 100;
  console.log('Final discount:', discount);

  return Math.max(0, Math.min(100, discount));
};

export const getDisplayPrice = (itemId, supplierKey, originalPrice, temporaryPrices) => {
  const priceKey = `${itemId}-${supplierKey}`;
  return temporaryPrices.hasOwnProperty(priceKey) 
    ? temporaryPrices[priceKey] 
    : originalPrice;
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

export const fetchSettings = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/settings`);
    if (response.data && response.data.eurToIls) {
      const rate = Number(response.data.eurToIls);
      console.log('Fetched EUR to ILS rate:', rate);
      return rate;
    }
    return 3.95; // Default value
  } catch (err) {
    console.error('Error fetching settings:', err);
    return 3.95; // Default value on error
  }
};
