-- Create trigger to sync promotion_item when new items are added
CREATE TRIGGER IF NOT EXISTS sync_promotion_items_on_item_insert
AFTER INSERT ON item
BEGIN
    -- Insert into promotion_item for any matching supplier_price_list entries
    INSERT INTO promotion_item (promotion_id, item_id, promotion_price)
    SELECT 
        spl.promotion_id,
        spl.item_id,
        spl.current_price
    FROM supplier_price_list spl
    WHERE spl.is_promotion = 1
    AND spl.item_id = NEW.item_id
    AND NOT EXISTS (
        SELECT 1 FROM promotion_item pi 
        WHERE pi.promotion_id = spl.promotion_id 
        AND pi.item_id = spl.item_id
    );
END;
