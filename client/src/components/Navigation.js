import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  CloudUpload as UploadIcon,
  ShoppingCart as OrdersIcon,
  LocalShipping as ShipmentsIcon,
  Business as SuppliersIcon,
  Assignment as InquiriesIcon,
  LocalOffer as PromotionsIcon,
  Compare as CompareIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

const menuItems = [
  { path: '/dashboard', text: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/inventory', text: 'Inventory', icon: <InventoryIcon /> },
  { path: '/upload', text: 'File Upload', icon: <UploadIcon /> },
  { path: '/orders', text: 'Orders', icon: <OrdersIcon /> },
  { path: '/shipments', text: 'Shipments', icon: <ShipmentsIcon /> },
  { path: '/suppliers', text: 'Suppliers', icon: <SuppliersIcon /> },
  { path: '/inquiries', text: 'Inquiries', icon: <InquiriesIcon /> },
  { path: '/comparisons', text: 'Comparisons', icon: <CompareIcon /> },
  { path: '/promotions', text: 'Promotions', icon: <PromotionsIcon /> },
];

function Navigation() {
  const location = useLocation();

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: '#1976d2',
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Inventory Management System
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#fff',
            borderRight: '1px solid rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <Toolbar /> {/* This creates space for the AppBar */}
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem
                key={item.path}
                component={Link}
                to={item.path}
                selected={location.pathname === item.path}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.12)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: location.pathname === item.path ? '#1976d2' : 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  sx={{ 
                    color: location.pathname === item.path ? '#1976d2' : 'inherit',
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  );
}

export default Navigation;
