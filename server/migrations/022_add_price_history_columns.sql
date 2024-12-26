-- Add missing columns
ALTER TABLE price_history ADD COLUMN supplier_price REAL;
ALTER TABLE price_history ADD COLUMN notes TEXT;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_price_history_supplier ON price_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_source ON price_history(source_type);

-- Update existing records with supplier prices
UPDATE price_history 
SET 
    supplier_price = (
        SELECT current_price
        FROM supplier_price_list spl
        WHERE spl.item_id = price_history.item_id
        ORDER BY spl.last_updated DESC
        LIMIT 1
    )
WHERE supplier_price IS NULL;