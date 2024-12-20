/**
 * Queries related to handling promotions in supplier responses
 */

/**
 * Get active promotions for suppliers
 * @returns {string} SQL query for active promotions
 */
function getActivePromotionsQuery() {
    return `
    WITH inquiry_promotion_items AS (
        -- Get all items from inquiry that are in active promotions
        SELECT 
            ii.inquiry_id,
            ii.item_id,
            ii.requested_qty,
            i.hebrew_description,
            i.english_description,
            p.promotion_id,
            p.supplier_id,
            p.name as promotion_name,
            p.start_date,
            p.end_date,
            pi.promotion_price,
            CASE WHEN pi.item_id IS NOT NULL THEN 1 ELSE 0 END as in_promotion
        FROM inquiry_item ii
        CROSS JOIN promotion p
        LEFT JOIN promotion_item pi ON ii.item_id = pi.item_id 
            AND p.promotion_id = pi.promotion_id
        LEFT JOIN item i ON ii.item_id = i.item_id
        WHERE p.is_active = 1
        AND ii.inquiry_id = ?
    )
    SELECT 
        ipi.supplier_id,
        s.name as supplier_name,
        ipi.promotion_id,
        ipi.promotion_name,
        ipi.start_date,
        ipi.end_date,
        COUNT(*) as total_inquiry_items,
        SUM(ipi.in_promotion) as items_in_promotion,
        COUNT(*) - SUM(ipi.in_promotion) as missing_items,
        AVG(CASE WHEN ipi.in_promotion = 1 THEN ipi.promotion_price ELSE NULL END) as average_price
    FROM inquiry_promotion_items ipi
    JOIN supplier s ON ipi.supplier_id = s.supplier_id
    GROUP BY ipi.supplier_id, ipi.promotion_id`;
}

/**
 * Get promotion items that are in the inquiry
 * @returns {string} SQL query for promotion items in inquiry
 */
function getPromotionItemsInInquiryQuery() {
    return `
    SELECT 
        i.item_id,
        i.hebrew_description,
        i.english_description,
        ii.requested_qty,
        pi.promotion_price as price_quoted,
        p.name as promotion_name,
        p.start_date as response_date,
        1 as is_promotion,
        '' as notes
    FROM inquiry_item ii
    JOIN item i ON ii.item_id = i.item_id
    JOIN promotion_item pi ON i.item_id = pi.item_id
    JOIN promotion p ON pi.promotion_id = p.promotion_id
    WHERE ii.inquiry_id = ?
    AND p.supplier_id = ?
    AND p.is_active = 1
    ORDER BY i.item_id`;
}

/**
 * Get missing items for a promotion (inquiry items not in promotion)
 * @returns {string} SQL query for missing promotion items
 */
function getMissingPromotionItemsQuery() {
    return `
    WITH inquiry_items AS (
        SELECT 
            ii.item_id,
            ii.requested_qty,
            ii.retail_price,
            COALESCE(i.hebrew_description, '') as hebrew_description,
            COALESCE(i.english_description, '') as english_description,
            COALESCE(i.origin, '') as origin
        FROM inquiry_item ii
        LEFT JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    )
    SELECT 
        ii.item_id,
        ii.hebrew_description,
        ii.english_description,
        COALESCE(ii.requested_qty, 0) as requested_qty,
        COALESCE(ii.retail_price, 0) as retail_price,
        ii.origin
    FROM inquiry_items ii
    WHERE NOT EXISTS (
        SELECT 1
        FROM promotion_item pi
        JOIN promotion p ON pi.promotion_id = p.promotion_id
        WHERE p.supplier_id = ?
        AND p.is_active = 1
        AND pi.item_id = ii.item_id
    )
    ORDER BY ii.item_id`;
}

module.exports = {
    getActivePromotionsQuery,
    getPromotionItemsInInquiryQuery,
    getMissingPromotionItemsQuery
};
