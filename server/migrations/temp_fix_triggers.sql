DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry_update;

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
