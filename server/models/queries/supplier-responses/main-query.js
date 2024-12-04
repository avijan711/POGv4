function getMainQuery() {
    return `
    WITH supplier_responses AS (
        SELECT DISTINCT
            sr.supplier_id,
            s.name as supplier_name,
            sr.response_date,
            sr.item_id,
            sr.supplier_response_id,
            sr.price_quoted,
            sr.status,
            sr.inquiry_id,
            COALESCE(sr.is_promotion, 0) as is_promotion,
            sr.promotion_name,
            sri.notes,
            COALESCE(i.hebrew_description, '') as hebrew_description,
            COALESCE(i.english_description, sri.english_description, '') as english_description,
            COALESCE(sri.origin, i.origin, '') as origin,
            COALESCE(ii.requested_qty, 0) as requested_qty,
            COALESCE(ii.retail_price, 0) as retail_price,
            CASE 
                WHEN irc.new_reference_id IS NOT NULL THEN 'replacement'
                WHEN COALESCE(sr.is_promotion, 0) = 1 THEN 'promotion'
                ELSE 'regular'
            END as item_type,
            irc.new_reference_id
        FROM supplier_response sr
        INNER JOIN supplier s ON sr.supplier_id = s.supplier_id
        LEFT JOIN supplier_response_item sri ON sr.supplier_response_id = sri.supplier_response_id
        LEFT JOIN inquiry_item ii ON sr.item_id = ii.item_id AND sr.inquiry_id = ii.inquiry_id
        LEFT JOIN item i ON sr.item_id = i.item_id
        LEFT JOIN item_reference_change irc ON sr.item_id = irc.original_item_id 
            AND sr.supplier_id = irc.supplier_id
            AND date(sr.response_date) = date(irc.change_date)
        WHERE sr.inquiry_id = ?
            AND sr.status != 'deleted'
            AND sr.price_quoted IS NOT NULL
    ),
    inquiry_stats AS (
        SELECT COUNT(*) as total_items
        FROM inquiry_item
        WHERE inquiry_id = ?
    ),
    response_stats AS (
        SELECT 
            COUNT(DISTINCT supplier_id) as total_suppliers,
            COUNT(DISTINCT item_id) as responded_items
        FROM supplier_responses
    ),
    response_summary AS (
        SELECT 
            supplier_id,
            supplier_name,
            date(response_date) as response_date,
            COUNT(DISTINCT item_id) as item_count,
            SUM(CASE WHEN is_promotion = 1 THEN 1 ELSE 0 END) as promotion_count,
            SUM(CASE WHEN item_type = 'replacement' THEN 1 ELSE 0 END) as replacement_count,
            AVG(price_quoted) as average_price,
            MAX(response_date) as latest_response,
            GROUP_CONCAT(DISTINCT COALESCE(promotion_name, '')) as promotions,
            inquiry_id,
            json_group_array(
                json_object(
                    'supplier_response_id', supplier_response_id,
                    'item_id', item_id,
                    'price_quoted', price_quoted,
                    'response_date', response_date,
                    'is_promotion', is_promotion,
                    'promotion_name', promotion_name,
                    'notes', notes,
                    'hebrew_description', hebrew_description,
                    'english_description', english_description,
                    'status', status
                )
            ) as responses
        FROM supplier_responses
        WHERE item_id IS NOT NULL
        GROUP BY supplier_id, supplier_name, date(response_date), inquiry_id
    )
    SELECT 
        rs.*,
        ist.total_items,
        rst.total_suppliers,
        rst.responded_items,
        ist.total_items - rst.responded_items as missing_responses,
        (SELECT COUNT(*) FROM supplier_responses) as total_responses
    FROM response_summary rs
    CROSS JOIN inquiry_stats ist
    CROSS JOIN response_stats rst
    ORDER BY rs.response_date DESC`;
}

function getSupplierResponsesQuery() {
    return {
        query: getMainQuery(),
        params: (inquiryId, page = 1, pageSize = 50) => {
            return [
                inquiryId,  // For supplier_responses CTE
                inquiryId   // For inquiry_stats CTE
            ];
        }
    };
}

module.exports = {
    getMainQuery,
    getSupplierResponsesQuery
};
