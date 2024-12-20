import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './App.css';
import { DialogModeProvider } from './contexts/DialogModeContext';

// Import components
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import FileUpload from './components/FileUpload';
import OrderList from './components/OrderList';
import ShipmentTracking from './components/ShipmentTracking';
import Suppliers from './components/Suppliers';
import InquiryList from './components/InquiryList';
import InquiryDetail from './components/InquiryDetail';
import Navigation from './components/Navigation';
import PromotionList from './components/PromotionList';
import ComparisonList from './components/ComparisonList';
import ComparisonDetail from './components/ComparisonDetail';

// Create theme with all required color variants
const theme = createTheme({
  palette: {
    primary: {
      light: '#4dabf5',
      main: '#1976d2',
      dark: '#1565c0',
      contrastText: '#fff',
    },
    secondary: {
      light: '#ff4081',
      main: '#dc004e',
      dark: '#9a0036',
      contrastText: '#fff',
    },
    warning: {
      light: '#ffb74d',
      main: '#ff9800',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    success: {
      light: '#81c784',
      main: '#4caf50',
      dark: '#388e3c',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    error: {
      light: '#e57373',
      main: '#f44336',
      dark: '#d32f2f',
      contrastText: '#fff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#fff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <CssBaseline />
        <DialogModeProvider>
          <Router>
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
              <Navigation />
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  height: '100vh',
                  overflow: 'auto',
                  backgroundColor: 'background.default',
                  pt: 8, // Add padding top to account for app bar
                }}
              >
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/inventory" element={<InventoryList />} />
                  <Route path="/upload" element={<FileUpload />} />
                  <Route path="/orders" element={<OrderList />} />
                  <Route path="/shipments" element={<ShipmentTracking />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/inquiries" element={<InquiryList />} />
                  <Route path="/inquiries/:id" element={<InquiryDetail />} />
                  <Route path="/comparisons" element={<ComparisonList />} />
                  <Route path="/comparisons/:id" element={<ComparisonDetail />} />
                  <Route path="/promotions" element={<PromotionList />} />
                </Routes>
              </Box>
            </Box>
          </Router>
        </DialogModeProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
