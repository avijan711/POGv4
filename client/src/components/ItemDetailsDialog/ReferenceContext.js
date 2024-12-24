import React, { createContext, useContext } from 'react';
import {
  Store as StoreIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { Tooltip } from '@mui/material';

const ReferenceContext = createContext(null);

export function ReferenceProvider({ children, value }) {
  const {
    hasReferenceChange,
    isReferencedBy,
    referenceChange,
    referencingItems,
    onItemClick,
    itemDetails,
  } = value;

  const contextValue = {
    hasReferenceChange,
    isReferencedBy,
    referenceChange,
    referencingItems,
    onItemClick,
    itemDetails,
    // Shared utility functions
    getStatusColor: () => {
      if (hasReferenceChange) return 'warning';
      if (isReferencedBy) return 'success';
      return 'primary';
    },
    getStatusBackground: () => {
      if (hasReferenceChange) return '#fff3e0';
      if (isReferencedBy) return '#e8f5e9';
      return 'transparent';
    },
    getStatusBorder: (theme) => {
      if (hasReferenceChange) return `2px solid ${theme.palette.warning.main}`;
      if (isReferencedBy) return `2px solid ${theme.palette.success.main}`;
      return `1px solid ${theme.palette.divider}`;
    },
    getStatusText: () => {
      if (hasReferenceChange) return 'Old Item - Has Been Replaced';
      if (isReferencedBy) return 'New Item - Replaces Other Items';
      return '';
    },
    getSourceIcon: (source, supplierName) => {
      if (source === 'supplier') {
        return (
          <Tooltip title={`Changed by ${supplierName || 'supplier'}`}>
            <StoreIcon fontSize="small" color="warning" />
          </Tooltip>
        );
      }
      if (source === 'user') {
        return (
          <Tooltip title="Changed by user">
            <PersonIcon fontSize="small" color="warning" />
          </Tooltip>
        );
      }
      return null;
    },
    getSourceLabel: (source, supplierName) => {
      if (source === 'supplier') return `Changed by ${supplierName || 'supplier'}`;
      if (source === 'user') return 'Changed by user';
      return '';
    },
    // Helper functions for consistent styling
    styles: {
      referenceBox: {
        p: 2,
        bgcolor: hasReferenceChange ? '#fff3e0' : isReferencedBy ? '#e8f5e9' : 'transparent',
        borderBottom: theme => `3px solid ${
          hasReferenceChange ? theme.palette.warning.main : 
            isReferencedBy ? theme.palette.success.main : 
              theme.palette.divider
        }`,
        position: 'relative',
      },
      itemBox: {
        p: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: hasReferenceChange ? 'warning.light' : isReferencedBy ? 'success.light' : 'grey.300',
        borderRadius: 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      },
      headerText: {
        fontWeight: 'bold',
        color: theme => hasReferenceChange ? theme.palette.warning.dark : 
          isReferencedBy ? theme.palette.success.dark : 
            theme.palette.text.primary,
        letterSpacing: '0.5px',
      },
      backgroundPattern: {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '30%',
        opacity: 0.1,
        background: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          rgba(0,0,0,0.1) 10px,
          rgba(0,0,0,0.1) 20px
        )`,
      },
    },
  };

  return (
    <ReferenceContext.Provider value={contextValue}>
      {children}
    </ReferenceContext.Provider>
  );
}

export function useReference() {
  const context = useContext(ReferenceContext);
  if (!context) {
    throw new Error('useReference must be used within a ReferenceProvider');
  }
  return context;
}

export default ReferenceContext;
