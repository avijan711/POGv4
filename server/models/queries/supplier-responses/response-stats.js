function getResponseStatsQuery() {
    return `WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'SupplierResponse'
        ) as has_supplier_response
    ),
    ResponseStats AS (
        -- Get all response items including promotions
        SELECT DISTINCT
            COALESCE(sr.ItemID, pi.item_id) as ResponseItemID,
            ii.ItemID as InquiryItemID,
            irc.NewReferenceID as ReplacementID,
            COALESCE(sr.SupplierID, p.supplier_id) as SupplierID,
            COALESCE(sr.ResponseDate, p.created_at) as ResponseDate,
            ii.HebrewDescription,
            ii.EnglishDescription,
            ii.RequestedQty,
            ii.RetailPrice,
            COALESCE(sr.PriceQuoted, pi.promotion_price) as PriceQuoted,
            COALESCE(sr.Status, 'active') as ResponseStatus,
            sr.SupplierResponseID,
            CASE
                WHEN ii.ItemID IS NULL THEN 'extra'
                WHEN irc.NewReferenceID IS NOT NULL THEN 'replacement'
                WHEN p.id IS NOT NULL THEN 'promotion'
                ELSE 'matched'
            END as ItemStatus,
            CASE
                WHEN p.id IS NOT NULL THEN 1
                ELSE 0
            END as IsPromotion,
            p.name as PromotionName,
            p.start_date as PromotionStartDate,
            p.end_date as PromotionEndDate
        FROM check_tables ct
        CROSS JOIN (SELECT 1) params
        LEFT JOIN SupplierResponse sr ON ct.has_supplier_response = 1
        LEFT JOIN InquiryItems ii ON COALESCE(sr.ItemID, pi.item_id) = ii.ItemID
        LEFT JOIN ItemReferenceChange irc ON sr.ItemID = irc.OriginalItemID 
            AND sr.SupplierID = irc.SupplierID
            AND date(sr.ResponseDate) = date(irc.ChangeDate)
        LEFT JOIN promotion_items pi ON ii.ItemID = pi.item_id
        LEFT JOIN promotions p ON pi.promotion_id = p.id 
            AND p.is_active = 1 
            AND (p.start_date IS NULL OR p.start_date <= datetime('now'))
            AND (p.end_date IS NULL OR p.end_date >= datetime('now'))
        WHERE ct.has_supplier_response = 0 
            OR sr.ItemID IS NOT NULL 
            OR (pi.item_id IS NOT NULL AND p.id IS NOT NULL)
    )`;
}

module.exports = {
    getResponseStatsQuery
};
