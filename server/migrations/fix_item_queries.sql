-- Description: This migration fixes item queries to properly handle invalid IDs

-- First, remove any items with invalid IDs
DELETE FROM item WHERE trim(item_id) = '' OR item_id IS NULL;

-- Create a function to validate item IDs
CREATE TRIGGER IF NOT EXISTS validate_item_id_format
BEFORE INSERT ON item
BEGIN
    SELECT CASE
        WHEN NEW.item_id IS NULL THEN
            RAISE(ABORT, 'item_id cannot be null')
        WHEN trim(NEW.item_id) = '' THEN
            RAISE(ABORT, 'item_id cannot be empty')
        WHEN NEW.item_id != trim(NEW.item_id) THEN
            RAISE(ABORT, 'item_id cannot have leading or trailing spaces')
        WHEN NEW.item_id != upper(NEW.item_id) THEN
            RAISE(ABORT, 'item_id must be uppercase')
    END;
END;

-- Create a view that only returns valid items
CREATE VIEW IF NOT EXISTS valid_items AS
SELECT 
    i.*,
    p.ils_retail_price as retail_price,
    p.qty_in_stock,
    p.sold_this_year,
    p.sold_last_year,
    p.date as last_price_update,
    CASE 
        WHEN rc.original_item_id IS NOT NULL THEN json_object(
            'original_item_id', rc.original_item_id,
            'new_reference_id', rc.new_reference_id,
            'supplier_name', rc.supplier_name,
            'changed_by_user', rc.changed_by_user,
            'change_date', rc.change_date,
            'notes', rc.notes,
            'new_description', rc.new_description,
            'new_english_description', rc.new_english_description,
            'source', CASE 
                WHEN rc.changed_by_user = 1 THEN 'user'
                ELSE 'supplier'
            END
        )
        ELSE NULL
    END as reference_change,
    CASE 
        WHEN rc.original_item_id IS NOT NULL THEN 1
        ELSE 0
    END as has_reference_change,
    CASE 
        WHEN ri.referencing_items IS NOT NULL THEN 1
        ELSE 0
    END as is_referenced_by,
    ri.referencing_items
FROM item i
LEFT JOIN (
    SELECT 
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date,
        ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY date DESC, history_id DESC) as rn
    FROM price_history
) p ON i.item_id = p.item_id AND p.rn = 1
LEFT JOIN (
    SELECT 
        rc.original_item_id,
        rc.new_reference_id,
        s.name as supplier_name,
        rc.changed_by_user,
        rc.change_date,
        rc.notes,
        i2.hebrew_description as new_description,
        i2.english_description as new_english_description,
        ROW_NUMBER() OVER (PARTITION BY rc.original_item_id ORDER BY rc.change_date DESC) as rn
    FROM item_reference_change rc
    LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
    LEFT JOIN item i2 ON rc.new_reference_id = i2.item_id
) rc ON i.item_id = rc.original_item_id AND rc.rn = 1
LEFT JOIN (
    SELECT 
        rc.new_reference_id as item_id,
        GROUP_CONCAT(rc.original_item_id) as referencing_items
    FROM item_reference_change rc
    GROUP BY rc.new_reference_id
) ri ON i.item_id = ri.item_id
WHERE trim(i.item_id) != '' AND i.item_id IS NOT NULL
ORDER BY i.item_id;

-- Verify the changes
SELECT 'Verifying empty items...';
SELECT COUNT(*) as empty_items FROM item WHERE trim(item_id) = '' OR item_id IS NULL;

SELECT 'Verifying view...';
SELECT COUNT(*) as valid_items FROM valid_items;

-- Note: This migration:
-- 1. Removes any existing items with invalid IDs
-- 2. Adds a trigger to prevent invalid IDs
-- 3. Creates a view that only returns valid items
-- 4. The view can be used in place of the current getAllItems query
