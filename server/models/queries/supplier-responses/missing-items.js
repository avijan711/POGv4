function getMissingItemsQuery() {
    return `missing_items AS (
        -- Find missing items efficiently
        SELECT DISTINCT
            sr.supplier_id,
            sr.response_date,
            ii.item_id,
            ii.hebrew_description,
            ii.english_description,
            ii.requested_qty,
            ii.retail_price
        FROM inquiry_items ii
        CROSS JOIN (
            SELECT DISTINCT supplier_id, response_date 
            FROM response_stats
        ) sr
        WHERE NOT EXISTS (
            SELECT 1 
            FROM response_stats rs 
            WHERE rs.response_item_id = ii.item_id
            AND rs.supplier_id = sr.supplier_id
            AND date(rs.response_date) = date(sr.response_date)
        )
    )`;
}

module.exports = {
    getMissingItemsQuery
};
