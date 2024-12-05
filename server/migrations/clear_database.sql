-- Part 1: Delete data (to be executed in a transaction)
PRAGMA foreign_keys = OFF;

DELETE FROM promotion_item;
DELETE FROM order_item;
DELETE FROM supplier_response_item;
DELETE FROM promotion;
DELETE FROM "order";
DELETE FROM supplier_response;
DELETE FROM price_history;
DELETE FROM inquiry_item;
DELETE FROM inquiry;
DELETE FROM item_files;
DELETE FROM item_reference_change;
DELETE FROM supplier;
DELETE FROM item;

-- Part 2: VACUUM (to be executed separately)
-- VACUUM;

-- Part 3: Re-enable foreign keys (to be executed after VACUUM)
-- PRAGMA foreign_keys = ON;
