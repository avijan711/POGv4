-- Description: Revert direct changes to supplier_price_list table
-- This script safely removes the table so it can be recreated through migrations

-- First disable foreign key checks to avoid constraint issues
PRAGMA foreign_keys = OFF;

-- Drop the table if it exists
DROP TABLE IF EXISTS supplier_price_list;

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- Note: The table will be recreated from the last tracked migration
-- when the migration manager runs