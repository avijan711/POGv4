-- Add missing columns to price_history table
ALTER TABLE price_history ADD COLUMN supplier_price REAL;
ALTER TABLE price_history ADD COLUMN notes TEXT;

-- Update existing records with supplier prices
UPDATE price_history 
SET supplier_price = (
    SELECT current_price
    FROM supplier_price_list spl
    WHERE spl.item_id = price_history.item_id
    ORDER BY spl.last_updated DESC
    LIMIT 1
)
WHERE supplier_price IS NULL;