-- Drop existing triggers
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry_update;

-- Create INSERT trigger
CREATE TRIGGER update_price_history_on_inquiry
AFTER INSERT ON inquiry_item
WHEN NEW.retail_price IS NOT NULL
BEGIN
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
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

-- Create UPDATE trigger
CREATE TRIGGER update_price_history_on_inquiry_update
AFTER UPDATE ON inquiry_item
WHEN NEW.retail_price IS NOT NULL
BEGIN
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
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
