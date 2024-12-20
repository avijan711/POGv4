function getResponseStatsQuery() {
    return `WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'supplier_response'
        ) as has_supplier_response
    ),
    response_stats AS (
        -- Get all response items including promotions
        SELECT DISTINCT
            COALESCE(sr.item_id, pi.item_id) as response_item_id,
            ii.item_id as inquiry_item_id,
            irc.new_reference_id as replacement_id,
            COALESCE(sr.supplier_id, p.supplier_id) as supplier_id,
            COALESCE(sr.response_date, p.created_at) as response_date,
            ii.hebrew_description,
            ii.english_description,
            ii.requested_qty,
            ii.retail_price,
            COALESCE(sr.price_quoted, pi.promotion_price) as price_quoted,
            COALESCE(sr.status, 'active') as response_status,
            sr.supplier_response_id,
            CASE
                WHEN ii.item_id IS NULL THEN 'extra'
                WHEN irc.new_reference_id IS NOT NULL THEN 'replacement'
                WHEN p.id IS NOT NULL THEN 'promotion'
                ELSE 'matched'
            END as item_status,
            CASE
                WHEN p.id IS NOT NULL THEN 1
                ELSE 0
            END as is_promotion,
            p.name as promotion_name,
            p.start_date as promotion_start_date,
            p.end_date as promotion_end_date
        FROM check_tables ct
        CROSS JOIN (SELECT 1) params
        LEFT JOIN supplier_response sr ON ct.has_supplier_response = 1
        LEFT JOIN inquiry_item ii ON COALESCE(sr.item_id, pi.item_id) = ii.item_id
        LEFT JOIN item_reference_change irc ON sr.item_id = irc.original_item_id 
            AND sr.supplier_id = irc.supplier_id
            AND date(sr.response_date) = date(irc.change_date)
        LEFT JOIN promotion_item pi ON ii.item_id = pi.item_id
        LEFT JOIN promotion p ON pi.promotion_id = p.id 
            AND p.is_active = 1 
            AND (p.start_date IS NULL OR p.start_date <= datetime('now'))
            AND (p.end_date IS NULL OR p.end_date >= datetime('now'))
        WHERE ct.has_supplier_response = 0 
            OR sr.item_id IS NOT NULL 
            OR (pi.item_id IS NOT NULL AND p.id IS NOT NULL)
    )`;
}

module.exports = {
    getResponseStatsQuery
};
