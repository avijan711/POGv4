-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add EUR/ILS rate setting
INSERT INTO settings (key, value, description)
VALUES (
    'eur_ils_rate',
    '3.75',
    'Current EUR to ILS conversion rate'
) ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = CURRENT_TIMESTAMP;

-- Create trigger to update timestamp
CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
AFTER UPDATE ON settings
BEGIN
    UPDATE settings 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE key = NEW.key;
END;
