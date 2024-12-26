-- Drop dependent views first
DROP VIEW IF EXISTS valid_items;
DROP VIEW IF EXISTS item_details;

-- Drop dependent triggers first
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry_update;

-- Create a temporary table with all columns
CREATE TABLE price_history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    ils_retail_price REAL,
    qty_in_stock INTEGER DEFAULT 0,
    qty_sold_this_year INTEGER DEFAULT 0,
    qty_sold_last_year INTEGER DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    supplier_id INTEGER REFERENCES supplier(supplier_id),
    source_type TEXT CHECK (source_type IN ('inquiry', 'promotion', 'manual')),
    source_id INTEGER,
    supplier_price REAL,
    notes TEXT,
    history_id INTEGER,
    FOREIGN KEY (item_id) REFERENCES item(item_id)
);

-- Copy data from old table
INSERT INTO price_history_new (
    id,
    item_id,
    ils_retail_price,
    qty_in_stock,
    qty_sold_this_year,
    qty_sold_last_year,
    date,
    supplier_id,
    source_type,
    source_id,
    history_id
)
SELECT 
    id,
    item_id,
    ils_retail_price,
    qty_in_stock,
    qty_sold_this_year,
    qty_sold_last_year,
    date,
    supplier_id,
    source_type,
    source_id,
    id as history_id
FROM price_history;

-- Drop old table
DROP TABLE price_history;

-- Rename new table
ALTER TABLE price_history_new RENAME TO price_history;

-- Create indexes
CREATE INDEX idx_price_history_supplier ON price_history(supplier_id);
CREATE INDEX idx_price_history_source ON price_history(source_type, source_id);
CREATE INDEX idx_price_history_item_supplier ON price_history(item_id, supplier_id);
CREATE INDEX idx_price_history_date ON price_history(date);

-- Update existing records with supplier prices
UPDATE price_history 
SET supplier_price = (
    SELECT current_price
    FROM supplier_price_list
    WHERE supplier_price_list.item_id = price_history.item_id
    AND supplier_price_list.supplier_id = price_history.supplier_id
    ORDER BY supplier_price_list.last_updated DESC
    LIMIT 1
)
WHERE supplier_price IS NULL;

-- Recreate triggers
CREATE TRIGGER update_price_history_on_inquiry 
AFTER INSERT ON inquiry_item 
BEGIN 
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date,
        source_type,
        source_id,
        supplier_price,
        supplier_id,
        notes
    ) 
    SELECT
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        i.date,
        'inquiry',
        NEW.inquiry_id,
        NEW.supplier_price,
        NEW.supplier_id,
        NULL
    FROM inquiry i
    WHERE i.inquiry_id = NEW.inquiry_id;
END;

CREATE TRIGGER update_price_history_on_inquiry_update 
AFTER UPDATE ON inquiry_item 
WHEN NEW.qty_in_stock != OLD.qty_in_stock 
   OR NEW.sold_this_year != OLD.sold_this_year 
   OR NEW.sold_last_year != OLD.sold_last_year 
   OR NEW.retail_price != OLD.retail_price 
   OR NEW.supplier_price != OLD.supplier_price
   OR NEW.supplier_id != OLD.supplier_id
BEGIN 
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date,
        source_type,
        source_id,
        supplier_price,
        supplier_id,
        notes
    ) 
    SELECT
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        i.date,
        'inquiry',
        NEW.inquiry_id,
        NEW.supplier_price,
        NEW.supplier_id,
        NULL
    FROM inquiry i
    WHERE i.inquiry_id = NEW.inquiry_id;
END;

-- Recreate item_details view
CREATE VIEW item_details AS
WITH latest_price AS (
    SELECT
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        qty_sold_last_year,
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
    p.qty_sold_last_year as last_year_sales,
    p.date as last_price_update
FROM item i
LEFT JOIN latest_price p ON i.item_id = p.item_id AND p.rn = 1;

-- Recreate valid_items view
CREATE VIEW valid_items AS
SELECT
    i.*,
    p.ils_retail_price as retail_price,
    p.qty_in_stock,
    p.sold_this_year,
    p.qty_sold_last_year,
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
        qty_sold_last_year,
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