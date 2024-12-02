import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Link,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/material';
import {
  SwapHoriz as SwapIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';

function ReferenceChangesTab({ referenceChanges = [], onItemClick }) {
  const getSourceIcon = (changedByUser, supplierName) => {
    if (changedByUser) return <PersonIcon fontSize="small" />;
    if (supplierName) return <StoreIcon fontSize="small" />;
    return <DescriptionIcon fontSize="small" />;
  };

  const getSourceLabel = (changedByUser, supplierName) => {
    if (changedByUser) return 'Changed by user';
    if (supplierName) return `Changed by ${supplierName}`;
    return 'System change';
  };

  const getSourceColor = (changedByUser, supplierName) => {
    if (changedByUser) return 'primary';
    if (supplierName) return 'warning';
    return 'info';
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
        {/* Reference Changes Timeline */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>Reference Change History</Typography>
          <Timeline>
            {referenceChanges.map((change, index) => (
              <TimelineItem key={index}>
                <TimelineOppositeContent color="text.secondary">
                  {new Date(change.changeDate).toLocaleDateString()}
                </TimelineOppositeContent>
                
                <TimelineSeparator>
                  <TimelineDot color={getSourceColor(change.changedByUser, change.supplierName)}>
                    {getSourceIcon(change.changedByUser, change.supplierName)}
                  </TimelineDot>
                  {index < referenceChanges.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                
                <TimelineContent>
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Link
                          component="button"
                          onClick={() => onItemClick(change.originalItemId)}
                          underline="hover"
                        >
                          {change.originalItemId}
                        </Link>
                        <SwapIcon color="action" fontSize="small" />
                        <Link
                          component="button"
                          onClick={() => onItemClick(change.newReferenceId)}
                          underline="hover"
                        >
                          {change.newReferenceId}
                        </Link>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          icon={getSourceIcon(change.changedByUser, change.supplierName)}
                          label={getSourceLabel(change.changedByUser, change.supplierName)}
                          size="small"
                          color={getSourceColor(change.changedByUser, change.supplierName)}
                          variant="outlined"
                        />
                      </Box>

                      {change.notes && (
                        <Typography variant="body2" color="text.secondary">
                          {change.notes}
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </Paper>

        {/* Reference Change Summary */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>Reference Changes Summary</Typography>
          <Stack spacing={1}>
            <Box>
              <Typography variant="body2" color="text.secondary">Total Changes</Typography>
              <Typography variant="h6">{referenceChanges.length}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Latest Change</Typography>
              <Typography variant="body1">
                {new Date(referenceChanges[0].changeDate).toLocaleDateString()}
                {' by '}
                {getSourceLabel(
                  referenceChanges[0].changedByUser,
                  referenceChanges[0].supplierName
                )}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

export default ReferenceChangesTab;
