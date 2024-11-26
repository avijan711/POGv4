-- Add origin column to supplier_response_item table
ALTER TABLE supplier_response_item ADD COLUMN origin TEXT DEFAULT '';

-- Update existing supplier response items with origin from item table
UPDATE supplier_response_item 
SET origin = (
    SELECT origin 
    FROM item 
    WHERE item.item_id = supplier_response_item.item_id
)
WHERE EXISTS (
    SELECT 1 
    FROM item 
    WHERE item.item_id = supplier_response_item.item_id
    AND item.origin IS NOT NULL
);
