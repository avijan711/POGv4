import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Container,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Snackbar,
  ButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  ShoppingCart as OrderIcon,
  LocalShipping as ShippingIcon,
  Assignment as InquiryIcon,
  LocalOffer as PromotionIcon,
  Warning as WarningIcon,
  DeleteForever as DeleteForeverIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import Settings from './Settings';
import DebugSettings from './DebugSettings';
import { API_BASE_URL } from '../config';
import { useDialogMode } from '../contexts/DialogModeContext';

function StatCard({ title, value, icon, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {React.cloneElement(icon, { sx: { color, mr: 1 } })}
          <Typography color="textSecondary" variant="h6">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4">{value}</Typography>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { showReferenceDetails, setShowReferenceDetails } = useDialogMode();
  const [stats, setStats] = useState({
    totalItems: 0,
    activeOrders: 0,
    pendingShipments: 0,
    recentInquiries: 0,
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [activePromotions, setActivePromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [reinitializing, setReinitializing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stats
        setStats({
          totalItems: 1250,
          activeOrders: 15,
          pendingShipments: 8,
          recentInquiries: 23,
        });

        // Fetch recent activities
        setRecentActivities([
          {
            id: 1,
            type: 'Order',
            description: 'New order #1234 created',
            timestamp: '2 hours ago',
          },
          {
            id: 2,
            type: 'Shipment',
            description: 'Shipment #5678 delivered',
            timestamp: '4 hours ago',
          },
          {
            id: 3,
            type: 'Inventory',
            description: 'Stock updated for 15 items',
            timestamp: '6 hours ago',
          },
        ]);

        // Fetch active promotions using the regular promotions endpoint
        const response = await axios.get(`${API_BASE_URL}/api/promotions`);
        if (response.data?.success) {
          // Filter active promotions on the client side
          const now = new Date();
          const activePromos = response.data.data.filter(promo => {
            const startDate = new Date(promo.start_date);
            const endDate = new Date(promo.end_date);
            return now >= startDate && now <= endDate;
          });
          setActivePromotions(activePromos);
        } else {
          throw new Error(response.data?.message || 'Failed to fetch promotions');
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        const errorMessage = error.response?.data?.message || 'Failed to load dashboard data';
        setError({ severity: 'error', message: errorMessage });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleReinitializeDB = async () => {
    setReinitializing(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/settings/reset`);
      
      if (response.data?.success) {
        // Show success message and reload after a short delay
        setError({ 
          severity: 'success', 
          message: 'Database reset to clean state successfully. Reloading...', 
        });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(response.data?.message || 'Failed to reset database');
      }
    } catch (error) {
      console.error('Error resetting database:', error);
      const errorMessage = error.response?.data?.message || error.message;
      setError({ severity: 'error', message: errorMessage });
    } finally {
      setReinitializing(false);
      setOpenDialog(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, gap: 2 }}>
        {/* Dialog Mode Toggle */}
        <ButtonGroup variant="outlined">
          <Tooltip title="Simple Dialog View">
            <Button
              color={!showReferenceDetails ? 'primary' : 'inherit'}
              variant={!showReferenceDetails ? 'contained' : 'outlined'}
              onClick={() => setShowReferenceDetails(false)}
              startIcon={<ViewListIcon />}
            >
              Simple
            </Button>
          </Tooltip>
          <Tooltip title="Advanced Dialog View">
            <Button
              color={showReferenceDetails ? 'primary' : 'inherit'}
              variant={showReferenceDetails ? 'contained' : 'outlined'}
              onClick={() => setShowReferenceDetails(true)}
              startIcon={<ViewModuleIcon />}
            >
              Advanced
            </Button>
          </Tooltip>
        </ButtonGroup>

        {/* Reset Button */}
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={() => setOpenDialog(true)}
          disabled={reinitializing}
        >
          {reinitializing ? 'Resetting App...' : 'Reset App'}
        </Button>
      </Box>

      <Dialog
        open={openDialog}
        onClose={() => !reinitializing && setOpenDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="alert-dialog-title" sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteForeverIcon /> Reset Application to Clean State
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description" sx={{ mb: 2 }}>
            <strong>Warning: This action will completely reset the application!</strong>
          </DialogContentText>
          <Typography variant="body1" gutterBottom>
            This will permanently delete:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 2 }}>
            <li>All inventory items</li>
            <li>All inquiries and their responses</li>
            <li>All orders and shipments</li>
            <li>All promotions and supplier data</li>
            <li>All historical data and settings</li>
          </Box>
          <Typography variant="body1" color="error" sx={{ mt: 2 }}>
            The application will be reset to its initial clean state. This action cannot be undone!
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            Are you absolutely sure you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setOpenDialog(false)} 
            color="primary"
            disabled={reinitializing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReinitializeDB}
            color="error"
            variant="contained"
            disabled={reinitializing}
            startIcon={reinitializing ? <CircularProgress size={20} /> : <DeleteForeverIcon />}
          >
            {reinitializing ? 'Resetting App...' : 'Reset Application'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={error !== null} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setError(null)} 
          severity={error?.severity || 'error'} 
          sx={{ width: '100%' }}
        >
          {error?.message}
        </Alert>
      </Snackbar>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Items"
            value={stats.totalItems}
            icon={<InventoryIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Orders"
            value={stats.activeOrders}
            icon={<OrderIcon />}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Shipments"
            value={stats.pendingShipments}
            icon={<ShippingIcon />}
            color="#ed6c02"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Recent Inquiries"
            value={stats.recentInquiries}
            icon={<InquiryIcon />}
            color="#9c27b0"
          />
        </Grid>

        {/* Active Promotions Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PromotionIcon sx={{ color: '#f50057', mr: 1 }} />
              <Typography variant="h6">
                Active Promotions
              </Typography>
            </Box>
            <List>
              {activePromotions.length > 0 ? (
                activePromotions.map((promotion, index) => (
                  <React.Fragment key={promotion.promotion_id}>
                    <ListItem>
                      <ListItemText
                        primary={promotion.name}
                        secondary={`${promotion.item_count} items • Valid until ${new Date(promotion.end_date).toLocaleDateString()}`}
                      />
                    </ListItem>
                    {index < activePromotions.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              ) : (
                <ListItem>
                  <ListItemText
                    primary="No active promotions"
                    secondary="Check the Promotions page to create new promotions"
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activities
            </Typography>
            <List>
              {recentActivities.map((activity, index) => (
                <React.Fragment key={activity.id}>
                  <ListItem>
                    <ListItemText
                      primary={activity.description}
                      secondary={activity.timestamp}
                    />
                  </ListItem>
                  {index < recentActivities.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Settings />
        </Grid>

        <Grid item xs={12}>
          <DebugSettings />
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;
