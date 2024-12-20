-- Disable foreign key checks temporarily
PRAGMA foreign_keys = OFF;

-- Begin transaction
BEGIN TRANSACTION;

-- Step 1: Backup existing data
CREATE TABLE IF NOT EXISTS item_backup AS SELECT * FROM item;
CREATE TABLE IF NOT EXISTS supplier_backup AS SELECT * FROM supplier;
CREATE TABLE IF NOT EXISTS inquiry_backup AS SELECT * FROM inquiry;
CREATE TABLE IF NOT EXISTS inquiry_item_backup AS SELECT * FROM inquiry_item;
CREATE TABLE IF NOT EXISTS price_history_backup AS SELECT * FROM price_history;
CREATE TABLE IF NOT EXISTS supplier_response_backup AS SELECT * FROM supplier_response;
CREATE TABLE IF NOT EXISTS supplier_response_item_backup AS SELECT * FROM supplier_response_item;
CREATE TABLE IF NOT EXISTS "order_backup" AS SELECT * FROM "order";
CREATE TABLE IF NOT EXISTS order_item_backup AS SELECT * FROM order_item;
CREATE TABLE IF NOT EXISTS promotion_backup AS SELECT * FROM promotion;
CREATE TABLE IF NOT EXISTS promotion_item_backup AS SELECT * FROM promotion_item;

-- Step 2: Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS promotion_item;
DROP TABLE IF EXISTS promotion;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS "order";
DROP TABLE IF EXISTS supplier_response_item;
DROP TABLE IF EXISTS supplier_response;
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS inquiry_item;
DROP TABLE IF EXISTS inquiry;
DROP TABLE IF EXISTS item_reference_change;
DROP TABLE IF EXISTS supplier;
DROP TABLE IF EXISTS item;

-- Step 3: Create new schema
.read schema.sql

-- Step 4: Migrate data to new schema

-- Migrate Item data
INSERT INTO item (
    item_id,
    hebrew_description,
    english_description,
    import_markup,
    hs_code,
    image,
    last_updated
)
SELECT
    item_id,
    hebrew_description,
    english_description,
    COALESCE(NULLIF(CAST(import_markup AS REAL), 0), 1.30),
    hs_code,
    image,
    CURRENT_TIMESTAMP
FROM item_backup;

-- Migrate Supplier data
INSERT INTO supplier (
    supplier_id,
    name,
    contact_person,
    email,
    phone
)
SELECT
    supplier_id,
    name,
    contact_person,
    email,
    phone
FROM supplier_backup;

-- Migrate Inquiry data
INSERT INTO inquiry (
    inquiry_id,
    inquiry_number,
    status,
    date
)
SELECT
    inquiry_id,
    inquiry_number,
    CASE status 
        WHEN '' THEN 'new'
        WHEN NULL THEN 'new'
        ELSE status 
    END,
    COALESCE(date, CURRENT_TIMESTAMP)
FROM inquiry_backup;

-- Migrate InquiryItem data
INSERT INTO inquiry_item (
    inquiry_item_id,
    inquiry_id,
    item_id,
    requested_qty,
    hebrew_description,
    english_description,
    hs_code,
    import_markup,
    qty_in_stock,
    retail_price,
    sold_this_year,
    sold_last_year,
    new_reference_id,
    reference_notes
)
SELECT
    inquiry_item_id,
    inquiry_id,
    item_id,
    COALESCE(requested_qty, 0),
    hebrew_description,
    english_description,
    hs_code,
    NULLIF(CAST(import_markup AS REAL), 0),
    COALESCE(qty_in_stock, 0),
    NULLIF(CAST(retail_price AS REAL), 0),
    COALESCE(sold_this_year, 0),
    COALESCE(sold_last_year, 0),
    NULLIF(new_reference_id, item_id),
    reference_notes
FROM inquiry_item_backup;

-- Migrate price history data
INSERT INTO price_history (
    item_id,
    ils_retail_price,
    qty_in_stock,
    qty_sold_this_year,
    qty_sold_last_year,
    date
)
SELECT
    item_id,
    ils_retail_price,
    COALESCE(qty_in_stock, 0),
    COALESCE(qty_sold_this_year, 0),
    COALESCE(qty_sold_last_year, 0),
    date
FROM price_history_backup;

-- Migrate SupplierResponse data
INSERT INTO supplier_response (
    supplier_response_id,
    inquiry_id,
    supplier_id,
    item_id,
    price_quoted,
    status,
    is_promotion,
    promotion_name,
    response_date
)
SELECT
    supplier_response_id,
    inquiry_id,
    supplier_id,
    item_id,
    NULLIF(CAST(price_quoted AS REAL), 0),
    COALESCE(status, 'pending'),
    COALESCE(is_promotion, 0),
    promotion_name,
    COALESCE(response_date, CURRENT_TIMESTAMP)
FROM supplier_response_backup;

-- Migrate SupplierResponseItem data
INSERT INTO supplier_response_item (
    response_item_id,
    supplier_response_id,
    item_id,
    price,
    notes,
    hs_code,
    english_description,
    new_reference_id
)
SELECT
    response_item_id,
    supplier_response_id,
    item_id,
    NULLIF(CAST(price AS REAL), 0),
    notes,
    hs_code,
    english_description,
    new_reference_id
FROM supplier_response_item_backup;

-- Migrate Order data
INSERT INTO "order" (
    order_id,
    inquiry_id,
    supplier_id,
    order_date,
    status,
    notes
)
SELECT
    order_id,
    inquiry_id,
    supplier_id,
    COALESCE(order_date, CURRENT_TIMESTAMP),
    COALESCE(status, 'pending'),
    notes
FROM order_backup;

-- Migrate OrderItem data
INSERT INTO order_item (
    order_item_id,
    order_id,
    item_id,
    inquiry_item_id,
    quantity,
    price_quoted,
    is_promotion,
    promotion_id,
    supplier_response_id
)
SELECT
    order_item_id,
    order_id,
    item_id,
    inquiry_item_id,
    COALESCE(quantity, 1),
    COALESCE(NULLIF(CAST(price_quoted AS REAL), 0), 0.01),
    COALESCE(is_promotion, 0),
    promotion_id,
    supplier_response_id
FROM order_item_backup;

-- Migrate Promotion data
INSERT INTO promotion (
    promotion_id,
    name,
    supplier_id,
    start_date,
    end_date,
    is_active,
    created_at
)
SELECT
    promotion_id,
    name,
    supplier_id,
    start_date,
    COALESCE(end_date, datetime(start_date, '+30 days')),
    COALESCE(is_active, 1),
    COALESCE(created_at, CURRENT_TIMESTAMP)
FROM promotion_backup;

-- Migrate PromotionItem data
INSERT INTO promotion_item (
    promotion_item_id,
    promotion_id,
    item_id,
    promotion_price,
    created_at
)
SELECT
    promotion_item_id,
    promotion_id,
    item_id,
    COALESCE(NULLIF(CAST(promotion_price AS REAL), 0), 0.01),
    COALESCE(created_at, CURRENT_TIMESTAMP)
FROM promotion_item_backup;

-- Step 5: Verify data integrity
SELECT CASE 
    WHEN (SELECT COUNT(*) FROM item) = (SELECT COUNT(*) FROM item_backup)
    AND (SELECT COUNT(*) FROM supplier) = (SELECT COUNT(*) FROM supplier_backup)
    AND (SELECT COUNT(*) FROM inquiry) = (SELECT COUNT(*) FROM inquiry_backup)
    AND (SELECT COUNT(*) FROM inquiry_item) = (SELECT COUNT(*) FROM inquiry_item_backup)
    AND (SELECT COUNT(*) FROM supplier_response) = (SELECT COUNT(*) FROM supplier_response_backup)
    AND (SELECT COUNT(*) FROM supplier_response_item) = (SELECT COUNT(*) FROM supplier_response_item_backup)
    AND (SELECT COUNT(*) FROM "order") = (SELECT COUNT(*) FROM order_backup)
    AND (SELECT COUNT(*) FROM order_item) = (SELECT COUNT(*) FROM order_item_backup)
    AND (SELECT COUNT(*) FROM promotion) = (SELECT COUNT(*) FROM promotion_backup)
    AND (SELECT COUNT(*) FROM promotion_item) = (SELECT COUNT(*) FROM promotion_item_backup)
    THEN 'Migration successful'
    ELSE 'Migration failed - data count mismatch'
END as migration_status;

-- Additional data quality checks
SELECT 'Invalid prices' as issue, COUNT(*) as count
FROM order_item WHERE price_quoted <= 0
UNION ALL
SELECT 'Invalid quantities', COUNT(*)
FROM order_item WHERE quantity <= 0
UNION ALL
SELECT 'Self-referencing items', COUNT(*)
FROM inquiry_item WHERE item_id = new_reference_id
UNION ALL
SELECT 'Invalid promotion prices', COUNT(*)
FROM promotion_item WHERE promotion_price <= 0;

-- Step 6: Clean up backup tables (only if migration was successful)
-- DROP TABLE IF EXISTS item_backup;
-- DROP TABLE IF EXISTS supplier_backup;
-- DROP TABLE IF EXISTS inquiry_backup;
-- DROP TABLE IF EXISTS inquiry_item_backup;
-- DROP TABLE IF EXISTS price_history_backup;
-- DROP TABLE IF EXISTS supplier_response_backup;
-- DROP TABLE IF EXISTS supplier_response_item_backup;
-- DROP TABLE IF EXISTS order_backup;
-- DROP TABLE IF EXISTS order_item_backup;
-- DROP TABLE IF EXISTS promotion_backup;
-- DROP TABLE IF EXISTS promotion_item_backup;

COMMIT;

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- Vacuum database to reclaim space and rebuild indexes
VACUUM;
