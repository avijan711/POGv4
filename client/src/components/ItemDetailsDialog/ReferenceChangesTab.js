import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Link,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
} from '@mui/material';
import { 
  SwapHoriz as SwapIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useReference } from './ReferenceContext';

function ReferenceChangesTab({ referenceChanges = [] }) {
  const {
    onItemClick,
    getSourceIcon,
    getSourceLabel,
    styles,
  } = useReference();

  const getSourceColor = (source) => {
    switch (source) {
    case 'user':
      return 'primary';
    case 'supplier':
      return 'warning';
    default:
      return 'info';
    }
  };

  if (!referenceChanges.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography color="text.secondary" align="center">
            No reference changes found
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* Reference Changes List */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>Reference Change History</Typography>
          <List>
            {referenceChanges.map((change, index) => (
              <ListItem 
                key={index}
                sx={{ 
                  mb: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {new Date(change.change_date).toLocaleDateString()}
                      </Typography>
                      <Tooltip title={getSourceLabel(change.source, change.supplier_name)}>
                        <Chip
                          icon={getSourceIcon(change.source, change.supplier_name)}
                          label={change.source === 'supplier' ? change.supplier_name : 'User'}
                          size="small"
                          color={getSourceColor(change.source)}
                          variant="outlined"
                        />
                      </Tooltip>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      {/* Item IDs with descriptions */}
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                        bgcolor: 'grey.50',
                        p: 1.5,
                        borderRadius: 1,
                      }}>
                        <Stack>
                          <Link
                            component="button"
                            onClick={() => onItemClick(change.original_item_id)}
                            underline="hover"
                            sx={{ fontWeight: 'medium' }}
                          >
                            {change.original_item_id}
                          </Link>
                          <Typography variant="body2" color="text.secondary" sx={{ direction: 'rtl' }}>
                            {change.original_description}
                          </Typography>
                        </Stack>
                        <ArrowForwardIcon color="action" />
                        <Stack>
                          <Link
                            component="button"
                            onClick={() => onItemClick(change.new_reference_id)}
                            underline="hover"
                            sx={{ fontWeight: 'medium' }}
                          >
                            {change.new_reference_id}
                          </Link>
                          <Typography variant="body2" color="text.secondary" sx={{ direction: 'rtl' }}>
                            {change.new_description}
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Notes */}
                      {change.notes && (
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{
                            mt: 1,
                            bgcolor: 'grey.50',
                            p: 1,
                            borderRadius: 1,
                            fontStyle: 'italic',
                          }}
                        >
                          {change.notes}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Reference Change Summary */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" gutterBottom>Reference Changes Summary</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">Total Changes</Typography>
              <Typography variant="h6">{referenceChanges.length}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Latest Change</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  icon={getSourceIcon(referenceChanges[0].source, referenceChanges[0].supplier_name)}
                  label={getSourceLabel(referenceChanges[0].source, referenceChanges[0].supplier_name)}
                  size="small"
                  color={getSourceColor(referenceChanges[0].source)}
                  variant="outlined"
                />
                <Typography variant="body2" color="text.secondary">
                  on {new Date(referenceChanges[0].change_date).toLocaleDateString()}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

export default ReferenceChangesTab;
