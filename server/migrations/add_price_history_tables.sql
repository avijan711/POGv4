-- Drop existing indexes first
DROP INDEX IF EXISTS idx_price_history_supplier;
DROP INDEX IF EXISTS idx_price_history_source;
DROP INDEX IF EXISTS idx_price_history_item_supplier;
DROP INDEX IF EXISTS idx_price_history_date;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_price_history_on_inquiry;
DROP TRIGGER IF EXISTS update_price_history_on_inquiry_update;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS supplier_price_list;
DROP TABLE IF EXISTS price_history;

-- Create price_history table
CREATE TABLE price_history (
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
    FOREIGN KEY (item_id) REFERENCES item(item_id)
);

-- Create supplier_price_list table without item_id foreign key constraint
CREATE TABLE supplier_price_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    supplier_id INTEGER NOT NULL,
    current_price DECIMAL(10,2) NOT NULL,
    is_promotion BOOLEAN DEFAULT 0,
    promotion_id INTEGER,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id),
    FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id),
    UNIQUE(item_id, supplier_id)
);

-- Create indexes
CREATE INDEX idx_price_history_supplier ON price_history(supplier_id);
CREATE INDEX idx_price_history_source ON price_history(source_type, source_id);
CREATE INDEX idx_price_history_item_supplier ON price_history(item_id, supplier_id);
CREATE INDEX idx_price_history_date ON price_history(date);

-- Create triggers
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
        source_id
    ) 
    VALUES (
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        (SELECT date FROM inquiry WHERE inquiry_id = NEW.inquiry_id),
        'inquiry',
        NEW.inquiry_id
    );
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
        qty_sold_this_year,
        qty_sold_last_year,
        date,
        source_type,
        source_id
    ) 
    VALUES (
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        (SELECT date FROM inquiry WHERE inquiry_id = NEW.inquiry_id),
        'inquiry',
        NEW.inquiry_id
    );
END;
