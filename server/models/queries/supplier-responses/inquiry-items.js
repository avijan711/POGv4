function getInquiryItemsQuery() {
    return `InquiryItems AS (
        SELECT DISTINCT 
            ii.InquiryItemID,
            ii.ItemID,
            i.HebrewDescription,
            i.EnglishDescription,
            i.ImportMarkup,
            i.HSCode,
            i.QtyInStock,
            ii.RequestedQty,
            ii.RetailPrice,
            p.id as promotion_id,
            p.name as promotion_name,
            pi.promotion_price,
            p.start_date as promotion_start_date,
            p.end_date as promotion_end_date,
            (
                SELECT json_group_array(
                    json_object(
                        'supplierId', sr.SupplierID,
                        'supplierName', s.Name,
                        'priceQuoted', sr.PriceQuoted,
                        'responseDate', sr.ResponseDate,
                        'isPromotion', COALESCE(sr.IsPromotion, 0)
                    )
                )
                FROM SupplierResponse sr
                LEFT JOIN Supplier s ON sr.SupplierID = s.SupplierID
                WHERE sr.ItemID = ii.ItemID
                AND sr.Status != 'deleted'
                ORDER BY sr.ResponseDate DESC
            ) as supplier_prices
        FROM InquiryItem ii
        JOIN Item i ON ii.ItemID = i.ItemID
        LEFT JOIN promotion_items pi ON ii.ItemID = pi.item_id
        LEFT JOIN promotions p ON pi.promotion_id = p.id 
            AND p.is_active = 1 
            AND (p.start_date IS NULL OR p.start_date <= datetime('now'))
            AND (p.end_date IS NULL OR p.end_date >= datetime('now'))
        WHERE ii.InquiryID = ?
        ORDER BY ii.ExcelRowIndex
    )`;
}

module.exports = {
    getInquiryItemsQuery
};
