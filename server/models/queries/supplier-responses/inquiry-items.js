function getInquiryItemsQuery() {
  return `inquiry_items AS (
        WITH ReferenceInfo AS (
            SELECT 
                rc.original_item_id,
                rc.new_reference_id,
                rc.change_date,
                rc.notes,
                s.name as supplier_name,
                rc.changed_by_user,
                JSON_OBJECT(
                    'new_reference_id', rc.new_reference_id,
                    'change_date', rc.change_date,
                    'notes', rc.notes,
                    'supplier_name', s.name,
                    'source', CASE WHEN rc.supplier_id IS NOT NULL THEN 'supplier' ELSE 'user' END
                ) as reference_change
            FROM item_reference_change rc
            LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
            WHERE (rc.original_item_id, rc.change_date) IN (
                SELECT original_item_id, MAX(change_date)
                FROM item_reference_change
                GROUP BY original_item_id
            )
        ),
        ReferencedBy AS (
            SELECT 
                new_reference_id as item_id,
                COUNT(*) as referenced_by_count,
                GROUP_CONCAT(original_item_id) as referencing_items
            FROM item_reference_change
            GROUP BY new_reference_id
        ),
        ValidSupplierResponses AS (
            SELECT 
                sr.inquiry_id,
                sr.item_id,
                json_group_array(
                    json_object(
                        'supplier_id', sr.supplier_id,
                        'supplier_name', s.name,
                        'price_quoted', sr.price_quoted,
                        'response_date', sr.response_date,
                        'is_promotion', COALESCE(sr.is_promotion, 0),
                        'promotion_name', sr.promotion_name,
                        'notes', sr.notes,
                        'status', sr.status
                    )
                ) as supplier_responses
            FROM supplier_response sr
            JOIN supplier s ON sr.supplier_id = s.supplier_id
            WHERE sr.status != 'deleted'
                AND s.name IS NOT NULL
                AND sr.price_quoted IS NOT NULL
            GROUP BY sr.inquiry_id, sr.item_id
        ),
        BaseItems AS (
            SELECT DISTINCT
                ii.inquiry_item_id,
                ii.item_id,
                i.hebrew_description,
                i.english_description,
                i.import_markup,
                i.hs_code,
                i.origin,
                ii.qty_in_stock,
                ii.requested_qty,
                ii.retail_price,
                ii.excel_row_index
            FROM inquiry_item ii
            JOIN item i ON ii.item_id = i.item_id
            WHERE ii.inquiry_id = ?
        )
        SELECT 
            bi.*,
            p.id as promotion_id,
            p.name as promotion_name,
            pi.promotion_price,
            p.start_date as promotion_start_date,
            p.end_date as promotion_end_date,
            ri.reference_change,
            CASE 
                WHEN ri.new_reference_id IS NOT NULL THEN 1 
                ELSE 0 
            END as has_reference_change,
            CASE 
                WHEN rb.referenced_by_count > 0 THEN 1 
                ELSE 0 
            END as is_referenced_by,
            rb.referencing_items,
            COALESCE(vsr.supplier_responses, '[]') as supplier_responses
        FROM BaseItems bi
        LEFT JOIN promotion_items pi ON bi.item_id = pi.item_id
        LEFT JOIN promotions p ON pi.promotion_id = p.id 
            AND p.is_active = 1 
            AND (p.start_date IS NULL OR p.start_date <= datetime('now'))
            AND (p.end_date IS NULL OR p.end_date >= datetime('now'))
        LEFT JOIN ReferenceInfo ri ON bi.item_id = ri.original_item_id
        LEFT JOIN ReferencedBy rb ON bi.item_id = rb.item_id
        LEFT JOIN ValidSupplierResponses vsr ON bi.item_id = vsr.item_id 
            AND ? = vsr.inquiry_id
        ORDER BY bi.excel_row_index
    )`;
}

module.exports = {
  getInquiryItemsQuery,
};
