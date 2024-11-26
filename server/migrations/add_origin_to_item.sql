-- Add origin column to item table
ALTER TABLE item ADD COLUMN origin TEXT DEFAULT '';

-- Update existing items with origin from inquiry_item table
UPDATE item 
SET origin = (
    SELECT origin 
    FROM inquiry_item 
    WHERE inquiry_item.item_id = item.item_id
    AND inquiry_item.origin IS NOT NULL
    ORDER BY inquiry_item.inquiry_item_id DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM inquiry_item 
    WHERE inquiry_item.item_id = item.item_id
    AND inquiry_item.origin IS NOT NULL
);
