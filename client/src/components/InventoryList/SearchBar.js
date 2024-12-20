import React from 'react';
import {
  Box,
  TextField,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
} from '@mui/icons-material';

function SearchBar({ searchTerm, onSearchChange, onAddItem }) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <TextField
        variant="outlined"
        size="small"
        placeholder="Search items..."
        value={searchTerm}
        onChange={onSearchChange}
        InputProps={{
          startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
        }}
      />
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onAddItem}
      >
        Add Item
      </Button>
    </Box>
  );
}

export default SearchBar;
