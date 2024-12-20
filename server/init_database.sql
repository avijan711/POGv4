-- Disable foreign key checks
PRAGMA foreign_keys = OFF;

-- Drop existing views
DROP VIEW IF EXISTS item_details;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_item_timestamp;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry_update;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS update_price_history_on_supplier_response;
DROP TRIGGER IF EXISTS prevent_self_replacement;
DROP TRIGGER IF EXISTS prevent_self_reference;
DROP TRIGGER IF EXISTS prevent_self_reference_change;
DROP TRIGGER IF EXISTS set_original_item_id;
DROP TRIGGER IF EXISTS sync_promotion_items_on_item_insert;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_inquiry_item_inquiry;
DROP INDEX IF EXISTS idx_inquiry_item_item;
DROP INDEX IF EXISTS idx_inquiry_item_original;
DROP INDEX IF EXISTS idx_inquiry_item_reference;
DROP INDEX IF EXISTS idx_price_history_item;
DROP INDEX IF EXISTS idx_price_history_date;
DROP INDEX IF EXISTS idx_supplier_response_inquiry;
DROP INDEX IF EXISTS idx_supplier_response_supplier;
DROP INDEX IF EXISTS idx_supplier_response_item;
DROP INDEX IF EXISTS idx_supplier_response_date;
DROP INDEX IF EXISTS idx_order_inquiry;
DROP INDEX IF EXISTS idx_order_supplier;
DROP INDEX IF EXISTS idx_order_date;
DROP INDEX IF EXISTS idx_order_status;
DROP INDEX IF EXISTS idx_order_item_order;
DROP INDEX IF EXISTS idx_order_item_item;
DROP INDEX IF EXISTS idx_order_item_inquiry;
DROP INDEX IF EXISTS idx_promotion_supplier;
DROP INDEX IF EXISTS idx_promotion_dates;
DROP INDEX IF EXISTS idx_promotion_active;
DROP INDEX IF EXISTS idx_promotion_item_promotion;
DROP INDEX IF EXISTS idx_promotion_item_item;
DROP INDEX IF EXISTS idx_reference_changes_original;
DROP INDEX IF EXISTS idx_reference_changes_new;
DROP INDEX IF EXISTS idx_reference_changes_supplier;
DROP INDEX IF EXISTS idx_reference_changes_date;
DROP INDEX IF EXISTS idx_inquiry_items_original;
DROP INDEX IF EXISTS idx_inquiry_items_both_ids;
DROP INDEX IF EXISTS idx_supplier_prices_item;
DROP INDEX IF EXISTS idx_supplier_prices_supplier;
DROP INDEX IF EXISTS idx_inquiry_item_retail;
DROP INDEX IF EXISTS idx_supplier_price_list_item;
DROP INDEX IF EXISTS idx_supplier_price_list_supplier;

-- Drop existing tables in correct order
DROP TABLE IF EXISTS promotion_item;
DROP TABLE IF EXISTS promotion;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS "order";
DROP TABLE IF EXISTS supplier_response_item;
DROP TABLE IF EXISTS supplier_response;
DROP TABLE IF EXISTS item_history;
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS inquiry_item;
DROP TABLE IF EXISTS inquiry;
DROP TABLE IF EXISTS item_reference_change;
DROP TABLE IF EXISTS supplier_price_list;
DROP TABLE IF EXISTS supplier_price;
DROP TABLE IF EXISTS supplier;
DROP TABLE IF EXISTS item;

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- Vacuum database to reclaim space
VACUUM;
