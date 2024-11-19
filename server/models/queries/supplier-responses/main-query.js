function getMainQuery() {
    // Base query for supplier responses with pagination and improved error handling
    return `
    WITH RECURSIVE check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'SupplierResponse'
        ) as has_supplier_response
    ),
    supplier_responses AS (
        SELECT DISTINCT
            sr.SupplierID,
            COALESCE(s.Name, 'Unknown Supplier') as supplier_name,
            date(sr.ResponseDate) as response_date,
            sr.ItemID,
            sr.SupplierResponseID,
            sr.PriceQuoted,
            sr.Status,
            COALESCE(sr.IsPromotion, 0) as IsPromotion,
            sr.PromotionName,
            COALESCE(i.HebrewDescription, '') as HebrewDescription,
            COALESCE(i.EnglishDescription, '') as EnglishDescription,
            COALESCE(ii.RequestedQty, 0) as RequestedQty,
            COALESCE(ii.RetailPrice, 0) as RetailPrice,
            CASE 
                WHEN irc.NewReferenceID IS NOT NULL THEN 'replacement'
                WHEN COALESCE(sr.IsPromotion, 0) = 1 THEN 'promotion'
                ELSE 'regular'
            END as item_type,
            irc.NewReferenceID
        FROM check_tables ct
        CROSS JOIN (SELECT ? as inquiry_id) params
        LEFT JOIN SupplierResponse sr ON ct.has_supplier_response = 1
        LEFT JOIN Supplier s ON sr.SupplierID = s.SupplierID
        LEFT JOIN InquiryItem ii ON sr.ItemID = ii.ItemID AND ii.InquiryID = params.inquiry_id
        LEFT JOIN Item i ON sr.ItemID = i.ItemID
        LEFT JOIN ItemReferenceChange irc ON sr.ItemID = irc.OriginalItemID 
            AND sr.SupplierID = irc.SupplierID
            AND date(sr.ResponseDate) = date(irc.ChangeDate)
        WHERE (ct.has_supplier_response = 0) OR (ii.InquiryID IS NOT NULL)
        ORDER BY sr.ResponseDate DESC, sr.SupplierID
        LIMIT ? OFFSET ?
    ),
    response_summary AS (
        SELECT 
            SupplierID,
            supplier_name,
            response_date,
            COUNT(DISTINCT ItemID) as item_count,
            SUM(CASE WHEN IsPromotion = 1 THEN 1 ELSE 0 END) as promotion_count,
            SUM(CASE WHEN item_type = 'replacement' THEN 1 ELSE 0 END) as replacement_count,
            GROUP_CONCAT(DISTINCT COALESCE(PromotionName, '')) as promotions
        FROM supplier_responses
        WHERE ItemID IS NOT NULL
        GROUP BY SupplierID, supplier_name, response_date
    )
    SELECT 
        rs.response_date as date,
        rs.SupplierID as supplierId,
        rs.supplier_name as supplierName,
        COALESCE(rs.item_count, 0) as itemCount,
        COALESCE(rs.promotion_count, 0) as extraItemsCount,
        COALESCE(rs.replacement_count, 0) as replacementsCount,
        rs.promotions as debugPromotions,
        COALESCE(
            json_group_array(
                CASE WHEN sr.ItemID IS NOT NULL THEN
                    json_object(
                        'itemId', sr.ItemID,
                        'priceQuoted', COALESCE(sr.PriceQuoted, 0),
                        'status', COALESCE(sr.Status, 'pending'),
                        'responseId', sr.SupplierResponseID,
                        'hebrewDescription', COALESCE(sr.HebrewDescription, ''),
                        'englishDescription', COALESCE(sr.EnglishDescription, ''),
                        'itemType', sr.item_type,
                        'itemKey', CASE 
                            WHEN sr.item_type = 'replacement' 
                            THEN 'ref-' || sr.ItemID || '-' || sr.NewReferenceID
                            ELSE 'resp-' || sr.ItemID
                        END
                    )
                ELSE NULL
                END
            ) FILTER (WHERE sr.ItemID IS NOT NULL),
            '[]'
        ) as items
    FROM response_summary rs
    LEFT JOIN supplier_responses sr 
        ON rs.SupplierID = sr.SupplierID 
        AND rs.response_date = sr.response_date
    GROUP BY 
        rs.response_date,
        rs.SupplierID,
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
