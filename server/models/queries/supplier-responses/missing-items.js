function getMissingItemsQuery() {
    return `MissingItems AS (
        -- Find missing items efficiently
        SELECT DISTINCT
            sr.SupplierID,
            sr.ResponseDate,
            ii.ItemID,
            ii.HebrewDescription,
            ii.EnglishDescription,
            ii.RequestedQty,
            ii.RetailPrice
        FROM InquiryItems ii
        CROSS JOIN (
            SELECT DISTINCT SupplierID, ResponseDate 
            FROM ResponseStats
        ) sr
        WHERE NOT EXISTS (
            SELECT 1 
            FROM ResponseStats rs 
            WHERE rs.ResponseItemID = ii.ItemID
            AND rs.SupplierID = sr.SupplierID
            AND date(rs.ResponseDate) = date(sr.ResponseDate)
        )
    )`;
}

module.exports = {
    getMissingItemsQuery
};
