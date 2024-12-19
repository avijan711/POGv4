-- Drop existing tables
DROP TABLE IF EXISTS promotion_item;
DROP TABLE IF EXISTS supplier_price_list;

-- Recreate tables without foreign key constraints on item_id
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
    CONSTRAINT unique_supplier_item UNIQUE (item_id, supplier_id)
);

CREATE TABLE promotion_item (
    promotion_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    promotion_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    promotion_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item(item_id)
);

-- Create indexes
CREATE INDEX idx_supplier_price_list_item ON supplier_price_list(item_id);
CREATE INDEX idx_supplier_price_list_supplier ON supplier_price_list(supplier_id);
CREATE INDEX idx_promotion_item_promotion ON promotion_item(promotion_id);
CREATE INDEX idx_promotion_item_item ON promotion_item(item_id);
