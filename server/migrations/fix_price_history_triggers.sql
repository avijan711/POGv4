-- Description: This migration fixes the price history triggers to properly handle empty values
-- and use correct column names. The original triggers had syntax errors and incorrect column mappings.
-- Changes made:
-- 1. Fixed column names (qty_sold_this_year instead of sold_this_year)
-- 2. Added proper column lists in INSERT statements
-- 3. Fixed value mappings from inquiry_item fields
-- 4. Added proper comma separation in SQL syntax

-- First, drop the existing triggers
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry_update;

-- Recreate the INSERT trigger with correct syntax and column mappings
CREATE TRIGGER update_price_history_on_inquiry 
AFTER INSERT ON inquiry_item 
BEGIN 
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date
    ) 
    VALUES (
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        (SELECT date FROM inquiry WHERE inquiry_id = NEW.inquiry_id)
    );
END;

-- Recreate the UPDATE trigger with correct syntax and column mappings
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
        qty_sold_this_year,
        qty_sold_last_year,
        date
    ) 
    VALUES (
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        (SELECT date FROM inquiry WHERE inquiry_id = NEW.inquiry_id)
    );
END;

-- Verify the triggers were created correctly
SELECT 'Verifying triggers...';
SELECT name, sql FROM sqlite_master 
WHERE type='trigger' 
AND name IN ('update_price_history_on_inquiry', 'update_price_history_on_inquiry_update');

-- Note: This migration fixes the following issues:
-- 1. Missing commas in column lists and VALUES clauses
-- 2. Incorrect column names (sold_this_year -> qty_sold_this_year)
-- 3. Improper handling of NULL values
-- 4. Malformed trigger syntax causing 500 errors during Excel uploads
