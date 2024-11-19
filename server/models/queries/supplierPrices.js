const getBestSupplierPricesQuery = `
    WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'SupplierPrice'
        ) as has_supplier_price
    ),
    InquiryItems AS (
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
        FROM check_tables ct
        CROSS JOIN (SELECT 1) params
        LEFT JOIN SupplierPrice sp ON ct.has_supplier_price = 1
        LEFT JOIN Supplier s ON sp.SupplierID = s.SupplierID
        WHERE ct.has_supplier_price = 0 OR EXISTS (
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
    LEFT JOIN SupplierPrices sp ON (
        ii.ItemID = sp.ItemID 
        OR ii.OriginalItemID = sp.ItemID
    )
    AND sp.rn = 1
    WHERE sp.ItemID IS NOT NULL
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
    WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'SupplierPrice'
        ) as has_supplier_price
    )
    SELECT 
        sp.*,
        s.Name as SupplierName,
        i.HebrewDescription as ItemDescription,
        i.EnglishDescription as ItemEnglishDescription
    FROM check_tables ct
    CROSS JOIN (SELECT ? as item_id) params
    LEFT JOIN SupplierPrice sp ON ct.has_supplier_price = 1
    LEFT JOIN Supplier s ON sp.SupplierID = s.SupplierID
    LEFT JOIN Item i ON sp.ItemID = i.ItemID
    WHERE ct.has_supplier_price = 0 OR sp.ItemID = params.item_id
    ORDER BY sp.LastUpdated DESC;
`;

// Debug query to check item references
const debugItemReferencesQuery = `
    WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'SupplierPrice'
        ) as has_supplier_price
    )
    SELECT 
        ii.ItemID,
        ii.OriginalItemID,
        sp.ItemID as SupplierPriceItemID,
        sp.PriceQuoted,
        sp.LastUpdated
    FROM InquiryItem ii
    CROSS JOIN check_tables ct
    LEFT JOIN SupplierPrice sp ON ct.has_supplier_price = 1 AND (
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
