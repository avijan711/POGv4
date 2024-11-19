import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  ItemStatsDialog,
  DeleteDialog,
  ResponseHeader,
  ResponseAccordion,
  useSupplierResponses
} from './SupplierResponse';
import { useParams } from 'react-router-dom';

function SupplierResponseList({ responses = [], onRefresh }) {
  const { inquiryId } = useParams();
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogTitle, setStatsDialogTitle] = useState('');
  const [statsDialogItems, setStatsDialogItems] = useState([]);
  const [statsDialogType, setStatsDialogType] = useState('missing'); // Initialize with a valid type

  // Ensure responses is always an array and items are properly formatted
  const safeResponses = Array.isArray(responses) ? responses.map(response => {
    if (!response) return null;
    return {
      ...response,
      items: Array.isArray(response.items) ? response.items.map(item => {
        if (!item) return null;
        return {
          ...item,
          itemId: item.itemId || '',
          hebrewDescription: item.hebrewDescription || '',
          englishDescription: item.englishDescription || '',
          priceQuoted: item.priceQuoted || 0,
          status: item.status || 'Pending',
          itemType: item.itemType || 'regular'
        };
      }).filter(Boolean) : [],
      date: response.date || new Date().toISOString(),
      supplierId: response.supplierId || '',
      supplierName: response.supplierName || 'Unknown Supplier'
    };
  }).filter(Boolean) : [];

  const {
    deleteDialogOpen,
    deleteType,
    itemToDelete,
    error,
    isDeleting,
    isLoading,
    handleDeleteClick,
    handleDeleteConfirm,
    closeDeleteDialog,
    setError
  } = useSupplierResponses(inquiryId, safeResponses);

  const handleShowStats = (title, items, type) => {
    // Ensure items is an array and all items have required properties
    const safeItems = Array.isArray(items) ? items.map(item => {
      if (!item) return null;
      return {
        ...item,
        itemId: item.itemId || '',
        hebrewDescription: item.hebrewDescription || '',
        englishDescription: item.englishDescription || '',
        priceQuoted: item.priceQuoted || 0,
        status: item.status || 'Pending',
        itemType: item.itemType || 'regular'
      };
    }).filter(Boolean) : [];

    setStatsDialogTitle(title);
    setStatsDialogItems(safeItems);
    setStatsDialogType(type || 'missing'); // Ensure a valid type is always set
    setStatsDialogOpen(true);
  };

  return (
    <Paper sx={{ p: 3, backgroundColor: '#f8f9fa' }} elevation={0}>
      <ResponseHeader responsesCount={safeResponses?.length || 0} />

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {isLoading && safeResponses.length === 0 ? (
        <Box sx={{ width: '100%', textAlign: 'center', py: 4 }}>
          <LinearProgress 
            sx={{ 
              maxWidth: 300,
              mx: 'auto',
              mb: 2,
              height: 6,
              borderRadius: 3
            }}
          />
          <Typography color="textSecondary">
            Loading supplier responses...
          </Typography>
        </Box>
      ) : (
        <>
          {safeResponses.map((response) => (
            <ResponseAccordion
              key={`${response.date}-${response.supplierId}`}
              response={response}
              onDelete={handleDeleteClick}
              onShowStats={handleShowStats}
              isLoading={isLoading}
            />
          ))}
          
          {isLoading && safeResponses.length > 0 && (
            <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
              <LinearProgress 
                sx={{ 
                  maxWidth: 200,
                  mx: 'auto',
                  height: 4,
                  borderRadius: 2
                }}
              />
            </Box>
          )}
        </>
      )}

      <ItemStatsDialog
        open={statsDialogOpen}
        onClose={() => setStatsDialogOpen(false)}
        title={statsDialogTitle}
        items={statsDialogItems}
        type={statsDialogType}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteConfirm}
        itemToDelete={itemToDelete}
        deleteType={deleteType}
        error={error}
        isDeleting={isDeleting}
      />
    </Paper>
  );
}

export default SupplierResponseList;
