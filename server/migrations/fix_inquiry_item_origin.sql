-- Drop backup table if exists
DROP TABLE IF EXISTS inquiry_item_backup;

-- Create backup of current table
CREATE TABLE inquiry_item_backup AS SELECT * FROM inquiry_item;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS prevent_self_reference;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_inquiry_item_inquiry;
DROP INDEX IF EXISTS idx_inquiry_item_item;
DROP INDEX IF EXISTS idx_inquiry_item_original;
DROP INDEX IF EXISTS idx_inquiry_item_reference;

-- Drop and recreate table with origin column
DROP TABLE inquiry_item;
CREATE TABLE inquiry_item (
    inquiry_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    original_item_id TEXT,
    requested_qty INTEGER NOT NULL DEFAULT 0,
    hebrew_description TEXT,
    english_description TEXT,
    hs_code TEXT,
    import_markup REAL,
    qty_in_stock INTEGER DEFAULT 0,
    retail_price REAL,
    sold_this_year INTEGER DEFAULT 0,
    sold_last_year INTEGER DEFAULT 0,
    new_reference_id TEXT,
    reference_notes TEXT,
    origin TEXT DEFAULT '',
    FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    FOREIGN KEY (original_item_id) REFERENCES item(item_id),
    FOREIGN KEY (new_reference_id) REFERENCES item(item_id),
    CHECK (item_id != new_reference_id),
    CHECK (requested_qty >= 0),
    CHECK (qty_in_stock >= 0),
    CHECK (sold_this_year >= 0),
    CHECK (sold_last_year >= 0),
    CHECK (retail_price IS NULL OR retail_price >= 0),
    CHECK (import_markup IS NULL OR import_markup > 0)
);

-- Restore data from backup
INSERT INTO inquiry_item (
    inquiry_item_id,
    inquiry_id,
    item_id,
    original_item_id,
    requested_qty,
    hebrew_description,
    english_description,
    hs_code,
    import_markup,
    qty_in_stock,
    retail_price,
    sold_this_year,
    sold_last_year,
    new_reference_id,
    reference_notes,
    origin
)
SELECT 
    inquiry_item_id,
    inquiry_id,
    item_id,
    original_item_id,
    requested_qty,
    hebrew_description,
    english_description,
    hs_code,
    import_markup,
    qty_in_stock,
    retail_price,
    sold_this_year,
    sold_last_year,
    new_reference_id,
    reference_notes,
    '' as origin
FROM inquiry_item_backup;

-- Recreate indexes
CREATE INDEX idx_inquiry_item_inquiry ON inquiry_item(inquiry_id);
CREATE INDEX idx_inquiry_item_item ON inquiry_item(item_id);
CREATE INDEX idx_inquiry_item_original ON inquiry_item(original_item_id);
CREATE INDEX idx_inquiry_item_reference ON inquiry_item(new_reference_id);

-- Recreate triggers
CREATE TRIGGER update_price_history_on_inquiry
AFTER INSERT ON inquiry_item
WHEN NEW.retail_price IS NOT NULL
BEGIN
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date
    )
    VALUES (
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        (SELECT date FROM inquiry WHERE inquiry_id = NEW.inquiry_id)
    );
END;

CREATE TRIGGER prevent_self_reference
BEFORE INSERT ON inquiry_item
WHEN NEW.item_id = NEW.new_reference_id
BEGIN
    SELECT RAISE(ROLLBACK, 'Cannot reference an item to itself');
END;

-- Drop backup table
DROP TABLE inquiry_item_backup;
