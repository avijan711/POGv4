-- Description: This migration adds debug settings support

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add default debug settings if they don't exist
INSERT OR IGNORE INTO settings (key, value, description) 
VALUES (
    'debug',
    json_object(
        'general', json('true'),
        'errors', json('true'),
        'database', json('false'),
        'performance', json('false'),
        'routes', json('false'),
        'middleware', json('false')
    ),
    'Debug logging settings'
);

-- Create trigger to update the updated_at timestamp
DROP TRIGGER IF EXISTS update_settings_timestamp;
CREATE TRIGGER update_settings_timestamp
AFTER UPDATE ON settings
BEGIN
    UPDATE settings 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE key = NEW.key;
END;
