function getMainQuery() {
    return `
    WITH inquiry_items AS (
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
    supplier_responses AS (
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
    active_suppliers AS (
        SELECT DISTINCT 
            sr.supplier_id,
            sr.supplier_name
        FROM supplier_responses sr
    ),
    supplier_item_matrix AS (
        SELECT 
            s.supplier_id,
            s.supplier_name,
            ii.item_id,
            ii.hebrew_description,
            ii.english_description,
            ii.requested_qty,
            ii.retail_price,
            ii.origin,
            CASE 
                WHEN sr.item_id IS NULL THEN 1 
                ELSE 0 
            END as is_missing
        FROM active_suppliers s
        CROSS JOIN inquiry_items ii
        LEFT JOIN supplier_responses sr ON 
            s.supplier_id = sr.supplier_id AND 
            ii.item_id = sr.item_id
    ),
    supplier_missing_items AS (
        SELECT 
            supplier_id,
            supplier_name,
            COUNT(CASE WHEN is_missing = 1 THEN 1 END) as missing_count,
            json_group_array(
                CASE WHEN is_missing = 1 THEN
                    json_object(
                        'item_id', item_id,
                        'hebrew_description', hebrew_description,
                        'english_description', english_description,
                        'requested_qty', CAST(requested_qty AS INTEGER),
                        'retail_price', CAST(retail_price AS REAL),
                        'origin', COALESCE(origin, '')
                    )
                ELSE NULL
                END
            ) FILTER (WHERE is_missing = 1) as missing_items
        FROM supplier_item_matrix
        GROUP BY supplier_id, supplier_name
    ),
    supplier_response_stats AS (
        SELECT 
            supplier_id,
            COUNT(DISTINCT item_id) as item_count,
            SUM(CASE WHEN is_promotion = 1 THEN 1 ELSE 0 END) as promotion_count,
            SUM(CASE WHEN item_type = 'replacement' THEN 1 ELSE 0 END) as replacement_count,
            AVG(NULLIF(price_quoted, 0)) as average_price
        FROM supplier_responses
        GROUP BY supplier_id
    ),
    response_summary AS (
        SELECT 
            sr.supplier_id,
            sr.supplier_name,
            date(sr.response_date) as response_date,
            srs.item_count,
            srs.promotion_count,
            srs.replacement_count,
            srs.average_price,
            MAX(sr.response_date) as latest_response,
            GROUP_CONCAT(DISTINCT COALESCE(sr.promotion_name, '')) as promotions,
            sr.inquiry_id,
            json_group_array(
                json_object(
                    'supplier_response_id', sr.supplier_response_id,
                    'item_id', sr.item_id,
                    'price_quoted', sr.price_quoted,
                    'response_date', sr.response_date,
                    'is_promotion', sr.is_promotion,
                    'promotion_name', sr.promotion_name,
                    'notes', sr.notes,
                    'hebrew_description', sr.hebrew_description,
                    'english_description', sr.english_description,
                    'status', sr.status
                )
            ) as responses,
            COALESCE(smi.missing_count, 0) as missing_count,
            COALESCE(smi.missing_items, '[]') as missing_items
        FROM supplier_responses sr
        LEFT JOIN supplier_response_stats srs ON sr.supplier_id = srs.supplier_id
        LEFT JOIN supplier_missing_items smi ON sr.supplier_id = smi.supplier_id
        GROUP BY sr.supplier_id, sr.supplier_name, date(sr.response_date), sr.inquiry_id
    ),
    global_stats AS (
        SELECT 
            COUNT(DISTINCT supplier_id) as total_suppliers,
            COUNT(DISTINCT item_id) as responded_items,
            (SELECT COUNT(*) FROM inquiry_items) as total_items,
            (SELECT COUNT(*) FROM supplier_responses) as total_responses
        FROM supplier_responses
    )
    SELECT 
        rs.*,
        gs.total_items,
        gs.total_suppliers,
        gs.responded_items,
        gs.total_items - gs.responded_items as missing_responses,
        gs.total_responses
    FROM response_summary rs
    CROSS JOIN global_stats gs
    ORDER BY rs.response_date DESC`;
}

function getSupplierResponsesQuery() {
    return {
        query: getMainQuery(),
        params: (inquiryId, page = 1, pageSize = 50) => {
            return [
                inquiryId,  // For inquiry_items CTE
                inquiryId   // For supplier_responses CTE
            ];
        }
    };
}

module.exports = {
    getMainQuery,
    getSupplierResponsesQuery
};
