import { useState, useEffect, useCallback } from 'react';

export function useQuantityEditor(initialValue, isEditing, onUpdate) {
  const [tempQty, setTempQty] = useState(initialValue);
  const [displayQty, setDisplayQty] = useState(initialValue);

  // Reset states when initialValue or editing state changes
  useEffect(() => {
    console.log('useQuantityEditor: initialValue changed:', initialValue);
    setDisplayQty(initialValue);
    if (isEditing) {
      console.log('useQuantityEditor: entering edit mode, setting tempQty:', initialValue);
      setTempQty(initialValue);
    }
  }, [initialValue, isEditing]);

  const handleQtyChange = useCallback((value) => {
    console.log('useQuantityEditor: handleQtyChange:', value);
    // Allow empty string or valid number
    if (value === '' || (!isNaN(value) && Number(value) >= 0)) {
      setTempQty(value);
    }
  }, []);

  const handleQtyUpdate = useCallback(async () => {
    if (!isEditing) {
      console.log('useQuantityEditor: not in edit mode, skipping update');
      return false;
    }

    const oldQty = displayQty;
    const newQty = parseInt(tempQty, 10);

    console.log('useQuantityEditor: handleQtyUpdate:', { oldQty, newQty, tempQty });

    if (isNaN(newQty) || newQty < 0) {
      console.log('useQuantityEditor: invalid quantity, reverting');
      setTempQty(oldQty);
      return false;
    }

    try {
      console.log('useQuantityEditor: calling onUpdate with:', newQty);
      const success = await onUpdate(newQty);
      
      if (success) {
        console.log('useQuantityEditor: update successful, setting displayQty:', newQty);
        setDisplayQty(newQty);
        return true;
      } else {
        console.log('useQuantityEditor: update failed, reverting to:', oldQty);
        setTempQty(oldQty);
        return false;
      }
    } catch (error) {
      console.error('useQuantityEditor: error updating quantity:', error);
      setTempQty(oldQty);
      return false;
    }
  }, [isEditing, tempQty, displayQty, onUpdate]);

  const handleQtyCancel = useCallback((e) => {
    if (e) e.stopPropagation();
    console.log('useQuantityEditor: cancelling, reverting to:', displayQty);
    setTempQty(displayQty);
  }, [displayQty]);

  const handleQtyBlur = useCallback((e) => {
    // Don't handle blur if clicking the confirm/cancel buttons
    if (e.relatedTarget && 
        (e.relatedTarget.classList.contains('confirm-qty') || 
         e.relatedTarget.classList.contains('cancel-qty'))) {
      console.log('useQuantityEditor: blur ignored due to confirm/cancel button click');
      return;
    }
    console.log('useQuantityEditor: handling blur event');
    e.stopPropagation();
    handleQtyUpdate();
  }, [handleQtyUpdate]);

  const handleQtyKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      console.log('useQuantityEditor: Enter key pressed');
      e.stopPropagation();
      handleQtyUpdate();
    } else if (e.key === 'Escape') {
      console.log('useQuantityEditor: Escape key pressed');
      e.stopPropagation();
      handleQtyCancel(e);
    }
  }, [handleQtyUpdate, handleQtyCancel]);

  return {
    tempQty,
    displayQty,
    handleQtyChange,
    handleQtyUpdate,
    handleQtyCancel,
    handleQtyBlur,
    handleQtyKeyPress,
  };
}
