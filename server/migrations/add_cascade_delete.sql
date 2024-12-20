-- Description: This migration adds ON DELETE CASCADE to price_history and fixes foreign key constraints

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Begin transaction for safety
BEGIN TRANSACTION;

-- First, drop any existing views that reference price_history
DROP VIEW IF EXISTS item_details;
DROP VIEW IF EXISTS valid_items;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry_update;

-- Create price_history table with ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS price_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    ils_retail_price REAL,
    qty_in_stock INTEGER DEFAULT 0,
    sold_this_year INTEGER DEFAULT 0,
    sold_last_year INTEGER DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE CASCADE,
    CHECK (ils_retail_price IS NULL OR ils_retail_price >= 0),
    CHECK (qty_in_stock >= 0),
    CHECK (sold_this_year >= 0),
    CHECK (sold_last_year >= 0)
);

-- Create indexes to maintain performance
CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date);

-- Recreate the triggers with proper syntax
CREATE TRIGGER update_price_history_on_inquiry 
AFTER INSERT ON inquiry_item 
BEGIN 
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date
    ) 
    SELECT 
        NEW.item_id,
        CAST(NEW.retail_price AS REAL),
        CAST(NEW.qty_in_stock AS INTEGER),
        CAST(NEW.sold_this_year AS INTEGER),
        CAST(NEW.sold_last_year AS INTEGER),
        i.date 
    FROM inquiry i 
    WHERE i.inquiry_id = NEW.inquiry_id;
END;

CREATE TRIGGER update_price_history_on_inquiry_update 
AFTER UPDATE ON inquiry_item 
WHEN NEW.qty_in_stock != OLD.qty_in_stock 
   OR NEW.sold_this_year != OLD.sold_this_year 
   OR NEW.sold_last_year != OLD.sold_last_year 
   OR NEW.retail_price != OLD.retail_price 
BEGIN 
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date
    ) 
    SELECT 
        NEW.item_id,
        CAST(NEW.retail_price AS REAL),
        CAST(NEW.qty_in_stock AS INTEGER),
        CAST(NEW.sold_this_year AS INTEGER),
        CAST(NEW.sold_last_year AS INTEGER),
        i.date 
    FROM inquiry i 
    WHERE i.inquiry_id = NEW.inquiry_id;
END;

-- Recreate the item_details view
CREATE VIEW item_details AS
WITH latest_price AS (
    SELECT
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date,
        ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY date DESC, history_id DESC) as rn
    FROM price_history
)
SELECT
    i.*,
    p.ils_retail_price as retail_price,
    p.qty_in_stock as current_stock,
    p.sold_this_year as current_year_sales,
    p.sold_last_year as last_year_sales,
    p.date as last_price_update
FROM item i
LEFT JOIN latest_price p ON i.item_id = p.item_id AND p.rn = 1;

-- Commit the transaction
COMMIT;

-- Verify the changes
SELECT 'Verifying price_history table...';
SELECT sql FROM sqlite_master WHERE type='table' AND name='price_history';

SELECT 'Verifying triggers...';
SELECT name, sql FROM sqlite_master 
WHERE type='trigger' AND name LIKE '%price_history%';

SELECT 'Verifying views...';
SELECT name, sql FROM sqlite_master
WHERE type='view' AND name IN ('item_details', 'valid_items');

-- Note: This migration:
-- 1. Enables foreign keys
-- 2. Drops existing views and triggers first
-- 3. Creates price_history table with ON DELETE CASCADE if it doesn't exist
-- 4. Adds appropriate indexes for performance
-- 5. Recreates triggers with proper syntax
-- 6. Recreates views
