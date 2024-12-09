const debug = require('../../utils/debug');

const getSupplierPricesQuery = `
WITH exchange_rate AS (
    SELECT CAST(value AS DECIMAL(10,2)) as eur_ils_rate
    FROM settings
    WHERE key = 'eur_ils_rate'
),
latest_prices AS (
    SELECT 
        spl.item_id,
        spl.supplier_id,
        s.name as supplier_name,
        spl.current_price as price_eur,
        spl.is_promotion,
        CASE 
            WHEN spl.is_promotion = 1 THEN p.name
            ELSE NULL
        END as promotion_name,
        spl.last_updated as date,
        i.import_markup,
        i.retail_price as retail_price_ils,
        er.eur_ils_rate,
        -- Calculate cost in ILS
        ROUND(spl.current_price * i.import_markup * er.eur_ils_rate, 2) as cost_ils,
        -- Calculate discount percentage
        CASE 
            WHEN i.retail_price > 0 THEN
                ROUND(
                    ((i.retail_price - (spl.current_price * i.import_markup * er.eur_ils_rate)) / i.retail_price) * 100,
                    1
                )
            ELSE NULL
        END as discount_percentage
    FROM supplier_price_list spl
    JOIN supplier s ON spl.supplier_id = s.supplier_id
    JOIN item i ON spl.item_id = i.item_id
    CROSS JOIN exchange_rate er
    LEFT JOIN promotion p ON spl.promotion_id = p.promotion_id
    WHERE spl.item_id = ?
),
price_history AS (
    SELECT 
        ph.item_id,
        ph.supplier_id,
        s.name as supplier_name,
        ph.price as price_eur,
        CASE 
            WHEN ph.source_type = 'promotion' THEN 1
            ELSE 0
        END as is_promotion,
        ph.notes as promotion_name,
        ph.effective_date as date,
        i.import_markup,
        i.retail_price as retail_price_ils,
        er.eur_ils_rate,
        -- Calculate cost in ILS
        ROUND(ph.price * i.import_markup * er.eur_ils_rate, 2) as cost_ils,
        -- Calculate discount percentage
        CASE 
            WHEN i.retail_price > 0 THEN
                ROUND(
                    ((i.retail_price - (ph.price * i.import_markup * er.eur_ils_rate)) / i.retail_price) * 100,
                    1
                )
            ELSE NULL
        END as discount_percentage
    FROM price_history ph
    JOIN supplier s ON ph.supplier_id = s.supplier_id
    JOIN item i ON ph.item_id = i.item_id
    CROSS JOIN exchange_rate er
    WHERE ph.item_id = ?
)
SELECT *
FROM (
    SELECT * FROM latest_prices
    UNION ALL
    SELECT * FROM price_history
) combined_prices
WHERE 
    (?1 IS NULL OR date >= ?1)
    AND (?2 IS NULL OR supplier_id = ?2)
ORDER BY date DESC, discount_percentage DESC
LIMIT ? OFFSET ?;
`;

const getSupplierPricesCountQuery = `
WITH exchange_rate AS (
    SELECT CAST(value AS DECIMAL(10,2)) as eur_ils_rate
    FROM settings
    WHERE key = 'eur_ils_rate'
),
all_prices AS (
    -- Current prices
    SELECT 
        spl.item_id,
        spl.supplier_id,
        spl.last_updated as date
    FROM supplier_price_list spl
    WHERE spl.item_id = ?

    UNION ALL

    -- Historical prices
    SELECT 
        ph.item_id,
        ph.supplier_id,
        ph.effective_date as date
    FROM price_history ph
    WHERE ph.item_id = ?
)
SELECT COUNT(*) as total
FROM all_prices
WHERE 
    (?1 IS NULL OR date >= ?1)
    AND (?2 IS NULL OR supplier_id = ?2);
`;

module.exports = {
    getSupplierPricesQuery,
    getSupplierPricesCountQuery
};
