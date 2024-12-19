import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert,
} from '@mui/material';
import { useSettings } from '../../hooks/useSettings';

export default function ExchangeRateDialog({ open, onClose }) {
    const { settings, updateSetting } = useSettings();
    const [rate, setRate] = useState(settings.eur_ils_rate?.value || '3.75');
    const [error, setError] = useState('');

    const handleSave = async () => {
        const numRate = parseFloat(rate);
        if (isNaN(numRate) || numRate <= 0) {
            setError('Please enter a valid positive number');
            return;
        }

        const success = await updateSetting('eur_ils_rate', numRate.toString(), 'Current EUR to ILS conversion rate');
        if (success) {
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Update Exchange Rate</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Current EUR/ILS Rate: {settings.eur_ils_rate?.value || '3.75'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Last Updated: {settings.eur_ils_rate?.updatedAt ? new Date(settings.eur_ils_rate.updatedAt).toLocaleString() : 'Never'}
                    </Typography>
                    <TextField
                        fullWidth
                        label="New Rate"
                        type="number"
                        value={rate}
                        onChange={(e) => {
                            setRate(e.target.value);
                            setError('');
                        }}
                        inputProps={{
                            min: 0,
                            step: 0.01
                        }}
                        sx={{ mt: 2 }}
                        error={!!error}
                        helperText={error}
                    />
                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Save</Button>
            </DialogActions>
        </Dialog>
    );
}
