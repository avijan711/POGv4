-- Description: This migration adds constraints on the item table
-- to prevent duplicate items and ensure data integrity.
-- Changes:
-- 1. Adds UNIQUE constraint on item_id
-- 2. Adds trigger to validate item_id format
-- 3. Adds trigger to prevent item_id updates
-- 4. Adds trigger to enforce reference format

-- Add UNIQUE constraint on item_id if not exists
-- Note: SQLite PRIMARY KEY is already UNIQUE, this is just for explicit documentation
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_id_unique ON item(item_id);

-- Drop existing triggers first
DROP TRIGGER IF EXISTS validate_item_id;
DROP TRIGGER IF EXISTS validate_item_id_format;
DROP TRIGGER IF EXISTS prevent_item_id_update;
DROP TRIGGER IF EXISTS validate_reference_format;

-- Add trigger to validate item_id format on insert
CREATE TRIGGER validate_item_id 
BEFORE INSERT ON item 
WHEN NEW.item_id IS NULL OR trim(NEW.item_id) = ''
BEGIN
    SELECT RAISE(ABORT, 'item_id cannot be empty or null');
END;

-- Add trigger to enforce item_id format
CREATE TRIGGER validate_item_id_format
BEFORE INSERT ON item
WHEN NEW.item_id != trim(NEW.item_id) OR NEW.item_id != upper(NEW.item_id)
BEGIN
    SELECT RAISE(ABORT, 'item_id must be uppercase and trimmed');
END;

-- Add trigger to prevent updates to item_id
CREATE TRIGGER prevent_item_id_update 
BEFORE UPDATE ON item 
WHEN OLD.item_id != NEW.item_id
BEGIN
    SELECT RAISE(ABORT, 'item_id cannot be modified');
END;

-- Add trigger to enforce item_id format on reference changes
CREATE TRIGGER validate_reference_format 
BEFORE INSERT ON item_reference_change 
WHEN NEW.original_item_id != upper(trim(NEW.original_item_id)) 
   OR NEW.new_reference_id != upper(trim(NEW.new_reference_id))
BEGIN
    SELECT RAISE(ABORT, 'item_id references must be uppercase and trimmed');
END;
