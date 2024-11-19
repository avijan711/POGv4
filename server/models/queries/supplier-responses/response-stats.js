function getResponseStatsQuery() {
    return `WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'SupplierResponse'
        ) as has_supplier_response
    ),
    ResponseStats AS (
        -- Get all response items for this supplier and date
        SELECT DISTINCT
            sr.ItemID as ResponseItemID,
            ii.ItemID as InquiryItemID,
            irc.NewReferenceID as ReplacementID,
            sr.SupplierID,
            sr.ResponseDate,
            ii.HebrewDescription,
            ii.EnglishDescription,
            ii.RequestedQty,
            ii.RetailPrice,
            sr.PriceQuoted,
            sr.Status as ResponseStatus,
            sr.SupplierResponseID,
            CASE
                WHEN ii.ItemID IS NULL THEN 'extra'
                WHEN irc.NewReferenceID IS NOT NULL THEN 'replacement'
                ELSE 'matched'
            END as ItemStatus
        FROM check_tables ct
        CROSS JOIN (SELECT 1) params
        LEFT JOIN SupplierResponse sr ON ct.has_supplier_response = 1
        LEFT JOIN InquiryItems ii ON sr.ItemID = ii.ItemID
        LEFT JOIN ItemReferenceChange irc ON sr.ItemID = irc.OriginalItemID 
            AND sr.SupplierID = irc.SupplierID
            AND date(sr.ResponseDate) = date(irc.ChangeDate)
        WHERE ct.has_supplier_response = 0 OR sr.ItemID IS NOT NULL
    )`;
}

module.exports = {
    getResponseStatsQuery
};
