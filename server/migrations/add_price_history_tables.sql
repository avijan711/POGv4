-- Create price history table
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

-- Create supplier price list table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_price_history_item_supplier 
ON price_history(item_id, supplier_id);

CREATE INDEX IF NOT EXISTS idx_price_history_effective_date 
ON price_history(effective_date);

CREATE INDEX IF NOT EXISTS idx_price_history_source 
ON price_history(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_supplier_price_list_item_supplier 
ON supplier_price_list(item_id, supplier_id);

-- Migrate existing prices from supplier_responses
INSERT INTO price_history (
    item_id,
    supplier_id,
    price,
    effective_date,
    source_type,
    source_id,
    notes
)
SELECT DISTINCT
    sr.item_id,
    sr.supplier_id,
    sr.price_quoted as price,
    date(sr.response_date) as effective_date,
    CASE 
        WHEN sr.is_promotion = 1 THEN 'promotion'
        ELSE 'inquiry'
    END as source_type,
    sr.inquiry_id as source_id,
    sri.notes
FROM supplier_response sr
LEFT JOIN supplier_response_item sri ON sr.supplier_response_id = sri.supplier_response_id
WHERE sr.price_quoted IS NOT NULL
AND sr.status != 'deleted';

-- Initialize supplier price list with latest prices
INSERT INTO supplier_price_list (
    item_id,
    supplier_id,
    current_price,
    is_promotion,
    promotion_id,
    last_updated,
    notes
)
SELECT 
    ph.item_id,
    ph.supplier_id,
    ph.price as current_price,
    CASE WHEN ph.source_type = 'promotion' THEN 1 ELSE 0 END as is_promotion,
    CASE WHEN ph.source_type = 'promotion' THEN ph.source_id ELSE NULL END as promotion_id,
    ph.created_at as last_updated,
    ph.notes
FROM price_history ph
INNER JOIN (
    SELECT item_id, supplier_id, MAX(effective_date) as latest_date
    FROM price_history
    GROUP BY item_id, supplier_id
) latest ON ph.item_id = latest.item_id 
    AND ph.supplier_id = latest.supplier_id 
    AND ph.effective_date = latest.latest_date
ON CONFLICT(item_id, supplier_id) DO UPDATE SET
    current_price = excluded.current_price,
    is_promotion = excluded.is_promotion,
    promotion_id = excluded.promotion_id,
    last_updated = excluded.last_updated,
    notes = excluded.notes;
