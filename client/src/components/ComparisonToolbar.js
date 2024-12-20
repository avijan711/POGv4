import React from 'react';
import {
  Box,
  Typography,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  FormControl,
  TextField,
  InputAdornment,
  Stack,
  Chip,
  Paper
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Delete as DeleteIcon,
  Compare as CompareIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  FilterAlt as FilterIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

const ComparisonToolbar = ({
  viewMode,
  setViewMode,
  discountFilter,
  setDiscountFilter,
  searchQuery,
  setSearchQuery,
  handleCreateOrders,
  selectedSuppliers,
  supplierGroups,
  handleSupplierToggle
}) => {
  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">
          Interactive Comparison Process
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl sx={{ width: '250px' }}>
            <TextField
              label="Search Items"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              placeholder="Search by ID or description"
            />
          </FormControl>
          <FormControl sx={{ width: '200px' }}>
            <TextField
              label="Filter by Discount"
              value={discountFilter}
              onChange={(e) => setDiscountFilter(e.target.value)}
              size="small"
              type="number"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FilterIcon />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              placeholder="Enter discount %"
            />
          </FormControl>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="items">
              <Tooltip title="Items View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="suppliers">
              <Tooltip title="Sort by Supplier">
                <ViewModuleIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            onClick={handleCreateOrders}
            startIcon={<ShoppingCartIcon />}
            disabled={Object.values(selectedSuppliers).filter(Boolean).length === 0}
          >
            Create Orders
          </Button>
        </Box>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Supplier Management
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {Object.entries(supplierGroups).map(([key, group]) => (
            <Chip
              key={key}
              label={group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName}
              color={group.isPromotion ? "secondary" : "primary"}
              variant={selectedSuppliers[key] ? "filled" : "outlined"}
              onClick={() => handleSupplierToggle(key)}
              onDelete={() => handleSupplierToggle(key)}
              deleteIcon={selectedSuppliers[key] ? <DeleteIcon /> : <CompareIcon />}
              sx={{ m: 0.5 }}
            />
          ))}
        </Stack>
      </Paper>
    </>
  );
};

export default ComparisonToolbar;
