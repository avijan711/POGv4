function getMainQuery() {
    // Base query for supplier responses with pagination and improved error handling
    return `
    WITH RECURSIVE check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'supplier_response'
        ) as has_supplier_response
    ),
    supplier_responses AS (
        SELECT DISTINCT
            sr.supplier_id,
            COALESCE(s.name, 'Unknown Supplier') as supplier_name,
            sr.response_date,
            sr.item_id,
            sr.supplier_response_id,
            sr.price_quoted,
            sr.status,
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
        FROM check_tables ct
        CROSS JOIN (SELECT ? as inquiry_id) params
        LEFT JOIN supplier_response sr ON ct.has_supplier_response = 1
        LEFT JOIN supplier_response_item sri ON sr.supplier_response_id = sri.supplier_response_id
        LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
        LEFT JOIN inquiry_item ii ON sr.item_id = ii.item_id AND ii.inquiry_id = params.inquiry_id
        LEFT JOIN item i ON sr.item_id = i.item_id
        LEFT JOIN item_reference_change irc ON sr.item_id = irc.original_item_id 
            AND sr.supplier_id = irc.supplier_id
            AND date(sr.response_date) = date(irc.change_date)
        WHERE (ct.has_supplier_response = 0) OR (ii.inquiry_id IS NOT NULL)
        ORDER BY sr.response_date DESC, sr.supplier_id
        LIMIT ? OFFSET ?
    ),
    response_summary AS (
        SELECT 
            supplier_id,
            supplier_name,
            date(response_date) as response_date,
            COUNT(DISTINCT item_id) as item_count,
            SUM(CASE WHEN is_promotion = 1 THEN 1 ELSE 0 END) as promotion_count,
            SUM(CASE WHEN item_type = 'replacement' THEN 1 ELSE 0 END) as replacement_count,
            GROUP_CONCAT(DISTINCT COALESCE(promotion_name, '')) as promotions
        FROM supplier_responses
        WHERE item_id IS NOT NULL
        GROUP BY supplier_id, supplier_name, date(response_date)
    )
    SELECT 
        rs.response_date as date,
        rs.supplier_id,
        rs.supplier_name,
        COALESCE(rs.item_count, 0) as item_count,
        COALESCE(rs.promotion_count, 0) as extra_items_count,
        COALESCE(rs.replacement_count, 0) as replacements_count,
        rs.promotions as debug_promotions,
        COALESCE(
            json_group_array(
                CASE WHEN sr.item_id IS NOT NULL THEN
                    json_object(
                        'item_id', sr.item_id,
                        'price_quoted', COALESCE(sr.price_quoted, 0),
                        'status', COALESCE(sr.status, 'pending'),
                        'response_id', sr.supplier_response_id,
                        'hebrew_description', COALESCE(sr.hebrew_description, ''),
                        'english_description', COALESCE(sr.english_description, ''),
                        'origin', COALESCE(sr.origin, ''),
                        'notes', COALESCE(sr.notes, ''),
                        'response_date', sr.response_date,
                        'item_type', sr.item_type,
                        'item_key', CASE 
                            WHEN sr.item_type = 'replacement' 
                            THEN 'ref-' || sr.item_id || '-' || sr.new_reference_id
                            ELSE 'resp-' || sr.item_id
                        END
                    )
                ELSE NULL
                END
            ) FILTER (WHERE sr.item_id IS NOT NULL),
            '[]'
        ) as items
    FROM response_summary rs
    LEFT JOIN supplier_responses sr 
        ON rs.supplier_id = sr.supplier_id 
        AND date(rs.response_date) = date(sr.response_date)
    GROUP BY 
        rs.response_date,
        rs.supplier_id,
        rs.supplier_name,
        rs.item_count,
        rs.promotion_count,
        rs.replacement_count,
        rs.promotions
    ORDER BY rs.response_date DESC`;
}

function getSupplierResponsesQuery() {
    return {
        query: getMainQuery(),
        params: (inquiryId, page = 1, pageSize = 50) => {
            const offset = (page - 1) * pageSize;
            return [
                inquiryId,
                pageSize,
                offset
            ];
        }
    };
}

module.exports = {
    getMainQuery,
    getSupplierResponsesQuery
};
