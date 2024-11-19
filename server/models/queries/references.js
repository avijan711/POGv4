module.exports = `
    WITH RECURSIVE 
    check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'SupplierResponse'
        ) as has_supplier_response
    ),
    InquiryItems AS (
        SELECT DISTINCT 
            ii.ItemID,
            i.HebrewDescription,
            i.EnglishDescription,
            ii.RequestedQty,
            ii.RetailPrice
        FROM InquiryItem ii
        JOIN Item i ON ii.ItemID = i.ItemID
        WHERE ii.InquiryID = ?
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
    ),
    SupplierStats AS (
        -- Calculate statistics per supplier
        SELECT 
            rs.SupplierID,
            rs.ResponseDate,
            COUNT(DISTINCT CASE WHEN rs.ItemStatus = 'extra' THEN rs.ResponseItemID END) as ExtraCount,
            COUNT(DISTINCT CASE WHEN rs.ItemStatus = 'replacement' THEN rs.ResponseItemID END) as ReplacementCount,
            COUNT(DISTINCT rs.ResponseItemID) as TotalCount
        FROM ResponseStats rs
        WHERE rs.ResponseItemID IS NOT NULL
        GROUP BY rs.SupplierID, rs.ResponseDate
    ),
    MissingItems AS (
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
            WHERE ResponseItemID IS NOT NULL
        ) sr
        WHERE NOT EXISTS (
            SELECT 1 
            FROM ResponseStats rs 
            WHERE rs.ResponseItemID = ii.ItemID
            AND rs.SupplierID = sr.SupplierID
            AND date(rs.ResponseDate) = date(sr.ResponseDate)
        )
    )
    SELECT 
        date(rs.ResponseDate) as date,
        rs.SupplierID as supplierId,
        s.Name as supplierName,
        ss.TotalCount as itemCount,
        ss.ExtraCount as extraItemsCount,
        ss.ReplacementCount as replacementsCount,
        (
            SELECT COUNT(DISTINCT ItemID)
            FROM MissingItems mi
            WHERE mi.SupplierID = rs.SupplierID
            AND date(mi.ResponseDate) = date(rs.ResponseDate)
        ) as missingItemsCount,
        (
            SELECT json_group_array(
                json_object(
                    'itemId', ItemID,
                    'hebrewDescription', HebrewDescription,
                    'englishDescription', EnglishDescription,
                    'requestedQty', RequestedQty,
                    'retailPrice', RetailPrice
                )
            )
            FROM (
                SELECT DISTINCT 
                    ItemID,
                    HebrewDescription,
                    EnglishDescription,
                    RequestedQty,
                    RetailPrice
                FROM ResponseStats
                WHERE ItemStatus = 'extra'
                AND SupplierID = rs.SupplierID
                AND date(ResponseDate) = date(rs.ResponseDate)
                LIMIT 100
            )
        ) as extraItems,
        (
            SELECT json_group_array(
                json_object(
                    'original', ResponseItemID,
                    'replacement', ReplacementID,
                    'hebrewDescription', HebrewDescription,
                    'englishDescription', EnglishDescription,
                    'requestedQty', RequestedQty,
                    'retailPrice', RetailPrice
                )
            )
            FROM (
                SELECT DISTINCT 
                    ResponseItemID,
                    ReplacementID,
                    HebrewDescription,
                    EnglishDescription,
                    RequestedQty,
                    RetailPrice
                FROM ResponseStats
                WHERE ItemStatus = 'replacement'
                AND SupplierID = rs.SupplierID
                AND date(ResponseDate) = date(rs.ResponseDate)
            )
        ) as replacements,
        (
            SELECT json_group_array(
                json_object(
                    'itemId', ItemID,
                    'hebrewDescription', HebrewDescription,
                    'englishDescription', EnglishDescription,
                    'requestedQty', RequestedQty,
                    'retailPrice', RetailPrice
                )
            )
            FROM (
                SELECT DISTINCT 
                    ItemID,
                    HebrewDescription,
                    EnglishDescription,
                    RequestedQty,
                    RetailPrice
                FROM MissingItems mi
                WHERE mi.SupplierID = rs.SupplierID
                AND date(mi.ResponseDate) = date(rs.ResponseDate)
            )
        ) as missingItems,
        COALESCE(
            (
                SELECT GROUP_CONCAT(DISTINCT PromotionName)
                FROM check_tables ct
                LEFT JOIN SupplierResponse sr2 ON ct.has_supplier_response = 1
                WHERE ct.has_supplier_response = 1
                AND sr2.SupplierID = rs.SupplierID
                AND sr2.IsPromotion = 1
                AND date(sr2.ResponseDate) = date(rs.ResponseDate)
            ),
            ''
        ) as debugPromotions,
        (
            SELECT json_group_array(
                json_object(
                    'itemId', ResponseItemID,
                    'priceQuoted', PriceQuoted,
                    'status', COALESCE(ResponseStatus, ''),
                    'responseId', SupplierResponseID,
                    'hebrewDescription', HebrewDescription,
                    'englishDescription', EnglishDescription,
                    'itemType', ItemStatus,
                    'itemKey', CASE 
                        WHEN ItemStatus = 'replacement' 
                        THEN 'ref-' || ResponseItemID || '-' || ReplacementID
                        ELSE 'resp-' || ResponseItemID
                    END
                )
            )
            FROM (
                SELECT DISTINCT 
                    ResponseItemID,
                    PriceQuoted,
                    ResponseStatus,
                    SupplierResponseID,
                    HebrewDescription,
                    EnglishDescription,
                    ItemStatus,
                    ReplacementID
                FROM ResponseStats
                WHERE SupplierID = rs.SupplierID
                AND date(ResponseDate) = date(rs.ResponseDate)
                AND ResponseItemID IS NOT NULL
            )
        ) as items
    FROM ResponseStats rs
    JOIN Supplier s ON rs.SupplierID = s.SupplierID
    JOIN SupplierStats ss ON rs.SupplierID = ss.SupplierID 
        AND date(rs.ResponseDate) = date(ss.ResponseDate)
    WHERE rs.ResponseItemID IS NOT NULL
    GROUP BY date(rs.ResponseDate), rs.SupplierID, s.Name
    ORDER BY rs.ResponseDate DESC`;
