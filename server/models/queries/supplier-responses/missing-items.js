/**
 * Query to get missing items for a supplier in an inquiry
 * Handles both regular responses and promotions
 * @returns {string} SQL query for missing items
 */
function getMissingItemsQuery() {
  return `
    WITH inquiry_items AS (
        SELECT 
            ii.item_id,
            ii.requested_qty,
            ii.retail_price,
            COALESCE(i.hebrew_description, '') as hebrew_description,
            COALESCE(i.english_description, '') as english_description,
            COALESCE(i.origin, '') as origin
        FROM inquiry_item ii
        LEFT JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    ),
    promotion_items AS (
        -- Get items covered by active promotions
        SELECT DISTINCT pi.item_id
        FROM promotion p
        JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
        WHERE p.supplier_id = ?
        AND p.is_active = 1
    ),
    regular_responses AS (
        -- Get items covered by regular responses
        SELECT DISTINCT sr.item_id
        FROM supplier_response sr
        WHERE sr.supplier_id = ?
        AND sr.inquiry_id = ?
        AND sr.status != 'deleted'
        AND sr.price_quoted IS NOT NULL
    ),
    covered_items AS (
        -- Combine items covered by either promotions or regular responses
        SELECT item_id FROM promotion_items
        UNION
        SELECT item_id FROM regular_responses
    )
    SELECT ii.*
    FROM inquiry_items ii
    WHERE NOT EXISTS (
        SELECT 1 FROM covered_items ci
        WHERE ci.item_id = ii.item_id
    )
    ORDER BY ii.item_id`;
}

module.exports = {
  getMissingItemsQuery,
};
