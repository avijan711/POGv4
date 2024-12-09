-- First: Create the tables
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    supplier_id INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    effective_date DATE NOT NULL,
    end_date DATE,
    source_type TEXT NOT NULL CHECK (source_type IN ('inquiry', 'promotion', 'manual')),
    source_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES item(item_id),
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id)
);

CREATE TABLE IF NOT EXISTS supplier_price_list (
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
    UNIQUE(item_id, supplier_id)
);

-- Second: Create indexes (these will be executed in the second pass)
CREATE INDEX IF NOT EXISTS idx_price_history_item_supplier ON price_history(item_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(effective_date);
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_item ON supplier_price_list(item_id);
CREATE INDEX IF NOT EXISTS idx_supplier_price_list_supplier ON supplier_price_list(supplier_id);
