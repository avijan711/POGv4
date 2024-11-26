import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  LocalOffer as LocalOfferIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

function SupplierResponseList({ responses, onRefresh }) {
  if (!responses || responses.length === 0) {
    return null;
  }

  // Group responses by supplier
  const groupedResponses = responses.reduce((acc, item) => {
    if (!item.supplier_responses) return acc;

    item.supplier_responses.forEach(response => {
      const key = response.supplier_id;
      if (!acc[key]) {
        acc[key] = {
          supplier_name: response.supplier_name,
          responses: []
        };
      }
      acc[key].responses.push({
        ...response,
        item_id: item.item_id,
        hebrew_description: item.hebrew_description,
        english_description: item.english_description
      });
    });
    return acc;
  }, {});

  const formatPrice = (price) => {
    if (!price) return '₪0.00';
    return `₪${Number(price).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Supplier Responses
        </Typography>
        <Tooltip title="Refresh Responses">
          <IconButton onClick={onRefresh} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={2}>
        {Object.entries(groupedResponses).map(([supplierId, data]) => (
          <Grid item xs={12} key={supplierId}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <BusinessIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">
                  {data.supplier_name}
                </Typography>
                <Chip
                  label={`${data.responses.length} Items`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>

              <Grid container spacing={2}>
                {data.responses.map((response, index) => (
                  <Grid item xs={12} sm={6} md={4} key={`${response.supplier_response_id}-${index}`}>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2,
                        backgroundColor: response.is_promotion ? 'rgba(156, 39, 176, 0.1)' : 'inherit'
                      }}
                    >
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Item ID
                        </Typography>
                        <Typography>{response.item_id}</Typography>
                      </Box>

                      <Box sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Description
                        </Typography>
                        <Typography>{response.hebrew_description}</Typography>
                        <Typography variant="body2">{response.english_description}</Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip
                          icon={<AttachMoneyIcon />}
                          label={formatPrice(response.price_quoted)}
                          color={response.is_promotion ? "secondary" : "default"}
                          variant="outlined"
                          size="small"
                        />
                        {response.is_promotion && (
                          <Chip
                            icon={<LocalOfferIcon />}
                            label="Promotion"
                            color="secondary"
                            size="small"
                          />
                        )}
                      </Box>

                      <Typography variant="caption" color="text.secondary">
                        Response Date: {formatDate(response.response_date)}
                      </Typography>

                      {response.notes && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Notes: {response.notes}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default SupplierResponseList;
