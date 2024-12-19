import React from 'react';
import SimpleItemDetailsDialog from './SimpleItemDetailsDialog';
import ItemDetailsDialog from './ItemDetailsDialog';
import { useDialogMode } from '../contexts/DialogModeContext';

/**
 * Wrapper component that chooses between simple and advanced item details dialog
 * based on whether reference tracking is needed.
 * 
 * @param {Object} props
 * @param {boolean} props.showReferenceDetails - Override dialog mode from context
 * @param {boolean} props.open - Dialog open state
 * @param {Function} props.onClose - Dialog close handler
 * @param {Object} props.item - Item data
 * @param {Function} props.onItemClick - Handler for clicking referenced items
 * @param {boolean} props.loading - Loading state
 */
function ItemDetailsDialogWrapper({ showReferenceDetails: showReferenceDetailsProp, ...props }) {
  // Get dialog mode from context, but allow prop to override it
  const { showReferenceDetails: showReferenceDetailsContext } = useDialogMode();
  const showReferenceDetails = showReferenceDetailsProp ?? showReferenceDetailsContext;

  // Use advanced dialog when showReferenceDetails is true
  const DialogComponent = showReferenceDetails ? 
    ItemDetailsDialog : 
    SimpleItemDetailsDialog;

  return <DialogComponent {...props} />;
}

export default ItemDetailsDialogWrapper;
