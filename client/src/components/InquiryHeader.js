import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon,
  SwapHoriz as SwapHorizIcon,
  Delete as DeleteIcon,
  Compare as CompareIcon,
} from '@mui/icons-material';

function InquiryHeader({
  inquiryStatus,
  inquiryDate,
  searchTerm,
  onSearchChange,
  showDuplicates,
  onToggleDuplicates,
  showReplacements,
  onToggleReplacements,
  onUploadResponse,
  onViewBestPrices,
  onDeleteInquiry,
  error,
}) {
  const handleComparisonClick = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    console.log('=== Comparison button clicked ===');
    console.log('onViewBestPrices:', typeof onViewBestPrices);
    if (onViewBestPrices) {
      console.log('Calling onViewBestPrices');
      onViewBestPrices();
    } else {
      console.log('onViewBestPrices is not defined');
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Inquiry Details
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip 
              label={inquiryStatus} 
              color={inquiryStatus === 'New' ? 'primary' : 'default'}
            />
            <Typography variant="body2" color="text.secondary">
              Date: {inquiryDate}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
          {/* Primary action button */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<CompareIcon />}
            onClick={handleComparisonClick}
            sx={{ minWidth: '200px' }}
          >
            Start comparison process
          </Button>
          {/* Secondary action buttons */}
          <Button
            variant="outlined"
            startIcon={<WarningIcon />}
            onClick={onToggleDuplicates}
            color={showDuplicates ? 'primary' : 'inherit'}
          >
            Show Duplicates
          </Button>
          <Button
            variant="outlined"
            startIcon={<SwapHorizIcon />}
            onClick={onToggleReplacements}
            color={showReplacements ? 'primary' : 'inherit'}
          >
            Show Replacements
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={onUploadResponse}
          >
            Upload Response
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDeleteInquiry}
          >
            Delete Inquiry
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

export default InquiryHeader;
