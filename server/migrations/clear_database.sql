-- Disable foreign key constraints
PRAGMA foreign_keys = OFF;

-- Delete data in the correct order to avoid foreign key conflicts
DELETE FROM promotion_item;
DELETE FROM order_item;
DELETE FROM supplier_response_item;
DELETE FROM item_files;
DELETE FROM item_reference_change;
DELETE FROM price_history;
DELETE FROM supplier_price_list;
DELETE FROM inquiry_item;
DELETE FROM promotion;
DELETE FROM "order";
DELETE FROM supplier_response;
DELETE FROM inquiry;
DELETE FROM supplier;
DELETE FROM item;
DELETE FROM settings;

-- Reset SQLite sequences
DELETE FROM sqlite_sequence;

-- Drop indexes to avoid conflicts during recreation
DROP INDEX IF EXISTS idx_supplier_response_item_id;
DROP INDEX IF EXISTS idx_supplier_response_supplier_id;
DROP INDEX IF EXISTS idx_supplier_response_date;
DROP INDEX IF EXISTS idx_supplier_response_status;
DROP INDEX IF EXISTS idx_price_history_item_supplier;
DROP INDEX IF EXISTS idx_price_history_date;
DROP INDEX IF EXISTS idx_supplier_price_list_item;
DROP INDEX IF EXISTS idx_supplier_price_list_supplier;
DROP INDEX IF EXISTS idx_item_files_item_id;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
