const debug = require('../../utils/debug');

const getSupplierPricesQuery = `
WITH exchange_rate AS (
    SELECT CAST(value AS DECIMAL(10,2)) as eur_ils_rate
    FROM settings
    WHERE key = 'eur_ils_rate'
),
latest_supplier_prices AS (
    SELECT 
        spl.item_id,
        spl.supplier_id,
        spl.current_price as supplier_price_eur,
        spl.last_updated as response_date,
        spl.is_promotion,
        spl.notes,
        p.name as promotion_name,
        ROW_NUMBER() OVER (PARTITION BY spl.item_id, spl.supplier_id ORDER BY spl.last_updated DESC) as rn
    FROM supplier_price_list spl
    LEFT JOIN promotion p ON spl.promotion_id = p.promotion_id
    WHERE spl.item_id = ?
),
latest_retail_prices AS (
    SELECT 
        item_id,
        ils_retail_price,
        date,
        ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY date DESC) as rn
    FROM price_history
),
latest_prices AS (
    SELECT 
        spl.item_id,
        spl.supplier_id,
        s.name as supplier_name,
        spl.supplier_price_eur,
        spl.is_promotion,
        spl.promotion_name,
        spl.notes,
        strftime('%Y-%m-%d', spl.response_date) as date,
        i.import_markup,
        ph.ils_retail_price,
        er.eur_ils_rate,
        -- Calculate cost in ILS
        ROUND(spl.supplier_price_eur * er.eur_ils_rate, 2) as supplier_price_ils,
        'active' as status
    FROM latest_supplier_prices spl
    JOIN supplier s ON spl.supplier_id = s.supplier_id
    JOIN item i ON spl.item_id = i.item_id
    CROSS JOIN exchange_rate er
    LEFT JOIN latest_retail_prices ph ON i.item_id = ph.item_id AND ph.rn = 1
    WHERE spl.rn = 1
),
supplier_responses AS (
    SELECT 
        sr.item_id,
        sr.supplier_id,
        s.name as supplier_name,
        sr.price_quoted as supplier_price_eur,
        sr.is_promotion,
        sr.promotion_name,
        sr.notes,
        strftime('%Y-%m-%d', sr.response_date) as date,
        i.import_markup,
        ph.ils_retail_price,
        er.eur_ils_rate,
        -- Calculate cost in ILS
        ROUND(sr.price_quoted * er.eur_ils_rate, 2) as supplier_price_ils,
        sr.status
    FROM supplier_response sr
    JOIN supplier s ON sr.supplier_id = s.supplier_id
    JOIN item i ON sr.item_id = i.item_id
    CROSS JOIN exchange_rate er
    LEFT JOIN latest_retail_prices ph ON i.item_id = ph.item_id AND ph.rn = 1
    WHERE sr.item_id = ?
)
SELECT *
FROM (
    SELECT * FROM latest_prices
    UNION ALL
    SELECT * FROM supplier_responses
) combined_prices
WHERE 
    (? IS NULL OR date >= ?)  -- fromDate parameter
    AND (? IS NULL OR supplier_id = ?)  -- supplierId parameter
ORDER BY date DESC
LIMIT ? OFFSET ?;
`;

const getSupplierPricesCountQuery = `
WITH latest_supplier_prices AS (
    SELECT 
        spl.item_id,
        spl.supplier_id,
        strftime('%Y-%m-%d', spl.last_updated) as date,
        ROW_NUMBER() OVER (PARTITION BY spl.item_id, spl.supplier_id ORDER BY spl.last_updated DESC) as rn
    FROM supplier_price_list spl
    WHERE spl.item_id = ?
),
supplier_responses AS (
    SELECT 
        sr.item_id,
        sr.supplier_id,
        strftime('%Y-%m-%d', sr.response_date) as date
    FROM supplier_response sr
    WHERE sr.item_id = ?
),
all_prices AS (
    -- Current prices
    SELECT 
        spl.item_id,
        spl.supplier_id,
        spl.date
    FROM latest_supplier_prices spl
    WHERE spl.rn = 1

    UNION ALL

    -- Response prices
    SELECT 
        sr.item_id,
        sr.supplier_id,
        sr.date
    FROM supplier_responses sr
)
SELECT COUNT(*) as total
FROM all_prices
WHERE 
    (? IS NULL OR date >= ?)  -- fromDate parameter
    AND (? IS NULL OR supplier_id = ?);  -- supplierId parameter
`;

module.exports = {
  getSupplierPricesQuery,
  getSupplierPricesCountQuery,
};
