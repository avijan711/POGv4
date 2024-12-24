import React, { useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  Alert,
  Snackbar,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import axios from 'axios';

import { useItemDetails } from '../hooks/useItemDetails';
import { uiDebug, perfDebug } from '../utils/debug';
import BasicInfoTab from './ItemDetailsDialog/BasicInfoTab';
import PriceHistoryTab from './ItemDetailsDialog/PriceHistoryTab';
import SupplierPricesTab from './ItemDetailsDialog/SupplierPricesTab';
import ReferenceChangesTab from './ItemDetailsDialog/ReferenceChangesTab';
import ReferenceStatus from './ItemDetailsDialog/ReferenceStatus';
import DialogHeader from './ItemDetailsDialog/DialogHeader';
import { ReferenceProvider } from './ItemDetailsDialog/ReferenceContext';
import { API_BASE_URL } from '../config';

// ... rest of the code from ItemDetailsDialog/index.js ...
// (Copy all the components and logic from index.js)

function ItemDetailsDialog({ open, onClose, item, onItemClick, loading = false }) {
  // ... rest of the component code from index.js ...
}

// Prevent unnecessary re-renders
export default React.memo(ItemDetailsDialog, (prevProps, nextProps) => {
  // Only re-render if these props change
  const shouldUpdate = (
    prevProps.open !== nextProps.open ||
    prevProps.loading !== nextProps.loading ||
    prevProps.item !== nextProps.item
  );
  
  // Log re-render decision for debugging
  uiDebug.log('ItemDetailsDialog shouldUpdate:', { 
    shouldUpdate,
    prevProps,
    nextProps,
  });
  
  // Return true if props are equal (no update needed)
  return !shouldUpdate;
});
