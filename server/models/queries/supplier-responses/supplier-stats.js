/**
 * Query to get supplier statistics including response counts and averages
 * Also includes promotion suppliers and their stats
 * @returns {string} SQL query for supplier statistics
 */
function getSupplierStatsQuery() {
    return `
    WITH inquiry_items AS (
        -- Get all items in this inquiry
        SELECT 
            ii.item_id,
            ii.requested_qty,
            ii.retail_price,
            i.hebrew_description,
            i.english_description,
            i.origin
        FROM inquiry_item ii
        LEFT JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    ),
    promotion_stats AS (
        -- Get stats for suppliers with active promotions
        SELECT 
            s.supplier_id,
            s.name as supplier_name,
            p.promotion_id,
            p.name as promotion_name,
            COUNT(DISTINCT ii.item_id) as total_items,
            COUNT(DISTINCT pi.item_id) as responded_count,
            COUNT(DISTINCT ii.item_id) - COUNT(DISTINCT pi.item_id) as missing_count,
            AVG(NULLIF(pi.promotion_price, 0)) as average_price,
            MAX(p.start_date) as latest_response,
            COUNT(CASE WHEN pi.promotion_price > 0 THEN 1 END) as promotion_count,
            1 as is_promotion
        FROM supplier s
        JOIN promotion p ON s.supplier_id = p.supplier_id
        CROSS JOIN inquiry_items ii
        LEFT JOIN promotion_item pi ON ii.item_id = pi.item_id AND p.promotion_id = pi.promotion_id
        WHERE p.is_active = 1
        GROUP BY s.supplier_id, s.name, p.promotion_id, p.name
    ),
    response_stats AS (
        -- Get stats for suppliers with regular responses
        SELECT 
            s.supplier_id,
            s.name as supplier_name,
            NULL as promotion_id,
            NULL as promotion_name,
            (SELECT COUNT(*) FROM inquiry_items) as total_items,
            COUNT(DISTINCT sr.item_id) as responded_count,
            (
                SELECT COUNT(*)
                FROM inquiry_items ii2
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM supplier_response sr2
                    WHERE sr2.supplier_id = s.supplier_id
                    AND sr2.item_id = ii2.item_id
                    AND sr2.inquiry_id = ?
                    AND sr2.status != 'deleted'
                    AND sr2.price_quoted IS NOT NULL
                )
            ) as missing_count,
            AVG(NULLIF(sr.price_quoted, 0)) as average_price,
            MAX(sr.response_date) as latest_response,
            SUM(CASE WHEN sr.is_promotion = 1 THEN 1 ELSE 0 END) as promotion_count,
            0 as is_promotion
        FROM supplier s
        JOIN supplier_response sr ON s.supplier_id = sr.supplier_id
        WHERE sr.inquiry_id = ?
        AND sr.status != 'deleted'
        AND sr.price_quoted IS NOT NULL
        GROUP BY s.supplier_id, s.name
    ),
    combined_stats AS (
        SELECT * FROM promotion_stats
        UNION ALL
        SELECT * FROM response_stats
    ),
    responding_suppliers AS (
        -- Get unique list of responding suppliers (both regular and promotion)
        SELECT DISTINCT supplier_id, supplier_name
        FROM combined_stats
    ),
    all_responded_items AS (
        -- Combine responded items from both sources without duplicates
        SELECT DISTINCT item_id
        FROM (
            SELECT pi.item_id
            FROM promotion p
            JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
            WHERE p.is_active = 1
            AND pi.promotion_price IS NOT NULL
            AND pi.promotion_price > 0
            UNION
            SELECT sr.item_id
            FROM supplier_response sr
            WHERE sr.inquiry_id = ?
            AND sr.status != 'deleted'
            AND sr.price_quoted IS NOT NULL
            AND sr.price_quoted > 0
        )
    ),
    global_stats AS (
        SELECT
            (SELECT COUNT(*) FROM responding_suppliers) as total_suppliers,
            (SELECT COUNT(*) FROM all_responded_items) as responded_items,
            (
                SELECT COUNT(*)
                FROM (
                    -- Count all valid responses from both sources
                    SELECT supplier_response_id as response_id
                    FROM supplier_response
                    WHERE inquiry_id = ?
                    AND status != 'deleted'
                    AND price_quoted IS NOT NULL
                    UNION ALL
                    SELECT promotion_item_id
                    FROM promotion p
                    JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
                    WHERE p.is_active = 1
                    AND pi.promotion_price IS NOT NULL
                )
            ) as total_responses
    )
    SELECT 
        combined_stats.*,
        global_stats.total_suppliers,
        global_stats.responded_items,
        global_stats.total_responses
    FROM combined_stats
    CROSS JOIN global_stats
    ORDER BY latest_response DESC NULLS LAST`;
}

module.exports = {
    getSupplierStatsQuery
};
