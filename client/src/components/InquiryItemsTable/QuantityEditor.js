import React, { useEffect, useRef } from 'react';
import { TextField, Box } from '@mui/material';

const styles = {
  textField: {
    width: '80px',
    '& .MuiInputBase-input': {
      textAlign: 'right',
      padding: '8px',
      '-moz-appearance': 'textfield',
      '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
        '-webkit-appearance': 'none',
        margin: 0,
      },
    },
  },
  displayBox: {
    cursor: 'text',
    padding: '8px',
    minWidth: '60px',
    textAlign: 'right',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
      borderRadius: '4px',
    },
  },
};

function QuantityEditor({
  value,
  isEditing,
  onStartEdit,
  onChange,
  onBlur,
  onKeyDown,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <TextField
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        inputRef={inputRef}
        size="small"
        sx={styles.textField}
        inputProps={{ 
          min: 0,
          style: { textAlign: 'right' },
        }}
      />
    );
  }

  return (
    <Box 
      onClick={onStartEdit}
      sx={styles.displayBox}
    >
      {value}
    </Box>
  );
}

export default QuantityEditor;
