module.exports = `
    WITH RECURSIVE 
    check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'supplier_response'
        ) as has_supplier_response
    ),
    inquiry_items AS (
        SELECT DISTINCT 
            ii.item_id,
            i.hebrew_description,
            i.english_description,
            ii.requested_qty,
            ii.retail_price
        FROM inquiry_item ii
        JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    ),
    response_stats AS (
        -- Get all response items for this supplier and date
        SELECT DISTINCT
            sr.item_id as response_item_id,
            ii.item_id as inquiry_item_id,
            irc.new_reference_id as replacement_id,
            sr.supplier_id,
            sr.response_date,
            ii.hebrew_description,
            ii.english_description,
            ii.requested_qty,
            ii.retail_price,
            sr.price_quoted,
            sr.status as response_status,
            sr.supplier_response_id,
            CASE
                WHEN ii.item_id IS NULL THEN 'extra'
                WHEN irc.new_reference_id IS NOT NULL THEN 'replacement'
                ELSE 'matched'
            END as item_status
        FROM check_tables ct
        CROSS JOIN (SELECT 1) params
        LEFT JOIN supplier_response sr ON ct.has_supplier_response = 1
        LEFT JOIN inquiry_items ii ON sr.item_id = ii.item_id
        LEFT JOIN item_reference_change irc ON sr.item_id = irc.original_item_id 
            AND sr.supplier_id = irc.supplier_id
            AND date(sr.response_date) = date(irc.change_date)
        WHERE ct.has_supplier_response = 0 OR sr.item_id IS NOT NULL
    ),
    supplier_stats AS (
        -- Calculate statistics per supplier
        SELECT 
            rs.supplier_id,
            rs.response_date,
            COUNT(DISTINCT CASE WHEN rs.item_status = 'extra' THEN rs.response_item_id END) as extra_count,
            COUNT(DISTINCT CASE WHEN rs.item_status = 'replacement' THEN rs.response_item_id END) as replacement_count,
            COUNT(DISTINCT rs.response_item_id) as total_count
        FROM response_stats rs
        WHERE rs.response_item_id IS NOT NULL
        GROUP BY rs.supplier_id, rs.response_date
    ),
    missing_items AS (
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
            WHERE response_item_id IS NOT NULL
        ) sr
        WHERE NOT EXISTS (
            SELECT 1 
            FROM response_stats rs 
            WHERE rs.response_item_id = ii.item_id
            AND rs.supplier_id = sr.supplier_id
            AND date(rs.response_date) = date(sr.response_date)
        )
    )
    SELECT 
        date(rs.response_date) as date,
        rs.supplier_id,
        s.name as supplier_name,
        ss.total_count as item_count,
        ss.extra_count as extra_items_count,
        ss.replacement_count as replacements_count,
        (
            SELECT COUNT(DISTINCT item_id)
            FROM missing_items mi
            WHERE mi.supplier_id = rs.supplier_id
            AND date(mi.response_date) = date(rs.response_date)
        ) as missing_items_count,
        (
            SELECT json_group_array(
                json_object(
                    'item_id', item_id,
                    'hebrew_description', hebrew_description,
                    'english_description', english_description,
                    'requested_qty', requested_qty,
                    'retail_price', retail_price
                )
            )
            FROM (
                SELECT DISTINCT 
                    item_id,
                    hebrew_description,
                    english_description,
                    requested_qty,
                    retail_price
                FROM response_stats
                WHERE item_status = 'extra'
                AND supplier_id = rs.supplier_id
                AND date(response_date) = date(rs.response_date)
                LIMIT 100
            )
        ) as extra_items,
        (
            SELECT json_group_array(
                json_object(
                    'original', response_item_id,
                    'replacement', replacement_id,
                    'hebrew_description', hebrew_description,
                    'english_description', english_description,
                    'requested_qty', requested_qty,
                    'retail_price', retail_price
                )
            )
            FROM (
                SELECT DISTINCT 
                    response_item_id,
                    replacement_id,
                    hebrew_description,
                    english_description,
                    requested_qty,
                    retail_price
                FROM response_stats
                WHERE item_status = 'replacement'
                AND supplier_id = rs.supplier_id
                AND date(response_date) = date(rs.response_date)
            )
        ) as replacements,
        (
            SELECT json_group_array(
                json_object(
                    'item_id', item_id,
                    'hebrew_description', hebrew_description,
                    'english_description', english_description,
                    'requested_qty', requested_qty,
                    'retail_price', retail_price
                )
            )
            FROM (
                SELECT DISTINCT 
                    item_id,
                    hebrew_description,
                    english_description,
                    requested_qty,
                    retail_price
                FROM missing_items mi
                WHERE mi.supplier_id = rs.supplier_id
                AND date(mi.response_date) = date(rs.response_date)
            )
        ) as missing_items,
        COALESCE(
            (
                SELECT GROUP_CONCAT(DISTINCT promotion_name)
                FROM check_tables ct
                LEFT JOIN supplier_response sr2 ON ct.has_supplier_response = 1
                WHERE ct.has_supplier_response = 1
                AND sr2.supplier_id = rs.supplier_id
                AND sr2.is_promotion = 1
                AND date(sr2.response_date) = date(rs.response_date)
            ),
            ''
        ) as debug_promotions,
        (
            SELECT json_group_array(
                json_object(
                    'item_id', response_item_id,
                    'price_quoted', price_quoted,
                    'status', COALESCE(response_status, ''),
                    'response_id', supplier_response_id,
                    'hebrew_description', hebrew_description,
                    'english_description', english_description,
                    'item_type', item_status,
                    'item_key', CASE 
                        WHEN item_status = 'replacement' 
                        THEN 'ref-' || response_item_id || '-' || replacement_id
                        ELSE 'resp-' || response_item_id
                    END
                )
            )
            FROM (
                SELECT DISTINCT 
                    response_item_id,
                    price_quoted,
                    response_status,
                    supplier_response_id,
                    hebrew_description,
                    english_description,
                    item_status,
                    replacement_id
                FROM response_stats
                WHERE supplier_id = rs.supplier_id
                AND date(response_date) = date(rs.response_date)
                AND response_item_id IS NOT NULL
            )
        ) as items
    FROM response_stats rs
    JOIN supplier s ON rs.supplier_id = s.supplier_id
    JOIN supplier_stats ss ON rs.supplier_id = ss.supplier_id 
        AND date(rs.response_date) = date(ss.response_date)
    WHERE rs.response_item_id IS NOT NULL
    GROUP BY date(rs.response_date), rs.supplier_id, s.name
    ORDER BY rs.response_date DESC`;
