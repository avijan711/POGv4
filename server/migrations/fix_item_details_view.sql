-- Drop the existing view
DROP VIEW IF EXISTS item_details;

-- Recreate the view with correct syntax and commas
CREATE VIEW item_details AS
WITH latest_price AS (
    SELECT 
        item_id,
        ils_retail_price,
        qty_in_stock,
        sold_this_year,
        sold_last_year,
        date,
        ROW_NUMBER() OVER (
            PARTITION BY item_id 
            ORDER BY date DESC, 
            CASE WHEN history_id IS NOT NULL THEN history_id ELSE 0 END DESC
        ) as rn
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

-- Verify the view was created correctly
SELECT 'Verifying view...';
SELECT sql FROM sqlite_master WHERE type='view' AND name='item_details';
