function getInquiryItemsQuery() {
    return `inquiry_items AS (
        SELECT DISTINCT 
            ii.inquiry_item_id,
            ii.item_id,
            i.hebrew_description,
            i.english_description,
            i.import_markup,
            i.hs_code,
            i.origin,
            i.stock_quantity,
            ii.requested_qty,
            ii.retail_price,
            p.id as promotion_id,
            p.name as promotion_name,
            pi.promotion_price,
            p.start_date as promotion_start_date,
            p.end_date as promotion_end_date,
            (
                SELECT json_group_array(
                    json_object(
                        'supplier_id', sr.supplier_id,
                        'supplier_name', s.name,
                        'price_quoted', sr.price_quoted,
                        'response_date', sr.response_date,
                        'is_promotion', COALESCE(sr.is_promotion, 0)
                    )
                )
                FROM supplier_response sr
                LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
                WHERE sr.item_id = ii.item_id
                AND sr.status != 'deleted'
                ORDER BY sr.response_date DESC
            ) as supplier_prices
        FROM inquiry_item ii
        JOIN item i ON ii.item_id = i.item_id
        LEFT JOIN promotion_items pi ON ii.item_id = pi.item_id
        LEFT JOIN promotions p ON pi.promotion_id = p.id 
            AND p.is_active = 1 
            AND (p.start_date IS NULL OR p.start_date <= datetime('now'))
            AND (p.end_date IS NULL OR p.end_date >= datetime('now'))
        WHERE ii.inquiry_id = ?
        ORDER BY ii.excel_row_index
    )`;
}

module.exports = {
    getInquiryItemsQuery
};
