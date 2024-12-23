-- Description: This migration removes empty items and ensures data integrity
-- It runs in stages to safely remove data and add constraints

-- Clean up related data first (maintain referential integrity)
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

-- Remove empty items
DELETE FROM item WHERE trim(item_id) = '' OR item_id IS NULL;

-- Add CHECK constraint for non-empty item_id
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
