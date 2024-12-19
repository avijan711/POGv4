-- Drop existing objects
DROP TABLE IF EXISTS promotion_item;
DROP TABLE IF EXISTS promotion;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS "order";
DROP TABLE IF EXISTS supplier_response_item;
DROP TABLE IF EXISTS supplier_response;
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS inquiry_item;
DROP TABLE IF EXISTS inquiry;
DROP TABLE IF EXISTS item_files;
DROP TABLE IF EXISTS item_reference_change;
DROP TABLE IF EXISTS supplier_price_list;
DROP TABLE IF EXISTS supplier;
DROP TABLE IF EXISTS item;

DROP VIEW IF EXISTS item_details;
DROP TRIGGER IF EXISTS update_item_timestamp;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS prevent_self_reference;
DROP TRIGGER IF EXISTS prevent_self_reference_change;
DROP TRIGGER IF EXISTS sync_promotion_items_on_item_insert;

-- Create tables in order of dependencies

-- 1. Base tables (no foreign keys)
CREATE TABLE item (
    item_id TEXT PRIMARY KEY,
    hebrew_description TEXT,
    english_description TEXT,
    import_markup REAL DEFAULT 1.30,
    hs_code TEXT,
    image TEXT,
    notes TEXT,
    origin TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (import_markup > 0)
);

CREATE TABLE supplier (
    supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT
);

CREATE TABLE inquiry (
    inquiry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_number TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'new',
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('new', 'pending', 'completed', 'cancelled'))
);

-- 2. Tables with single foreign key
CREATE TABLE item_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE CASCADE
);

CREATE TABLE price_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    ils_retail_price REAL,
    qty_in_stock INTEGER DEFAULT 0,
    sold_this_year INTEGER DEFAULT 0,
    sold_last_year INTEGER DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    CHECK (ils_retail_price IS NULL OR ils_retail_price >= 0),
    CHECK (qty_in_stock >= 0),
    CHECK (sold_this_year >= 0),
    CHECK (sold_last_year >= 0)
);

CREATE TABLE item_reference_change (
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

-- 3. Tables with multiple foreign keys
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

CREATE TABLE supplier_response (
    supplier_response_id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    price_quoted REAL,
    status TEXT DEFAULT 'pending',
    is_promotion BOOLEAN DEFAULT 0,
    promotion_name TEXT,
    response_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id),
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id),
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    CHECK (price_quoted IS NULL OR price_quoted >= 0),
    CHECK (status IN ('pending', 'active', 'rejected'))
);

CREATE TABLE supplier_response_item (
    response_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_response_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    price REAL,
    notes TEXT,
    hs_code TEXT,
    english_description TEXT,
    new_reference_id TEXT,
    origin TEXT DEFAULT '',
    FOREIGN KEY (supplier_response_id) REFERENCES supplier_response(supplier_response_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    FOREIGN KEY (new_reference_id) REFERENCES item(item_id),
    CHECK (price IS NULL OR price >= 0)
);

CREATE TABLE "order" (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id INTEGER,
    supplier_id INTEGER NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id),
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id),
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'completed', 'cancelled'))
);

CREATE TABLE promotion (
    promotion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    supplier_id INTEGER REFERENCES supplier(supplier_id),
    start_date DATETIME,
    end_date DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date > start_date)
);

-- 4. Tables with complex foreign keys
CREATE TABLE order_item (
    order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    inquiry_item_id INTEGER,
    quantity INTEGER NOT NULL,
    price_quoted REAL NOT NULL,
    is_promotion BOOLEAN DEFAULT 0,
    promotion_id INTEGER,
    supplier_response_id INTEGER,
    FOREIGN KEY (order_id) REFERENCES "order"(order_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    FOREIGN KEY (inquiry_item_id) REFERENCES inquiry_item(inquiry_item_id),
    FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id),
    FOREIGN KEY (supplier_response_id) REFERENCES supplier_response(supplier_response_id),
    CHECK (quantity > 0),
    CHECK (price_quoted > 0)
);

CREATE TABLE promotion_item (
    promotion_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    promotion_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    promotion_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    CHECK (promotion_price > 0)
);

CREATE TABLE supplier_price_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    supplier_id INTEGER NOT NULL,
    current_price DECIMAL(10,2) NOT NULL,
    is_promotion BOOLEAN DEFAULT 0,
    promotion_id INTEGER,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id),
    FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id),
    CONSTRAINT unique_supplier_item UNIQUE (item_id, supplier_id)
);

-- Create indexes
CREATE INDEX idx_item_files_item ON item_files(item_id);
CREATE INDEX idx_item_files_type ON item_files(file_type);

CREATE INDEX idx_inquiry_item_inquiry ON inquiry_item(inquiry_id);
CREATE INDEX idx_inquiry_item_item ON inquiry_item(item_id);
CREATE INDEX idx_inquiry_item_original ON inquiry_item(original_item_id);
CREATE INDEX idx_inquiry_item_reference ON inquiry_item(new_reference_id);

CREATE INDEX idx_price_history_item ON price_history(item_id);
CREATE INDEX idx_price_history_date ON price_history(date);

CREATE INDEX idx_reference_changes_original ON item_reference_change(original_item_id);
CREATE INDEX idx_reference_changes_new ON item_reference_change(new_reference_id);
CREATE INDEX idx_reference_changes_supplier ON item_reference_change(supplier_id);
CREATE INDEX idx_reference_changes_date ON item_reference_change(change_date);

CREATE INDEX idx_supplier_response_inquiry ON supplier_response(inquiry_id);
CREATE INDEX idx_supplier_response_supplier ON supplier_response(supplier_id);
CREATE INDEX idx_supplier_response_item ON supplier_response(item_id);
CREATE INDEX idx_supplier_response_date ON supplier_response(response_date);

CREATE INDEX idx_supplier_response_item_response ON supplier_response_item(supplier_response_id);
CREATE INDEX idx_supplier_response_item_item ON supplier_response_item(item_id);
CREATE INDEX idx_supplier_response_item_reference ON supplier_response_item(new_reference_id);

CREATE INDEX idx_order_inquiry ON "order"(inquiry_id);
CREATE INDEX idx_order_supplier ON "order"(supplier_id);
CREATE INDEX idx_order_date ON "order"(order_date);
CREATE INDEX idx_order_status ON "order"(status);

CREATE INDEX idx_order_item_order ON order_item(order_id);
CREATE INDEX idx_order_item_item ON order_item(item_id);
CREATE INDEX idx_order_item_inquiry ON order_item(inquiry_item_id);

CREATE INDEX idx_promotion_supplier ON promotion(supplier_id);
CREATE INDEX idx_promotion_dates ON promotion(start_date, end_date);
CREATE INDEX idx_promotion_active ON promotion(is_active);

CREATE INDEX idx_promotion_item_promotion ON promotion_item(promotion_id);
CREATE INDEX idx_promotion_item_item ON promotion_item(item_id);

CREATE INDEX idx_supplier_price_list_item ON supplier_price_list(item_id);
CREATE INDEX idx_supplier_price_list_supplier ON supplier_price_list(supplier_id);

-- Create view
CREATE VIEW item_details AS
WITH latest_price AS (
    SELECT 
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date,
        ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY date DESC, history_id DESC) as rn
    FROM price_history
)
SELECT
    i.item_id,
    i.hebrew_description,
    i.english_description,
    i.import_markup,
    i.hs_code,
    i.image,
    i.notes,
    i.origin,
    i.last_updated,
    p.ils_retail_price as retail_price,
    p.qty_in_stock as current_stock,
    p.sold_this_year as current_year_sales,
    p.sold_last_year as last_year_sales,
    p.date as last_price_update
FROM item i
LEFT JOIN latest_price p ON i.item_id = p.item_id AND p.rn = 1;

-- Create triggers
CREATE TRIGGER update_item_timestamp
AFTER UPDATE ON item
BEGIN
    UPDATE item 
    SET last_updated = CURRENT_TIMESTAMP
    WHERE item_id = NEW.item_id;
END;

CREATE TRIGGER update_price_history_on_inquiry
AFTER INSERT ON inquiry_item
BEGIN
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date
    )
    SELECT 
        NEW.item_id,
        CAST(NEW.retail_price AS REAL),
        CAST(NEW.qty_in_stock AS INTEGER),
        CAST(NEW.sold_this_year AS INTEGER),
        CAST(NEW.sold_last_year AS INTEGER),
        i.date
    FROM inquiry i
    WHERE i.inquiry_id = NEW.inquiry_id;
END;

CREATE TRIGGER update_price_history_on_inquiry_update
AFTER UPDATE ON inquiry_item
WHEN NEW.qty_in_stock != OLD.qty_in_stock 
   OR NEW.sold_this_year != OLD.sold_this_year 
   OR NEW.sold_last_year != OLD.sold_last_year
   OR NEW.retail_price != OLD.retail_price
BEGIN
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date
    )
    SELECT 
        NEW.item_id,
        CAST(NEW.retail_price AS REAL),
        CAST(NEW.qty_in_stock AS INTEGER),
        CAST(NEW.sold_this_year AS INTEGER),
        CAST(NEW.sold_last_year AS INTEGER),
        i.date
    FROM inquiry i
    WHERE i.inquiry_id = NEW.inquiry_id;
END;

CREATE TRIGGER prevent_self_reference
BEFORE INSERT ON inquiry_item
WHEN NEW.item_id = NEW.new_reference_id
BEGIN
    SELECT RAISE(ABORT, 'Cannot reference an item to itself');
END;

CREATE TRIGGER prevent_self_reference_change
BEFORE INSERT ON item_reference_change
WHEN NEW.original_item_id = NEW.new_reference_id
BEGIN
    SELECT RAISE(ABORT, 'Cannot reference an item to itself');
END;

-- Create trigger to sync prices when new items are added
CREATE TRIGGER sync_promotion_items_on_item_insert
AFTER INSERT ON item
BEGIN
    -- First sync supplier_price_list
    INSERT OR REPLACE INTO supplier_price_list (
        item_id,
        supplier_id,
        current_price,
        is_promotion,
        promotion_id,
        last_updated
    )
    SELECT 
        NEW.item_id,
        spl.supplier_id,
        spl.current_price,
        1,
        spl.promotion_id,
        CURRENT_TIMESTAMP
    FROM supplier_price_list spl
    WHERE spl.item_id = NEW.item_id;

    -- Then sync promotion_item
    INSERT INTO promotion_item (
        promotion_id,
        item_id,
        promotion_price
    )
    SELECT 
        spl.promotion_id,
        NEW.item_id,
        spl.current_price
    FROM supplier_price_list spl
    WHERE spl.is_promotion = 1
    AND spl.item_id = NEW.item_id
    AND NOT EXISTS (
        SELECT 1 FROM promotion_item pi 
        WHERE pi.promotion_id = spl.promotion_id 
        AND pi.item_id = NEW.item_id
    );
END;

-- Final verification
SELECT 'Tables created:', COUNT(*) FROM sqlite_master WHERE type='table';
SELECT 'Views created:', COUNT(*) FROM sqlite_master WHERE type='view';
SELECT 'Triggers created:', COUNT(*) FROM sqlite_master WHERE type='trigger';
SELECT 'Indexes created:', COUNT(*) FROM sqlite_master WHERE type='index';
