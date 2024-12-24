import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  FormGroup,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Divider,
  Tooltip,
  IconButton,
} from '@mui/material';
import { BugReport as BugIcon, Info as InfoIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const debugTypes = {
  general: {
    label: 'General Logs',
    description: 'Basic application logs and information',
  },
  errors: {
    label: 'Error Logs',
    description: 'Application errors and stack traces',
  },
  database: {
    label: 'Database Logs',
    description: 'SQL queries and database operations',
  },
  performance: {
    label: 'Performance Logs',
    description: 'Timing and performance measurements',
  },
  routes: {
    label: 'Route Logs',
    description: 'API route registrations and access',
  },
  middleware: {
    label: 'Middleware Logs',
    description: 'Middleware execution and processing',
  },
};

function DebugSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/settings/debug`);
      if (response.data?.success) {
        setSettings(response.data.settings || {});
      } else {
        throw new Error(response.data?.message || 'Failed to fetch debug settings');
      }
    } catch (err) {
      setError('Failed to load debug settings');
      console.error('Error fetching debug settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (type) => {
    setSaving(true);
    try {
      const newValue = !settings[type];
      const response = await axios.post(`${API_BASE_URL}/api/settings/debug`, {
        type,
        enabled: newValue,
      });
      
      if (response.data?.success) {
        setSettings(prev => ({
          ...prev,
          [type]: newValue,
        }));
      } else {
        throw new Error(response.data?.message || 'Failed to update setting');
      }
    } catch (err) {
      setError('Failed to update setting');
      console.error('Error updating debug setting:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <BugIcon sx={{ color: '#673ab7', mr: 1 }} />
        <Typography variant="h6">Debug Settings</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <FormGroup>
        {Object.entries(debugTypes).map(([type, { label, description }], index) => (
          <React.Fragment key={type}>
            {index > 0 && <Divider sx={{ my: 1 }} />}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings[type] || false}
                      onChange={() => handleToggle(type)}
                      disabled={saving}
                    />
                  }
                  label={label}
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {description}
                </Typography>
              </Box>
              <Tooltip title="These settings affect server performance. Enable only when needed.">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </React.Fragment>
        ))}
      </FormGroup>

      {saving && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}
    </Paper>
  );
}

export default DebugSettings;
