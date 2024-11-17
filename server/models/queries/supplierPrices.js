const getBestSupplierPricesQuery = `
    WITH InquiryItems AS (
        -- Get all items from the inquiry
        SELECT 
            ii.ItemID,
            COALESCE(ii.OriginalItemID, ii.ItemID) as OriginalItemID,
            ii.InquiryItemID,
            ii.RequestedQty,
            ii.HebrewDescription as InquiryDescription,
            i.HebrewDescription as ItemDescription,
            i.EnglishDescription as ItemEnglishDescription
        FROM InquiryItem ii
        JOIN Item i ON ii.ItemID = i.ItemID
        WHERE ii.InquiryID = ?
    ),
    SupplierPrices AS (
        -- Get all supplier prices for inquiry items
        SELECT 
            sp.ItemID,
            sp.SupplierID,
            sp.PriceQuoted,
            sp.ImportMarkup,
            sp.RetailPrice,
            sp.HebrewDescription,
            sp.EnglishDescription,
            s.Name as SupplierName,
            ROW_NUMBER() OVER (
                PARTITION BY sp.ItemID, sp.SupplierID 
                ORDER BY sp.LastUpdated DESC
            ) as rn
        FROM SupplierPrice sp
        JOIN Supplier s ON sp.SupplierID = s.SupplierID
        WHERE EXISTS (
            SELECT 1 
            FROM InquiryItems ii 
            WHERE sp.ItemID = ii.ItemID
            OR sp.ItemID = ii.OriginalItemID
        )
    )
    SELECT 
        ii.ItemID,
        ii.InquiryItemID,
        ii.RequestedQty,
        sp.SupplierID,
        sp.PriceQuoted,
        sp.ImportMarkup,
        sp.RetailPrice,
        COALESCE(sp.HebrewDescription, ii.ItemDescription) as HebrewDescription,
        COALESCE(sp.EnglishDescription, ii.ItemEnglishDescription) as EnglishDescription,
        sp.SupplierName,
        0 as IsPromotion
    FROM InquiryItems ii
    JOIN SupplierPrices sp ON (
        ii.ItemID = sp.ItemID 
        OR ii.OriginalItemID = sp.ItemID
    )
    AND sp.rn = 1
    ORDER BY ii.ItemID, sp.PriceQuoted ASC;
`;

// Debug query to check inquiry items
const debugInquiryItemsQuery = `
    SELECT 
        ii.ItemID,
        ii.OriginalItemID,
        ii.InquiryItemID,
        ii.RequestedQty,
        ii.HebrewDescription as InquiryDescription,
        i.HebrewDescription as ItemDescription
    FROM InquiryItem ii
    JOIN Item i ON ii.ItemID = i.ItemID
    WHERE ii.InquiryID = ?;
`;

// Debug query to check supplier prices
const debugSupplierPricesQuery = `
    SELECT 
        sp.*,
        s.Name as SupplierName,
        i.HebrewDescription as ItemDescription,
        i.EnglishDescription as ItemEnglishDescription
    FROM SupplierPrice sp
    JOIN Supplier s ON sp.SupplierID = s.SupplierID
    JOIN Item i ON sp.ItemID = i.ItemID
    WHERE sp.ItemID = ?
    ORDER BY sp.LastUpdated DESC;
`;

// Debug query to check item references
const debugItemReferencesQuery = `
    SELECT 
        ii.ItemID,
        ii.OriginalItemID,
        sp.ItemID as SupplierPriceItemID,
        sp.PriceQuoted,
        sp.LastUpdated
    FROM InquiryItem ii
    LEFT JOIN SupplierPrice sp ON (
        sp.ItemID = ii.ItemID 
        OR sp.ItemID = ii.OriginalItemID
    )
    WHERE ii.InquiryID = ?;
`;

module.exports = {
    getBestSupplierPricesQuery,
    debugInquiryItemsQuery,
    debugSupplierPricesQuery,
    debugItemReferencesQuery
};
