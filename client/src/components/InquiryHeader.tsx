import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
  Grid,
  Paper,
  LinearProgress,
  ButtonGroup,
} from '@mui/material';
import { QtyIndicator } from '../hooks/useInquiryFilters';
import {
  Search as SearchIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon,
  SwapHoriz as SwapHorizIcon,
  Delete as DeleteIcon,
  Compare as CompareIcon,
  Inventory as InventoryIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { InquiryHeaderProps, Statistics } from '../types/inquiry';

interface StatBoxProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  showProgress?: boolean;
  progress?: number;
}

const defaultStatistics: Statistics = {
  unique_items: 0,
  suppliers_responded: 0,
  total_suppliers: 0,
  days_active: 0,
  response_rate: 0,
};

const InquiryHeader: React.FC<InquiryHeaderProps> = ({
  inquiryStatus,
  inquiryDate,
  searchTerm,
  onSearchChange,
  showDuplicates,
  onToggleDuplicates,
  showReplacements,
  onToggleReplacements,
  qtyIndicatorFilter,
  setQtyIndicatorFilter,
  onUploadResponse,
  onViewBestPrices,
  onDeleteInquiry,
  onAddItem,
  error,
  statistics = defaultStatistics,
}) => {
  const handleComparisonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewBestPrices) {
      onViewBestPrices();
    }
  };

  const StatBox: React.FC<StatBoxProps> = ({ 
    icon: Icon, 
    label, 
    value, 
    color = 'primary', 
    showProgress = false, 
    progress = 0,
  }) => (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2.5,
        bgcolor: `${color}.50`,
        borderRadius: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
        <Box
          sx={{
            bgcolor: `${color}.100`,
            borderRadius: 1.5,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ 
            color: `${color}.main`,
            fontSize: 24,
          }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ mb: 0.5, fontWeight: 500 }}
          >
            {label}
          </Typography>
          <Typography 
            variant="h6" 
            color={`${color}.main`} 
            sx={{ 
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>
        </Box>
      </Box>
      {showProgress && (
        <Box sx={{ mt: 'auto' }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            alignItems: 'center',
            mb: 1,
          }}>
            <Typography 
              variant="caption" 
              color={`${color}.700`}
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            >
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            color={color}
            sx={{ 
              height: 8,
              borderRadius: 4,
              backgroundColor: `${color}.100`,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                transition: 'transform 0.4s ease',
              },
            }}
          />
        </Box>
      )}
    </Paper>
  );

  // Calculate progress for suppliers responded
  const suppliersProgress = statistics.total_suppliers 
    ? (statistics.suppliers_responded / statistics.total_suppliers) * 100 
    : 0;

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
          {/* Primary action buttons */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAddItem}
          >
            Add Item
          </Button>
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
          <ButtonGroup variant="outlined">
            <Button
              onClick={() => setQtyIndicatorFilter(qtyIndicatorFilter === QtyIndicator.OK ? null : QtyIndicator.OK)}
              color={qtyIndicatorFilter === QtyIndicator.OK ? 'success' : 'inherit'}
            >
              OK
            </Button>
            <Button
              onClick={() => setQtyIndicatorFilter(qtyIndicatorFilter === QtyIndicator.NEW ? null : QtyIndicator.NEW)}
              color={qtyIndicatorFilter === QtyIndicator.NEW ? 'info' : 'inherit'}
            >
              NEW
            </Button>
            <Button
              onClick={() => setQtyIndicatorFilter(qtyIndicatorFilter === QtyIndicator.HIGH ? null : QtyIndicator.HIGH)}
              color={qtyIndicatorFilter === QtyIndicator.HIGH ? 'error' : 'inherit'}
            >
              HIGH
            </Button>
          </ButtonGroup>
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

      {/* Statistics Section */}
      <Grid container spacing={3} sx={{ mt: 1, mb: 2 }}>
        <Grid item xs={3}>
          <StatBox
            icon={InventoryIcon}
            label="Unique Items"
            value={statistics.unique_items}
          />
        </Grid>
        <Grid item xs={3}>
          <StatBox
            icon={BusinessIcon}
            label="Suppliers Responded"
            value={`${statistics.suppliers_responded} / ${statistics.total_suppliers}`}
            color="success"
            showProgress={true}
            progress={suppliersProgress}
          />
        </Grid>
        <Grid item xs={3}>
          <StatBox
            icon={ScheduleIcon}
            label="Days Active"
            value={statistics.days_active}
            color="info"
          />
        </Grid>
        <Grid item xs={3}>
          <StatBox
            icon={TrendingUpIcon}
            label="Response Rate"
            value={`${statistics.response_rate}%`}
            color="warning"
          />
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default InquiryHeader;