-- Begin transaction
BEGIN TRANSACTION;

-- Drop existing trigger
DROP TRIGGER IF EXISTS update_item_timestamp;

-- Backup existing data
CREATE TABLE IF NOT EXISTS Item_Backup AS SELECT * FROM Item;

-- Drop existing table
DROP TABLE IF EXISTS Item;

-- Create table with correct schema
CREATE TABLE Item (
    ItemID TEXT PRIMARY KEY,
    HebrewDescription TEXT,
    EnglishDescription TEXT,
    ImportMarkup REAL DEFAULT 1.30,
    HSCode TEXT,
    Image TEXT,
    LastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (ImportMarkup > 0)
);

-- Restore data with current timestamp for LastUpdated
INSERT INTO Item (
    ItemID,
    HebrewDescription,
    EnglishDescription,
    ImportMarkup,
    HSCode,
    Image,
    LastUpdated
)
SELECT
    ItemID,
    HebrewDescription,
    EnglishDescription,
    COALESCE(ImportMarkup, 1.30),
    HSCode,
    Image,
    CURRENT_TIMESTAMP
FROM Item_Backup;

-- Create trigger
CREATE TRIGGER update_item_timestamp
AFTER UPDATE ON Item
BEGIN
    UPDATE Item 
    SET LastUpdated = CURRENT_TIMESTAMP
    WHERE ItemID = NEW.ItemID;
END;

-- Drop backup table
DROP TABLE Item_Backup;

-- Commit transaction
COMMIT;
