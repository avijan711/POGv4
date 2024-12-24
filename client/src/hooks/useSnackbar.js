import { useState, useCallback } from 'react';

/**
 * Custom hook for managing snackbar notifications
 * @returns {Object} Snackbar state and handlers
 */
export const useSnackbar = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  const showSnackbar = useCallback((newMessage, newSeverity = 'success') => {
    setMessage(newMessage);
    setSeverity(newSeverity);
    setOpen(true);
  }, []);

  const hideSnackbar = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    message,
    severity,
    showSnackbar,
    hideSnackbar,
  };
};

export default useSnackbar;
