function getSupplierStatsQuery() {
    return `supplier_stats AS (
        -- Calculate statistics per supplier
        SELECT 
            rs.supplier_id,
            rs.response_date,
            COUNT(DISTINCT CASE WHEN rs.item_status = 'extra' THEN rs.response_item_id END) as extra_count,
            COUNT(DISTINCT CASE WHEN rs.item_status = 'replacement' THEN rs.response_item_id END) as replacement_count,
            COUNT(DISTINCT rs.response_item_id) as total_count
        FROM response_stats rs
        GROUP BY rs.supplier_id, rs.response_date
    )`;
}

module.exports = {
    getSupplierStatsQuery
};
