import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Box,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useSettings } from '../hooks/useSettings';

import { EXCHANGE_RATE_KEY, DEFAULT_EXCHANGE_RATE } from '../constants';

function Settings() {
  const {
    settings,
    loading,
    error: settingsError,
    updateSetting,
    getSettingValue,
  } = useSettings();

  const [eurToIls, setEurToIls] = useState(DEFAULT_EXCHANGE_RATE);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Load initial value from settings
  useEffect(() => {
    const currentRate = parseFloat(getSettingValue(EXCHANGE_RATE_KEY, DEFAULT_EXCHANGE_RATE));
    setEurToIls(currentRate);
  }, [getSettingValue]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const success = await updateSetting(
        EXCHANGE_RATE_KEY, 
        parseFloat(eurToIls),
        'EUR to ILS exchange rate',
      );

      if (success) {
        setShowSuccess(true);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, mt: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Currency Settings
      </Typography>
      <Box sx={{ mt: 2 }}>
        <TextField
          label="EUR to ILS Exchange Rate"
          type="number"
          value={eurToIls}
          onChange={(e) => setEurToIls(e.target.value)}
          InputProps={{
            inputProps: { 
              step: '0.01',
              min: '0',
            },
          }}
          sx={{ width: '200px' }}
          disabled={saving}
          error={Boolean(error)}
          helperText={error || 'Used for price calculations'}
        />
        <Button 
          variant="contained" 
          onClick={handleSave}
          sx={{ ml: 2, mt: 1 }}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      <Snackbar 
        open={showSuccess} 
        autoHideDuration={6000} 
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Exchange rate updated successfully!
        </Alert>
      </Snackbar>

      {settingsError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error loading settings: {settingsError}
        </Alert>
      )}
    </Paper>
  );
}

export default Settings;
