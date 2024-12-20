-- Description: This migration adds and verifies constraints on the item table
-- to prevent duplicate items and ensure data integrity

-- First, verify the item table structure
SELECT 'Verifying item table...';
SELECT sql FROM sqlite_master WHERE type='table' AND name='item';

-- Add UNIQUE constraint on item_id if not exists
-- Note: SQLite PRIMARY KEY is already UNIQUE, this is just for explicit documentation
SELECT 'Verifying item_id constraint...';
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_id_unique ON item(item_id);

-- Add CHECK constraint to ensure item_id is not empty or null
SELECT 'Adding item_id validation...';
CREATE TRIGGER IF NOT EXISTS validate_item_id
BEFORE INSERT ON item
BEGIN
    SELECT CASE 
        WHEN NEW.item_id IS NULL THEN
            RAISE(ABORT, 'item_id cannot be null')
        WHEN trim(NEW.item_id) = '' THEN
            RAISE(ABORT, 'item_id cannot be empty')
    END;
END;

-- Add trigger to ensure consistent item_id format
SELECT 'Adding item_id format validation...';
CREATE TRIGGER IF NOT EXISTS validate_item_id_format
BEFORE INSERT ON item
BEGIN
    SELECT CASE
        WHEN NEW.item_id != trim(NEW.item_id) THEN
            RAISE(ABORT, 'item_id cannot have leading or trailing spaces')
        WHEN NEW.item_id != upper(NEW.item_id) THEN
            RAISE(ABORT, 'item_id must be uppercase')
    END;
END;

-- Add trigger to prevent updates to item_id
SELECT 'Adding item_id update prevention...';
CREATE TRIGGER IF NOT EXISTS prevent_item_id_update
BEFORE UPDATE ON item
WHEN OLD.item_id != NEW.item_id
BEGIN
    SELECT RAISE(ABORT, 'item_id cannot be modified');
END;

-- Add trigger to enforce item_id format on reference changes
SELECT 'Adding reference validation...';
CREATE TRIGGER IF NOT EXISTS validate_reference_format
BEFORE INSERT ON item_reference_change
BEGIN
    SELECT CASE
        WHEN NEW.original_item_id != upper(trim(NEW.original_item_id)) THEN
            RAISE(ABORT, 'original_item_id must be uppercase and trimmed')
        WHEN NEW.new_reference_id != upper(trim(NEW.new_reference_id)) THEN
            RAISE(ABORT, 'new_reference_id must be uppercase and trimmed')
    END;
END;

-- Verify all constraints and triggers
SELECT 'Verifying constraints...';
SELECT name, sql FROM sqlite_master 
WHERE type='index' AND sql LIKE '%item%';

SELECT 'Verifying triggers...';
SELECT name, sql FROM sqlite_master 
WHERE type='trigger' AND 
(name LIKE '%item_id%' OR name LIKE '%item%');

-- Note: This migration:
-- 1. Adds explicit UNIQUE constraint on item_id
-- 2. Prevents null or empty item_ids
-- 3. Ensures consistent item_id format (uppercase, no spaces)
-- 4. Prevents modification of existing item_ids
-- 5. Enforces consistent format for reference changes
-- These constraints work together with the updated InquiryItemModel
-- to prevent duplicate items and ensure data consistency.
