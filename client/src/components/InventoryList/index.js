import React, { useCallback, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { uiDebug } from '../../utils/debug';

const InventoryList = () => {
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');
  const [itemDetails, setItemDetails] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleRowClick = useCallback(async (item) => {
    try {
      uiDebug.log('Opening item details for:', item.itemID);
      
      // Start loading state
      setLoadingDetails(true);
      setError('');
      
      // Fetch item details
      const response = await axios.get(`${API_BASE_URL}/api/items/${item.itemID}`);
      const data = response.data;
      
      // Log raw response data for debugging
      console.log('Raw API response:', JSON.stringify(data, null, 2));
      
      // Validate response data
      if (!data) {
        throw new Error('Invalid item data received');
      }

      // Parse JSON strings if needed
      const priceHistory = typeof data.priceHistory === 'string' ? JSON.parse(data.priceHistory) : (data.priceHistory || []);
      const supplierPrices = typeof data.supplierPrices === 'string' ? JSON.parse(data.supplierPrices) : (data.supplierPrices || []);
      const promotions = typeof data.promotions === 'string' ? JSON.parse(data.promotions) : (data.promotions || []);

      // Process the data into the correct structure
      const processedData = {
        item: {
          itemID: data.itemID,
          hebrewDescription: data.hebrewDescription,
          englishDescription: data.englishDescription || '',
          importMarkup: parseFloat(data.importMarkup).toFixed(2),
          hsCode: data.hsCode || '',
          image: data.image || '',
          qtyInStock: parseInt(data.qtyInStock) || 0,
          soldThisYear: parseInt(data.soldThisYear) || 0,
          soldLastYear: parseInt(data.soldLastYear) || 0,
          retailPrice: data.retailPrice !== null && data.retailPrice !== undefined ? 
            parseFloat(data.retailPrice) : null,
          referenceChange: data.referenceChange,
          referencedBy: data.referencedBy,
          lastUpdated: data.lastUpdated,
          hasReferenceChange: data.referenceChange !== null,
          isReferencedBy: data.referencedBy !== null,
          referencingItems: data.referencingItems || [],
        },
        priceHistory: priceHistory.map(ph => ({
          date: ph.date,
          price: parseFloat(ph.price),
          qtyInStock: parseInt(ph.qtyInStock) || 0,
          soldThisYear: parseInt(ph.soldThisYear) || 0,
          soldLastYear: parseInt(ph.soldLastYear) || 0,
        })),
        supplierPrices,
        promotions,
        hasReferenceChange: data.referenceChange !== null,
        isReferencedBy: data.referencedBy !== null,
        referenceChange: data.referenceChange,
        referencingItems: data.referencingItems || [],
      };

      console.log('Processed item data:', JSON.stringify(processedData, null, 2));
      setItemDetails(processedData);
      
      // Then open dialog
      setDetailsOpen(true);
      
    } catch (error) {
      console.error('Error fetching item details:', error);
      setError('Failed to load item details. Please try again.');
      setItemDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  return (
    <div>
      {/* Component rendering logic will go here */}
    </div>
  );
};

export default InventoryList;
