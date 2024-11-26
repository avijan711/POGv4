-- Begin transaction
BEGIN TRANSACTION;

-- Backup existing data
CREATE TABLE IF NOT EXISTS Item_Backup AS SELECT * FROM Item;

-- Drop existing table
DROP TABLE IF EXISTS Item;

-- Create table with all fields
CREATE TABLE Item (
    ItemID TEXT PRIMARY KEY,
    HebrewDescription TEXT,
    EnglishDescription TEXT,
    ImportMarkup REAL DEFAULT 1.30,
    HSCode TEXT,
    Image TEXT,
    Notes TEXT,
    Origin TEXT,
    LastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (ImportMarkup > 0)
);

-- Restore existing data with NULL for new fields
INSERT INTO Item (
    ItemID,
    HebrewDescription,
    EnglishDescription,
    ImportMarkup,
    HSCode,
    Image,
    Notes,
    Origin,
    LastUpdated
)
SELECT
    ItemID,
    HebrewDescription,
    EnglishDescription,
    COALESCE(ImportMarkup, 1.30),
    HSCode,
    Image,
    NULL,  -- Notes
    NULL,  -- Origin
    CURRENT_TIMESTAMP
FROM Item_Backup;

-- Drop backup table
DROP TABLE Item_Backup;

-- Create item_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS ItemFiles (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID TEXT NOT NULL,
    FilePath TEXT NOT NULL,
    FileType TEXT,
    UploadDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    Description TEXT,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_item_files_item ON ItemFiles(ItemID);
CREATE INDEX IF NOT EXISTS idx_item_files_type ON ItemFiles(FileType);

-- Create or replace trigger for LastUpdated
DROP TRIGGER IF EXISTS update_item_timestamp;
CREATE TRIGGER update_item_timestamp
AFTER UPDATE ON Item
BEGIN
    UPDATE Item 
    SET LastUpdated = CURRENT_TIMESTAMP
    WHERE ItemID = NEW.ItemID;
END;

-- Commit transaction
COMMIT;

-- Verify changes
SELECT 'Item table columns:';
PRAGMA table_info(Item);

SELECT 'ItemFiles table columns:';
PRAGMA table_info(ItemFiles);
