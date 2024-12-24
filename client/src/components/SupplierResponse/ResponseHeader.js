import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import { Assignment as AssignmentIcon } from '@mui/icons-material';

const ResponseHeader = ({ responsesCount }) => {
  const totalExpected = 2; // Total expected responses
  const progress = (responsesCount / totalExpected) * 100;

  return (
    <Box sx={{ 
      mb: 3,
      pb: 2,
      borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
    }}>
      {/* Header section */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 1,
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
        }}>
          <AssignmentIcon color="primary" />
          <Typography variant="h6" component="h2" color="primary">
            Supplier Responses
          </Typography>
        </Box>
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ fontWeight: 500 }}
        >
          Progress {responsesCount} / {totalExpected}
        </Typography>
      </Box>
      
      {/* Progress bar */}
      <Box sx={{ 
        width: '100%',
        mt: 1,
      }}>
        <LinearProgress 
          variant="determinate" 
          value={progress}
          sx={{ 
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(76, 175, 80, 0.08)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              backgroundColor: 'success.main',
              transition: 'transform 0.4s ease',
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default ResponseHeader;
