-- Create migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL DEFAULT 0,
    error_message TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_migrations_filename ON schema_migrations(filename);

-- Create index for checking migration status
CREATE INDEX IF NOT EXISTS idx_migrations_success ON schema_migrations(success);