import React, { createContext, useContext, useState, useEffect } from 'react';

const DialogModeContext = createContext();

export function DialogModeProvider({ children }) {
  const [showReferenceDetails, setShowReferenceDetails] = useState(() => {
    // Get initial value from localStorage, default to true
    const saved = localStorage.getItem('showReferenceDetails');
    return saved === null ? true : JSON.parse(saved);
  });

  // Save to localStorage whenever the value changes
  useEffect(() => {
    localStorage.setItem('showReferenceDetails', JSON.stringify(showReferenceDetails));
  }, [showReferenceDetails]);

  return (
    <DialogModeContext.Provider value={{ showReferenceDetails, setShowReferenceDetails }}>
      {children}
    </DialogModeContext.Provider>
  );
}

export function useDialogMode() {
  const context = useContext(DialogModeContext);
  if (!context) {
    throw new Error('useDialogMode must be used within a DialogModeProvider');
  }
  return context;
}

export default DialogModeContext;
