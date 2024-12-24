import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export function useSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/settings`);
      if (response.data?.success && Array.isArray(response.data.settings)) {
        // Convert array of settings to an object keyed by setting key
        const settingsObj = response.data.settings.reduce((acc, setting) => {
          acc[setting.key] = setting;
          return acc;
        }, {});
        setSettings(settingsObj);
      } else {
        throw new Error('Invalid settings data received from server');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSetting = useCallback(async (key, value, description) => {
    try {
      setError(null);
      const response = await axios.put(`${API_BASE_URL}/api/settings/${key}`, {
        value,
        description,
      });
            
      if (response.data?.success && response.data.setting) {
        setSettings(prev => ({
          ...prev,
          [key]: response.data.setting,
        }));
      } else {
        throw new Error('Invalid response from server');
      }

      return true;
    } catch (err) {
      console.error('Error updating setting:', err);
      setError(err.message);
      return false;
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const getSettingValue = useCallback((key, defaultValue = null) => {
    const value = settings[key]?.value;
    
    // If value doesn't exist, return default
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    // If value is numeric, return as number
    if (!isNaN(value)) {
      return parseFloat(value);
    }
    
    return value;
  }, [settings]);

  return {
    settings,
    loading,
    error,
    updateSetting,
    getSettingValue,
    refresh: loadSettings,
  };
}
