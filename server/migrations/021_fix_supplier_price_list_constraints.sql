-- Description: Fix supplier_price_list constraints to allow future items
-- This migration removes the item_id foreign key constraint from supplier_price_list
-- to support storing prices for items that don't exist in the items table yet.
-- This is needed for promotions that include future/upcoming items.

-- First, backup existing data
CREATE TEMP TABLE supplier_price_list_backup AS 
SELECT * FROM supplier_price_list;

-- Drop existing table
DROP TABLE IF EXISTS supplier_price_list;

-- Recreate table without item_id foreign key constraint
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

-- Restore data
INSERT INTO supplier_price_list 
SELECT * FROM supplier_price_list_backup;

-- Recreate indexes
CREATE INDEX idx_supplier_price_list_item ON supplier_price_list(item_id);
CREATE INDEX idx_supplier_price_list_supplier ON supplier_price_list(supplier_id);
CREATE INDEX idx_supplier_price_list_promotion ON supplier_price_list(promotion_id);

-- Clean up
DROP TABLE supplier_price_list_backup;