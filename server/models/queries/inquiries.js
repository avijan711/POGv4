const getInquiriesQuery = (status) => `
    WITH item_details AS (
        SELECT 
            ii.inquiry_id,
            ii.inquiry_item_id,
            ii.item_id,
            ii.original_item_id,
            ii.hebrew_description,
            ii.english_description,
            ii.import_markup,
            ii.hs_code,
            ii.qty_in_stock,
            ii.sold_this_year,
            ii.sold_last_year,
            ii.retail_price,
            ii.requested_qty,
            ii.new_reference_id,
            ii.reference_notes,
            ii.origin,
            i.image,
            CASE 
                WHEN ii.new_reference_id IS NOT NULL AND ii.new_reference_id != ii.item_id THEN 1
                ELSE 0
            END as has_reference_change,
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM inquiry_item ii2 
                    WHERE ii2.new_reference_id = ii.item_id
                    AND ii2.item_id != ii2.new_reference_id
                ) THEN 1
                ELSE 0
            END as is_referenced_by
        FROM inquiry_item ii
        LEFT JOIN item i ON ii.item_id = i.item_id
    ),
    inquiry_data AS (
        SELECT 
            i.inquiry_id,
            i.inquiry_number,
            i.status,
            i.date,
            json_group_array(
                json_object(
                    'inquiry_item_id', itd.inquiry_item_id,
                    'item_id', itd.item_id,
                    'original_item_id', itd.original_item_id,
                    'hebrew_description', itd.hebrew_description,
                    'english_description', itd.english_description,
                    'import_markup', itd.import_markup,
                    'hs_code', itd.hs_code,
                    'image', itd.image,
                    'stock_quantity', itd.qty_in_stock,
                    'sold_this_year', itd.sold_this_year,
                    'sold_last_year', itd.sold_last_year,
                    'retail_price', itd.retail_price,
                    'requested_qty', itd.requested_qty,
                    'new_reference_id', itd.new_reference_id,
                    'reference_notes', itd.reference_notes,
                    'origin', itd.origin,
                    'has_reference_change', itd.has_reference_change,
                    'is_referenced_by', itd.is_referenced_by
                )
            ) as items
        FROM inquiry i
        LEFT JOIN item_details itd ON i.inquiry_id = itd.inquiry_id
        ${status ? 'WHERE i.status = ?' : ''}
        GROUP BY i.inquiry_id, i.inquiry_number, i.status, i.date
        ORDER BY i.date DESC
    )
    SELECT 
        inquiry_id,
        inquiry_number,
        status,
        date,
        items
    FROM inquiry_data`;

const getInquiryByIdQuery = () => `
    WITH inquiry_data AS (
        SELECT 
            i.inquiry_id,
            i.inquiry_number,
            i.status,
            i.date
        FROM inquiry i
        WHERE i.inquiry_id = ?
    ),
    reference_changes AS (
        SELECT 
            ii.item_id,
            ii.new_reference_id,
            ii.reference_notes,
            i.date as change_date,
            s.supplier_id,
            s.name as supplier_name,
            sr.status as supplier_status,
            JSON_OBJECT(
                'new_reference_id', ii.new_reference_id,
                'change_date', i.date,
                'notes', ii.reference_notes,
                'supplier_name', s.name,
                'source', CASE WHEN sr.supplier_id IS NOT NULL THEN 'supplier' ELSE 'user' END
            ) as reference_change
        FROM inquiry_item ii
        JOIN inquiry i ON ii.inquiry_id = i.inquiry_id
        LEFT JOIN supplier_response sr ON ii.inquiry_id = sr.inquiry_id AND ii.item_id = sr.item_id
        LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
        WHERE ii.new_reference_id IS NOT NULL
        AND ii.inquiry_id = ?
    ),
    supplier_responses AS (
        SELECT 
            sr.inquiry_id,
            sr.item_id,
            json_group_array(
                json_object(
                    'supplier_name', s.name,
                    'price_quoted', sr.price_quoted,
                    'response_date', sr.response_date,
                    'is_promotion', COALESCE(sr.is_promotion, 0),
                    'promotion_name', sr.promotion_name,
                    'status', sr.status
                )
            ) as responses
        FROM supplier_response sr
        JOIN supplier s ON sr.supplier_id = s.supplier_id
        WHERE sr.inquiry_id = ?
        AND sr.status != 'deleted'
        AND s.name IS NOT NULL
        AND sr.price_quoted IS NOT NULL
        GROUP BY sr.inquiry_id, sr.item_id
    ),
    items_data AS (
        SELECT 
            ii.inquiry_id,
            ii.inquiry_item_id,
            ii.item_id,
            ii.original_item_id,
            ii.hebrew_description,
            ii.english_description,
            ii.import_markup,
            ii.hs_code,
            ii.qty_in_stock,
            ii.sold_this_year,
            ii.sold_last_year,
            ii.retail_price,
            ii.requested_qty,
            ii.new_reference_id,
            ii.reference_notes,
            ii.origin,
            i.image,
            rc.reference_change,
            CASE 
                WHEN ii.new_reference_id IS NOT NULL AND ii.new_reference_id != ii.item_id THEN 1
                ELSE 0
            END as has_reference_change,
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM inquiry_item ii2 
                    WHERE ii2.new_reference_id = ii.item_id
                    AND ii2.item_id != ii2.new_reference_id
                ) THEN 1
                ELSE 0
            END as is_referenced_by,
            COALESCE(sr.responses, '[]') as supplier_responses
        FROM inquiry_item ii
        LEFT JOIN item i ON ii.item_id = i.item_id
        LEFT JOIN reference_changes rc ON ii.item_id = rc.item_id
        LEFT JOIN supplier_responses sr ON ii.item_id = sr.item_id AND ii.inquiry_id = sr.inquiry_id
        WHERE ii.inquiry_id = ?
    )
    SELECT 
        json_object(
            'inquiry_id', id.inquiry_id,
            'inquiry_number', id.inquiry_number,
            'status', id.status,
            'date', id.date
        ) as inquiry,
        json_group_array(
            json_object(
                'inquiry_item_id', itd.inquiry_item_id,
                'item_id', itd.item_id,
                'original_item_id', itd.original_item_id,
                'hebrew_description', itd.hebrew_description,
                'english_description', itd.english_description,
                'import_markup', itd.import_markup,
                'hs_code', itd.hs_code,
                'image', itd.image,
                'stock_quantity', itd.qty_in_stock,
                'sold_this_year', itd.sold_this_year,
                'sold_last_year', itd.sold_last_year,
                'retail_price', itd.retail_price,
                'requested_qty', itd.requested_qty,
                'new_reference_id', itd.new_reference_id,
                'reference_notes', itd.reference_notes,
                'origin', itd.origin,
                'has_reference_change', itd.has_reference_change,
                'is_referenced_by', itd.is_referenced_by,
                'reference_change', json(itd.reference_change),
                'supplier_responses', json(itd.supplier_responses)
            )
        ) as items
    FROM inquiry_data id
    LEFT JOIN items_data itd ON id.inquiry_id = itd.inquiry_id
    GROUP BY id.inquiry_id, id.inquiry_number, id.status, id.date`;

module.exports = {
    getInquiriesQuery,
    getInquiryByIdQuery
};
