-- Description: This migration fixes item queries to properly handle invalid IDs

-- First, remove any items with invalid IDs
DELETE FROM item WHERE trim(item_id) = '' OR item_id IS NULL;

-- Drop existing triggers
DROP TRIGGER IF EXISTS validate_item_id_null;
DROP TRIGGER IF EXISTS validate_item_id_empty;
DROP TRIGGER IF EXISTS validate_item_id_spaces;
DROP TRIGGER IF EXISTS validate_item_id_case;

-- Create trigger to validate null item_id
CREATE TRIGGER validate_item_id_null
BEFORE INSERT ON item
WHEN NEW.item_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'item_id cannot be null');
END;

-- Create trigger to validate empty item_id
CREATE TRIGGER validate_item_id_empty
BEFORE INSERT ON item
WHEN trim(NEW.item_id) = ''
BEGIN
    SELECT RAISE(ABORT, 'item_id cannot be empty');
END;

-- Create trigger to validate item_id spaces
CREATE TRIGGER validate_item_id_spaces
BEFORE INSERT ON item
WHEN NEW.item_id != trim(NEW.item_id)
BEGIN
    SELECT RAISE(ABORT, 'item_id cannot have leading or trailing spaces');
END;

-- Create trigger to validate item_id case
CREATE TRIGGER validate_item_id_case
BEFORE INSERT ON item
WHEN NEW.item_id != upper(NEW.item_id)
BEGIN
    SELECT RAISE(ABORT, 'item_id must be uppercase');
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
