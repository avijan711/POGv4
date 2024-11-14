import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import './App.css';

// Import components
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import FileUpload from './components/FileUpload';
import OrderList from './components/OrderList';  // Changed from OrderManagement
import ShipmentTracking from './components/ShipmentTracking';
import Suppliers from './components/Suppliers';
import InquiryList from './components/InquiryList';
import InquiryDetail from './components/InquiryDetail';
import Navigation from './components/Navigation';
import PromotionList from './components/PromotionList';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
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
      <CssBaseline />
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
              <Route path="/promotions" element={<PromotionList />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
