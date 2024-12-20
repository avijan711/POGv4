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
            setSettings(response.data);
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
                description
            });
            
            setSettings(prev => ({
                ...prev,
                [key]: response.data.setting
            }));

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
        return settings[key]?.value ?? defaultValue;
    }, [settings]);

    return {
        settings,
        loading,
        error,
        updateSetting,
        getSettingValue,
        refresh: loadSettings
    };
}
