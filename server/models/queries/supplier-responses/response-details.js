/**
 * Query to get detailed supplier responses including item information
 * Handles both regular responses and promotion items
 * @returns {string} SQL query for response details
 */
function getResponseDetailsQuery() {
    return `
    WITH inquiry_items AS (
        -- Get all items in this inquiry
        SELECT 
            ii.item_id,
            ii.requested_qty,
            i.hebrew_description,
            i.english_description
        FROM inquiry_item ii
        LEFT JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    ),
    promotion_responses AS (
        -- Get promotion items that are in the inquiry
        SELECT 
            p.supplier_id,
            pi.promotion_item_id as response_id,
            ii.item_id,
            pi.promotion_price as price_quoted,
            p.start_date as response_date,
            1 as is_promotion,
            p.name as promotion_name,
            '' as notes,
            ii.hebrew_description,
            ii.english_description,
            'active' as status
        FROM inquiry_items ii
        JOIN promotion_item pi ON ii.item_id = pi.item_id
        JOIN promotion p ON pi.promotion_id = p.promotion_id
        WHERE p.supplier_id = ?
        AND p.is_active = 1
    ),
    regular_responses AS (
        -- Get regular supplier responses
        SELECT 
            sr.supplier_id,
            sr.supplier_response_id as response_id,
            sr.item_id,
            sr.price_quoted,
            sr.response_date,
            sr.is_promotion,
            sr.promotion_name,
            COALESCE(sri.notes, '') as notes,
            ii.hebrew_description,
            ii.english_description,
            sr.status
        FROM inquiry_items ii
        JOIN supplier_response sr ON ii.item_id = sr.item_id
        LEFT JOIN supplier_response_item sri ON sr.supplier_response_id = sri.supplier_response_id
        WHERE sr.inquiry_id = ?
        AND sr.supplier_id = ?
        AND sr.status != 'deleted'
        AND sr.price_quoted IS NOT NULL
    )
    SELECT * FROM (
        SELECT * FROM promotion_responses
        UNION ALL
        SELECT * FROM regular_responses
    ) combined
    ORDER BY item_id`;
}

module.exports = {
    getResponseDetailsQuery
};
