-- Drop and recreate migrations table
DROP TABLE IF EXISTS schema_migrations;

CREATE TABLE schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL DEFAULT 0,
    error_message TEXT
);

-- Create indexes
CREATE INDEX idx_migrations_filename ON schema_migrations(filename);
CREATE INDEX idx_migrations_success ON schema_migrations(success);