-- Begin transaction
BEGIN TRANSACTION;

-- Create item_reference_change table
CREATE TABLE IF NOT EXISTS item_reference_change (
    change_id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_item_id VARCHAR NOT NULL,
    new_reference_id VARCHAR NOT NULL,
    supplier_id INTEGER NULL,
    changed_by_user BOOLEAN DEFAULT 0,
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (original_item_id) REFERENCES item(item_id),
    FOREIGN KEY (new_reference_id) REFERENCES item(item_id),
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id),
    CHECK (original_item_id != new_reference_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reference_changes_original ON item_reference_change(original_item_id);
CREATE INDEX IF NOT EXISTS idx_reference_changes_new ON item_reference_change(new_reference_id);
CREATE INDEX IF NOT EXISTS idx_reference_changes_supplier ON item_reference_change(supplier_id);
CREATE INDEX IF NOT EXISTS idx_reference_changes_date ON item_reference_change(change_date);

-- Create trigger to prevent self-references
CREATE TRIGGER IF NOT EXISTS prevent_self_reference_change
BEFORE INSERT ON item_reference_change
WHEN NEW.original_item_id = NEW.new_reference_id
BEGIN
    SELECT RAISE(ABORT, 'Cannot reference an item to itself');
END;

-- Migrate existing references from inquiry_item
INSERT INTO item_reference_change (
    original_item_id,
    new_reference_id,
    supplier_id,
    changed_by_user,
    change_date,
    notes
)
SELECT DISTINCT
    ii.item_id,
    ii.new_reference_id,
    sr.supplier_id,
    CASE WHEN sr.supplier_id IS NULL THEN 1 ELSE 0 END,
    i.date,
    ii.reference_notes
FROM inquiry_item ii
JOIN inquiry i ON ii.inquiry_id = i.inquiry_id
LEFT JOIN supplier_response sr ON ii.inquiry_id = sr.inquiry_id AND ii.item_id = sr.item_id
WHERE ii.new_reference_id IS NOT NULL
AND ii.item_id != ii.new_reference_id
AND NOT EXISTS (
    SELECT 1 
    FROM item_reference_change irc 
    WHERE irc.original_item_id = ii.item_id 
    AND irc.new_reference_id = ii.new_reference_id
);

-- Verify changes
SELECT 'item_reference_change table columns:';
PRAGMA table_info(item_reference_change);

SELECT 'item_reference_change indexes:';
SELECT name FROM sqlite_master 
WHERE type = 'index' 
AND tbl_name = 'item_reference_change';

SELECT 'Migrated references:', COUNT(*) 
FROM item_reference_change;

-- Commit transaction
COMMIT;
