-- Add missing columns to price_history table
ALTER TABLE price_history ADD COLUMN supplier_price REAL;
ALTER TABLE price_history ADD COLUMN notes TEXT;

-- Update existing records with supplier prices
UPDATE price_history 
SET supplier_price = (
    SELECT current_price
    FROM supplier_price_list
    WHERE supplier_price_list.item_id = price_history.item_id
    AND supplier_price_list.supplier_id = price_history.supplier_id
    ORDER BY supplier_price_list.last_updated DESC
    LIMIT 1
)
WHERE supplier_price IS NULL;

-- Update triggers to include supplier_price
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
CREATE TRIGGER update_price_history_on_inquiry 
AFTER INSERT ON inquiry_item 
BEGIN 
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date,
        source_type,
        source_id,
        supplier_price,
        supplier_id,
        notes
    ) 
    SELECT
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        i.date,
        'inquiry',
        NEW.inquiry_id,
        NEW.supplier_price,
        NEW.supplier_id,
        NULL
    FROM inquiry i
    WHERE i.inquiry_id = NEW.inquiry_id;
END;

DROP TRIGGER IF EXISTS update_price_history_on_inquiry_update;
CREATE TRIGGER update_price_history_on_inquiry_update 
AFTER UPDATE ON inquiry_item 
WHEN NEW.qty_in_stock != OLD.qty_in_stock 
   OR NEW.sold_this_year != OLD.sold_this_year 
   OR NEW.sold_last_year != OLD.sold_last_year 
   OR NEW.retail_price != OLD.retail_price 
   OR NEW.supplier_price != OLD.supplier_price
   OR NEW.supplier_id != OLD.supplier_id
BEGIN 
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date,
        source_type,
        source_id,
        supplier_price,
        supplier_id,
        notes
    ) 
    SELECT
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        i.date,
        'inquiry',
        NEW.inquiry_id,
        NEW.supplier_price,
        NEW.supplier_id,
        NULL
    FROM inquiry i
    WHERE i.inquiry_id = NEW.inquiry_id;
END;