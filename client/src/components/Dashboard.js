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
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  ShoppingCart as OrderIcon,
  LocalShipping as ShippingIcon,
  Assignment as InquiryIcon,
  LocalOffer as PromotionIcon,
} from '@mui/icons-material';
import Settings from './Settings';
import { API_BASE_URL } from '../config';

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
  const [stats, setStats] = useState({
    totalItems: 0,
    activeOrders: 0,
    pendingShipments: 0,
    recentInquiries: 0,
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [activePromotions, setActivePromotions] = useState([]);
  const [loading, setLoading] = useState(true);

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

        // Fetch active promotions
        const promotionsResponse = await fetch(`${API_BASE_URL}/api/promotions/active`);
        if (promotionsResponse.ok) {
          const promotionsData = await promotionsResponse.json();
          setActivePromotions(promotionsData);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mb: 4 }}>
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
                  <React.Fragment key={promotion.PromotionGroupID}>
                    <ListItem>
                      <ListItemText
                        primary={promotion.Name}
                        secondary={`${promotion.ItemCount} items • Valid until ${new Date(promotion.EndDate).toLocaleDateString()}`}
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
      </Grid>
    </Container>
  );
}

export default Dashboard;
