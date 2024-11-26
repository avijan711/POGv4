-- Begin transaction
BEGIN TRANSACTION;

-- Drop views first
DROP VIEW IF EXISTS ItemDetails;
DROP VIEW IF EXISTS item_details;

-- Drop duplicate promotion tables
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS promotion_items;

-- Drop duplicate tables
DROP TABLE IF EXISTS InquiryItem;
DROP TABLE IF EXISTS OrderItem;
DROP TABLE IF EXISTS SupplierResponse;

-- Rename PascalCase tables to snake_case
ALTER TABLE ItemHistory RENAME TO item_history;
ALTER TABLE ItemReferenceChange RENAME TO item_reference_change;
ALTER TABLE SupplierPrice RENAME TO supplier_price;
ALTER TABLE SupplierResponseItem RENAME TO supplier_response_item;

-- Recreate item_details view with correct column names
CREATE VIEW item_details AS
WITH latest_price AS (
    SELECT 
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date
    FROM price_history
    WHERE (item_id, date) IN (
        SELECT item_id, MAX(date)
        FROM price_history
        GROUP BY item_id
    )
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
    p.qty_sold_this_year as current_year_sales,
    p.qty_sold_last_year as last_year_sales,
    p.date as last_price_update
FROM item i
LEFT JOIN latest_price p ON i.item_id = p.item_id;

-- Verify changes
SELECT 'Current tables:';
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

SELECT 'Current views:';
SELECT name FROM sqlite_master WHERE type='view' ORDER BY name;

-- Commit transaction
COMMIT;
