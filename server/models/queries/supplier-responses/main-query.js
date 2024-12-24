function getMainQuery() {
  return `
    PRAGMA group_concat_max_len = 50000;
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
    responding_suppliers AS (
        -- Get suppliers who have responded to this inquiry (including promotions)
        SELECT DISTINCT
            s.supplier_id,
            s.name as supplier_name
        FROM supplier s
        LEFT JOIN supplier_response sr ON s.supplier_id = sr.supplier_id
        LEFT JOIN promotion p ON s.supplier_id = p.supplier_id
        WHERE (
            (sr.inquiry_id = ? AND sr.status != 'deleted' AND sr.price_quoted IS NOT NULL)
            OR
            (p.is_active = 1)
        )
    ),
    promotion_responses AS (
        -- Get active promotion responses
        SELECT 
            p.supplier_id,
            s.name as supplier_name,
            p.start_date as response_date,
            pi.item_id,
            pi.promotion_item_id as supplier_response_id,
            pi.promotion_price as price_quoted,
            'active' as status,
            1 as is_promotion,
            p.name as promotion_name,
            '' as notes,
            COALESCE(i.hebrew_description, '') as hebrew_description,
            COALESCE(i.english_description, '') as english_description,
            COALESCE(i.origin, '') as origin
        FROM promotion p
        JOIN supplier s ON p.supplier_id = s.supplier_id
        JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
        LEFT JOIN item i ON pi.item_id = i.item_id
        WHERE p.is_active = 1
        AND pi.promotion_price IS NOT NULL
        AND pi.promotion_price > 0
    ),
    supplier_responses AS (
        -- Get valid responses (not deleted, has price)
        SELECT DISTINCT
            sr.supplier_id,
            s.name as supplier_name,
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
            COALESCE(sri.origin, i.origin, '') as origin
        FROM supplier_response sr
        INNER JOIN supplier s ON sr.supplier_id = s.supplier_id
        LEFT JOIN supplier_response_item sri ON sr.supplier_response_id = sri.supplier_response_id
        LEFT JOIN item i ON sr.item_id = i.item_id
        WHERE sr.inquiry_id = ?
            AND sr.status != 'deleted'
            AND sr.price_quoted IS NOT NULL
            AND sr.price_quoted > 0
    ),
    all_responses AS (
        -- Combine regular and promotion responses
        SELECT * FROM supplier_responses
        UNION ALL
        SELECT * FROM promotion_responses
    ),
    supplier_stats AS (
        -- Calculate stats per supplier
        SELECT 
            s.supplier_id,
            s.supplier_name,
            (
                SELECT COUNT(DISTINCT ar.item_id)
                FROM all_responses ar
                WHERE ar.supplier_id = s.supplier_id
            ) as responded_count,
            (
                SELECT COUNT(*)
                FROM inquiry_items ii2
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM all_responses ar
                    WHERE ar.supplier_id = s.supplier_id
                    AND ar.item_id = ii2.item_id
                )
            ) as missing_count,
            (SELECT COUNT(*) FROM inquiry_items) as total_items,
            (
                SELECT MAX(ar.response_date)
                FROM all_responses ar
                WHERE ar.supplier_id = s.supplier_id
            ) as latest_response,
            (
                SELECT AVG(NULLIF(ar.price_quoted, 0))
                FROM all_responses ar
                WHERE ar.supplier_id = s.supplier_id
            ) as average_price,
            (
                SELECT COUNT(*)
                FROM all_responses ar
                WHERE ar.supplier_id = s.supplier_id
                AND ar.is_promotion = 1
            ) as promotion_count
        FROM responding_suppliers s
    ),
    covered_items AS (
        -- Get all items covered by any response (regular or promotion)
        SELECT DISTINCT item_id
        FROM all_responses
        WHERE price_quoted IS NOT NULL
        AND price_quoted > 0
    ),
    missing_items AS (
        -- Get missing items per supplier with full details
        SELECT 
            s.supplier_id,
            GROUP_CONCAT(
                json_object(
                    'item_id', ii.item_id,
                    'hebrew_description', COALESCE(ii.hebrew_description, ''),
                    'english_description', COALESCE(ii.english_description, ''),
                    'requested_qty', COALESCE(ii.requested_qty, 0),
                    'retail_price', COALESCE(ii.retail_price, 0),
                    'origin', COALESCE(ii.origin, '')
                )
            , ';') as missing_items_list
        FROM responding_suppliers s
        CROSS JOIN inquiry_items ii
        WHERE NOT EXISTS (
            SELECT 1
            FROM covered_items ci
            WHERE ci.item_id = ii.item_id
        )
        GROUP BY s.supplier_id
    ),
    response_array AS (
        -- Create responses array in chunks
        SELECT 
            supplier_id,
            GROUP_CONCAT(
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
        FROM (
            SELECT 
                supplier_id,
                supplier_response_id,
                item_id,
                price_quoted,
                response_date,
                is_promotion,
                promotion_name,
                notes,
                hebrew_description,
                english_description,
                status,
                (ROW_NUMBER() OVER (PARTITION BY supplier_id ORDER BY supplier_response_id) - 1) / 50 as chunk
            FROM all_responses
        )
        GROUP BY supplier_id, chunk
    )
    SELECT 
        -- Supplier data
        ss.supplier_id,
        ss.supplier_name,
        ss.responded_count as item_count,
        ss.missing_count,
        ss.total_items as total_expected_items,
        ss.latest_response,
        ss.average_price,
        ss.promotion_count,
        
        -- Arrays
        '[' || GROUP_CONCAT(ra.responses) || ']' as responses,
        COALESCE(mi.missing_items_list, '') as missing_items,
        
        -- Global stats
        (SELECT COUNT(DISTINCT supplier_id) FROM responding_suppliers) as total_suppliers,
        (SELECT COUNT(DISTINCT item_id) FROM covered_items) as responded_items,
        (SELECT COUNT(*) FROM inquiry_items) as total_items,
        (
            SELECT COUNT(*)
            FROM (
                -- Count all valid responses from both sources
                SELECT supplier_response_id as response_id
                FROM supplier_response
                WHERE inquiry_id = ?
                AND status != 'deleted'
                AND price_quoted IS NOT NULL
                AND price_quoted > 0
                UNION ALL
                SELECT promotion_item_id
                FROM promotion p
                JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
                WHERE p.is_active = 1
                AND pi.promotion_price IS NOT NULL
                AND pi.promotion_price > 0
            )
        ) as total_responses,
        (SELECT SUM(missing_count) FROM supplier_stats) as total_missing_items
        
    FROM supplier_stats ss
    LEFT JOIN response_array ra ON ss.supplier_id = ra.supplier_id
    LEFT JOIN missing_items mi ON ss.supplier_id = mi.supplier_id
    GROUP BY ss.supplier_id
    ORDER BY ss.latest_response DESC NULLS LAST`;
}

function getSupplierResponsesQuery() {
  return {
    query: getMainQuery(),
    params: (inquiryId, page = 1, pageSize = 50) => {
      return [
        inquiryId,  // For inquiry_items CTE
        inquiryId,  // For responding_suppliers CTE
        inquiryId,  // For supplier_responses CTE
        inquiryId,   // For total_responses subquery
      ];
    },
  };
}

module.exports = {
  getMainQuery,
  getSupplierResponsesQuery,
};
