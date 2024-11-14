import React, { useState } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Box,
  Button,
  Snackbar,
  Alert
} from '@mui/material';
import { API_BASE_URL } from '../config';

function Settings() {
  const [eurToIls, setEurToIls] = useState('3.95');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eurToIls: parseFloat(eurToIls)
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
      } else {
        setShowError(true);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setShowError(true);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Settings
      </Typography>
      <Box sx={{ mt: 2 }}>
        <TextField
          label="EUR to ILS Rate"
          type="number"
          value={eurToIls}
          onChange={(e) => setEurToIls(e.target.value)}
          InputProps={{
            inputProps: { 
              step: "0.01",
              min: "0"
            }
          }}
          sx={{ width: '200px' }}
        />
        <Button 
          variant="contained" 
          onClick={handleSave}
          sx={{ ml: 2, mt: 1 }}
        >
          Save Settings
        </Button>
      </Box>

      <Snackbar 
        open={showSuccess} 
        autoHideDuration={6000} 
        onClose={() => setShowSuccess(false)}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Settings saved successfully!
        </Alert>
      </Snackbar>

      <Snackbar 
        open={showError} 
        autoHideDuration={6000} 
        onClose={() => setShowError(false)}
      >
        <Alert severity="error" onClose={() => setShowError(false)}>
          Error saving settings. Please try again.
        </Alert>
      </Snackbar>
    </Paper>
  );
}

export default Settings;
