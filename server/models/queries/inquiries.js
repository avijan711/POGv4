function getInquiriesQuery(status) {
    return `
        WITH inquiry_stats AS (
            SELECT 
                i.inquiry_id,
                COUNT(DISTINCT ii.inquiry_item_id) as item_count,
                COUNT(DISTINCT sr.supplier_id) as responded_suppliers_count,
                SUM(CASE WHEN sr.supplier_response_id IS NULL THEN 1 ELSE 0 END) as not_responded_items_count,
                COUNT(DISTINCT irc.change_id) as total_replacements_count
            FROM inquiry i
            LEFT JOIN inquiry_item ii ON i.inquiry_id = ii.inquiry_id
            LEFT JOIN supplier_response sr ON sr.inquiry_id = i.inquiry_id AND sr.status != 'pending'
            LEFT JOIN item_reference_change irc ON irc.original_item_id = ii.item_id
            GROUP BY i.inquiry_id
        )
        SELECT 
            i.inquiry_id,
            i.inquiry_number as custom_number,
            i.date,
            COALESCE(i.status, 'new') as status,
            COALESCE(s.item_count, 0) as item_count,
            COALESCE(s.responded_suppliers_count, 0) as responded_suppliers_count,
            COALESCE(s.not_responded_items_count, 0) as not_responded_items_count,
            COALESCE(s.total_replacements_count, 0) as total_replacements_count
        FROM inquiry i
        LEFT JOIN inquiry_stats s ON i.inquiry_id = s.inquiry_id
        ${status ? 'WHERE i.status = ?' : ''}
        ORDER BY i.date DESC`;
}

function getInquiryByIdQuery() {
    return `
        WITH inquiry_data AS (
            SELECT 
                i.inquiry_id,
                i.inquiry_number as custom_number,
                i.date,
                COALESCE(i.status, 'new') as status
            FROM inquiry i
            WHERE i.inquiry_id = ?
        ),
        reference_changes AS (
            -- Get all reference changes where inquiry items are either original or new reference
            SELECT 
                irc.original_item_id,
                irc.change_id,
                irc.new_reference_id,
                irc.notes,
                s.name as supplier_name,
                irc.change_date,
                'supplier' as source,
                ii.inquiry_id
            FROM item_reference_change irc
            LEFT JOIN supplier_response sr ON irc.supplier_id = sr.supplier_id
            LEFT JOIN supplier s ON irc.supplier_id = s.supplier_id
            JOIN inquiry_item ii ON (
                ii.item_id = irc.original_item_id OR 
                ii.item_id = irc.new_reference_id OR
                ii.original_item_id = irc.original_item_id OR
                ii.original_item_id = irc.new_reference_id
            )
            WHERE ii.inquiry_id = ?
        ),
        supplier_responses AS (
            SELECT 
                sr.item_id,
                json_group_array(
                    json_object(
                        'response_id', sr.supplier_response_id,
                        'supplier_id', sr.supplier_id,
                        'supplier_name', s.name,
                        'date', sr.response_date,
                        'price_quoted', COALESCE(sr.price_quoted, 0),
                        'status', sr.status,
                        'notes', COALESCE(sri.notes, ''),
                        'hs_code', COALESCE(sri.hs_code, ''),
                        'english_description', COALESCE(sri.english_description, ''),
                        'origin', COALESCE(sri.origin, ''),
                        'new_reference_id', sri.new_reference_id
                    )
                ) as responses
            FROM supplier_response sr
            JOIN supplier s ON sr.supplier_id = s.supplier_id
            LEFT JOIN supplier_response_item sri ON sr.supplier_response_id = sri.supplier_response_id
            WHERE sr.inquiry_id = ?
            GROUP BY sr.item_id
        ),
        items_data AS (
            SELECT 
                ii.inquiry_item_id,
                ii.item_id,
                ii.original_item_id,
                ii.hebrew_description,
                COALESCE(ii.english_description, '') as english_description,
                COALESCE(CAST(ii.import_markup AS REAL), 1.30) as import_markup,
                COALESCE(ii.hs_code, '') as hs_code,
                COALESCE(ii.origin, '') as origin,
                COALESCE(ii.qty_in_stock, 0) as qty_in_stock,
                COALESCE(ii.sold_this_year, 0) as sold_this_year,
                COALESCE(ii.sold_last_year, 0) as sold_last_year,
                ii.retail_price,
                COALESCE(ii.requested_qty, 0) as requested_qty,
                ii.new_reference_id,
                ii.reference_notes,
                CASE 
                    WHEN ii.new_reference_id IS NOT NULL THEN 1
                    WHEN EXISTS (
                        SELECT 1 FROM reference_changes rc 
                        WHERE rc.original_item_id = ii.item_id OR rc.original_item_id = ii.original_item_id
                    ) THEN 1 
                    ELSE 0 
                END as has_reference_change,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM reference_changes rc 
                        WHERE rc.new_reference_id = ii.item_id OR rc.new_reference_id = ii.original_item_id
                    ) THEN 1 
                    ELSE 0 
                END as is_referenced_by,
                CASE
                    WHEN ii.new_reference_id IS NOT NULL THEN json_object(
                        'new_reference_id', ii.new_reference_id,
                        'source', 'inquiry_item',
                        'notes', COALESCE(ii.reference_notes, '')
                    )
                    ELSE (
                        SELECT json_object(
                            'change_id', rc.change_id,
                            'new_reference_id', rc.new_reference_id,
                            'source', rc.source,
                            'supplier_name', COALESCE(rc.supplier_name, ''),
                            'notes', COALESCE(rc.notes, '')
                        )
                        FROM reference_changes rc
                        WHERE rc.original_item_id = ii.item_id OR rc.original_item_id = ii.original_item_id
                        ORDER BY rc.change_date DESC
                        LIMIT 1
                    )
                END as reference_change,
                COALESCE(
                    (
                        SELECT json_group_array(
                            json_object(
                                'item_id', rc.original_item_id,
                                'reference_change', json_object(
                                    'change_id', rc.change_id,
                                    'source', rc.source,
                                    'supplier_name', COALESCE(rc.supplier_name, ''),
                                    'notes', COALESCE(rc.notes, '')
                                )
                            )
                        )
                        FROM reference_changes rc
                        WHERE rc.new_reference_id = ii.item_id OR rc.new_reference_id = ii.original_item_id
                    ),
                    '[]'
                ) as referencing_items,
                COALESCE(sr.responses, '[]') as supplier_responses
            FROM inquiry_item ii
            LEFT JOIN supplier_responses sr ON ii.item_id = sr.item_id
            WHERE ii.inquiry_id = ?
        )
        SELECT 
            json_object(
                'inquiry_id', id.inquiry_id,
                'custom_number', id.custom_number,
                'date', id.date,
                'status', id.status
            ) as inquiry,
            COALESCE(
                json_group_array(
                    json_object(
                        'inquiry_item_id', itd.inquiry_item_id,
                        'item_id', itd.item_id,
                        'original_item_id', itd.original_item_id,
                        'hebrew_description', itd.hebrew_description,
                        'english_description', itd.english_description,
                        'import_markup', itd.import_markup,
                        'hs_code', itd.hs_code,
                        'origin', itd.origin,
                        'qty_in_stock', itd.qty_in_stock,
                        'sold_this_year', itd.sold_this_year,
                        'sold_last_year', itd.sold_last_year,
                        'retail_price', itd.retail_price,
                        'requested_qty', itd.requested_qty,
                        'new_reference_id', itd.new_reference_id,
                        'reference_notes', COALESCE(itd.reference_notes, ''),
                        'has_reference_change', itd.has_reference_change,
                        'is_referenced_by', itd.is_referenced_by,
                        'reference_change', COALESCE(itd.reference_change, 'null'),
                        'referencing_items', COALESCE(itd.referencing_items, '[]'),
                        'supplier_responses', json(itd.supplier_responses)
                    )
                ),
                '[]'
            ) as items
        FROM inquiry_data id
        LEFT JOIN items_data itd ON 1=1
        GROUP BY id.inquiry_id`;
}

module.exports = {
    getInquiriesQuery,
    getInquiryByIdQuery
};
