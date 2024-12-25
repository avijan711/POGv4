-- Add supplier_price column to price_history table if it doesn't exist
SELECT CASE 
    WHEN NOT EXISTS (
        SELECT 1 FROM pragma_table_info('price_history') WHERE name = 'supplier_price'
    )
    THEN 'ALTER TABLE price_history ADD COLUMN supplier_price REAL;'
END;

-- Add source_type column to price_history table if it doesn't exist
SELECT CASE 
    WHEN NOT EXISTS (
        SELECT 1 FROM pragma_table_info('price_history') WHERE name = 'source_type'
    )
    THEN 'ALTER TABLE price_history ADD COLUMN source_type TEXT CHECK (source_type IN ("manual", "inquiry", "promotion"));'
END;

-- Add source_id column to price_history table if it doesn't exist
SELECT CASE 
    WHEN NOT EXISTS (
        SELECT 1 FROM pragma_table_info('price_history') WHERE name = 'source_id'
    )
    THEN 'ALTER TABLE price_history ADD COLUMN source_id INTEGER;'
END;

-- Add notes column to price_history table if it doesn't exist
SELECT CASE 
    WHEN NOT EXISTS (
        SELECT 1 FROM pragma_table_info('price_history') WHERE name = 'notes'
    )
    THEN 'ALTER TABLE price_history ADD COLUMN notes TEXT;'
END;

-- Create index for supplier price queries if it doesn't exist
SELECT CASE 
    WHEN NOT EXISTS (
        SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_price_history_supplier'
    )
    THEN 'CREATE INDEX idx_price_history_supplier ON price_history(supplier_id);'
END;

-- Create index for source type queries if it doesn't exist
SELECT CASE 
    WHEN NOT EXISTS (
        SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_price_history_source'
    )
    THEN 'CREATE INDEX idx_price_history_source ON price_history(source_type);'
END;