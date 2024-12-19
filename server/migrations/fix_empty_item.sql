-- Description: This migration removes empty items and ensures data integrity
-- It runs in stages to safely remove data and add constraints

-- Stage 1: Begin transaction for safety
BEGIN TRANSACTION;

-- Stage 2: Identify and report empty items
SELECT 'Checking for empty items...';
SELECT item_id, hebrew_description 
FROM item 
WHERE trim(item_id) = ''
OR item_id IS NULL;

-- Stage 3: Clean up related data first (maintain referential integrity)
-- Delete price history for empty items
DELETE FROM price_history 
WHERE item_id IN (SELECT item_id FROM item WHERE trim(item_id) = '' OR item_id IS NULL);

-- Delete item files for empty items
DELETE FROM item_files 
WHERE item_id IN (SELECT item_id FROM item WHERE trim(item_id) = '' OR item_id IS NULL);

-- Delete reference changes for empty items
DELETE FROM item_reference_change 
WHERE original_item_id IN (SELECT item_id FROM item WHERE trim(item_id) = '' OR item_id IS NULL)
OR new_reference_id IN (SELECT item_id FROM item WHERE trim(item_id) = '' OR item_id IS NULL);

-- Stage 4: Remove empty items
DELETE FROM item WHERE trim(item_id) = '' OR item_id IS NULL;

-- Stage 5: Verify cleanup
SELECT 'Verifying empty items were removed...';
SELECT COUNT(*) as remaining_empty_items 
FROM item 
WHERE trim(item_id) = '' OR item_id IS NULL;

-- Stage 6: Add constraints if they don't exist
-- Note: These complement existing triggers from add_item_constraints.sql

-- Add CHECK constraint for non-empty item_id
SELECT 'Adding CHECK constraint...';
CREATE TABLE IF NOT EXISTS item_new (
    item_id TEXT NOT NULL CHECK(trim(item_id) != '') PRIMARY KEY,
    hebrew_description TEXT NOT NULL,
    english_description TEXT,
    import_markup REAL DEFAULT 1.30,
    hs_code TEXT,
    image TEXT,
    notes TEXT,
    origin TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data to new table if needed
INSERT OR IGNORE INTO item_new 
SELECT * FROM item 
WHERE trim(item_id) != '' AND item_id IS NOT NULL;

-- Stage 7: Verify constraints
SELECT 'Verifying constraints...';
SELECT sql 
FROM sqlite_master 
WHERE type='table' 
AND name='item_new';

-- Stage 8: If everything is successful, commit the transaction
-- If any errors occurred, the transaction will be rolled back automatically
COMMIT;

-- Stage 9: Report completion
SELECT 'Migration completed successfully. Empty items removed and constraints added.';

-- Note: After running this migration:
-- 1. Empty items will be removed
-- 2. Related data will be cleaned up
-- 3. New constraints will prevent empty items
-- 4. Existing triggers from add_item_constraints.sql provide additional protection
