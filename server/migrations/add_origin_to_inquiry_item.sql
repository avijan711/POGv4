-- Add origin column to inquiry_item table
ALTER TABLE inquiry_item ADD COLUMN origin TEXT DEFAULT '';

-- Update existing inquiry items with origin from item table
UPDATE inquiry_item 
SET origin = (
    SELECT origin 
    FROM item 
    WHERE item.item_id = inquiry_item.item_id
)
WHERE EXISTS (
    SELECT 1 
    FROM item 
    WHERE item.item_id = inquiry_item.item_id
    AND item.origin IS NOT NULL
);
