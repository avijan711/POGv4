-- Save settings data
CREATE TEMP TABLE settings_backup AS SELECT * FROM settings;

-- Disable foreign key constraints
PRAGMA foreign_keys = OFF;

-- Drop backup tables and corrupted tables
DROP TABLE IF EXISTS item_backup;
DROP TABLE IF EXISTS supplier_backup;
DROP TABLE IF EXISTS inquiry_backup;
DROP TABLE IF EXISTS price_history_backup;
DROP TABLE IF EXISTS supplier_response_backup;
DROP TABLE IF EXISTS supplier_response_item_backup;
DROP TABLE IF EXISTS order_backup;
DROP TABLE IF EXISTS order_item_backup;
DROP TABLE IF EXISTS promotion_backup;
DROP TABLE IF EXISTS promotion_item_backup;
DROP TABLE IF EXISTS promotionX;
DROP TABLE IF EXISTS promotion_itemX;
DROP TABLE IF EXISTS settingsX;
DROP TABLE IF EXISTS supplierX;
DROP TABLE IF EXISTS supplier_backupX;
DROP TABLE IF EXISTS supplier_price_listX;
DROP TABLE IF EXISTS supplier_responseX;

-- Drop view
DROP VIEW IF EXISTS item_details;

-- Drop existing data
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

-- Reset sequences
DELETE FROM sqlite_sequence;

-- Restore settings data
INSERT INTO settings SELECT * FROM settings_backup;
DROP TABLE settings_backup;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Recreate view
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
    i.item_id,
    i.hebrew_description,
    i.english_description,
    i.import_markup,
    i.hs_code,
    i.image,
    i.notes,
    i.origin,
    i.last_updated,
    p.ils_retail_price as retail_price,
    p.qty_in_stock as current_stock,
    p.sold_this_year as current_year_sales,
    p.sold_last_year as last_year_sales,
    p.date as last_price_update
FROM item i
LEFT JOIN latest_price p ON i.item_id = p.item_id AND p.rn = 1;
