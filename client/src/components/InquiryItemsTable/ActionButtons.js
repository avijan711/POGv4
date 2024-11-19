import React from 'react';
import { Box, Button, IconButton } from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    gap: 1
  },
  viewButton: {
    minWidth: '100px',
    padding: '8px 16px',
    '&:hover': { 
      backgroundColor: 'primary.dark',
      transform: 'scale(1.02)',
    },
    transition: 'all 0.2s',
    zIndex: 1,
  },
  editButton: {
    '&:hover': { 
      backgroundColor: 'rgba(0, 0, 0, 0.1)' 
    }
  },
  deleteButton: {
    '&:hover': { 
      backgroundColor: 'rgba(211, 47, 47, 0.1)',
      color: 'error.main',
    }
  }
};

function ActionButtons({
  onView,
  onEdit,
  onDelete
}) {
  const handleClick = (handler) => (e) => {
    e.stopPropagation();
    handler();
  };

  return (
    <Box sx={styles.container}>
      <Button
        variant="contained"
        size="small"
        color="primary"
        onClick={handleClick(onView)}
        startIcon={<VisibilityIcon />}
        sx={styles.viewButton}
      >
        View
      </Button>
      <IconButton 
        size="small" 
        onClick={handleClick(onEdit)}
        sx={styles.editButton}
      >
        <EditIcon />
      </IconButton>
      <IconButton 
        size="small" 
        onClick={handleClick(onDelete)}
        sx={styles.deleteButton}
      >
        <DeleteIcon />
      </IconButton>
    </Box>
  );
}

export default ActionButtons;
