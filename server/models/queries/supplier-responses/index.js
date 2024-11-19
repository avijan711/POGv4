const { getInquiryItemsQuery } = require('./inquiry-items');
const { getResponseStatsQuery } = require('./response-stats');
const { getSupplierStatsQuery } = require('./supplier-stats');
const { getMissingItemsQuery } = require('./missing-items');
const { getMainQuery } = require('./main-query');

function getSupplierResponsesQuery() {
    return `
        WITH RECURSIVE 
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
            FROM SupplierResponse sr
            LEFT JOIN InquiryItems ii ON sr.ItemID = ii.ItemID
            LEFT JOIN ItemReferenceChange irc ON sr.ItemID = irc.OriginalItemID 
                AND sr.SupplierID = irc.SupplierID
                AND date(sr.ResponseDate) = date(irc.ChangeDate)
        ),
        SupplierStats AS (
            SELECT 
                rs.SupplierID,
                date(rs.ResponseDate) as ResponseDate,
                COUNT(DISTINCT CASE WHEN rs.ItemStatus = 'extra' THEN rs.ResponseItemID END) as ExtraCount,
                COUNT(DISTINCT CASE WHEN rs.ItemStatus = 'replacement' THEN rs.ResponseItemID END) as ReplacementCount,
                COUNT(DISTINCT rs.ResponseItemID) as TotalCount
            FROM ResponseStats rs
            GROUP BY rs.SupplierID, date(rs.ResponseDate)
        ),
        MissingItems AS (
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
            json_group_array(
                json_object(
                    'itemId', rs.ResponseItemID,
                    'hebrewDescription', COALESCE(rs.HebrewDescription, ''),
                    'englishDescription', COALESCE(rs.EnglishDescription, ''),
                    'requestedQty', COALESCE(rs.RequestedQty, ''),
                    'retailPrice', COALESCE(rs.RetailPrice, '')
                )
            ) FILTER (WHERE rs.ItemStatus = 'extra') as extraItems,
            json_group_array(
                json_object(
                    'original', rs.ResponseItemID,
                    'replacement', rs.ReplacementID,
                    'hebrewDescription', COALESCE(rs.HebrewDescription, ''),
                    'englishDescription', COALESCE(rs.EnglishDescription, ''),
                    'requestedQty', COALESCE(rs.RequestedQty, ''),
                    'retailPrice', COALESCE(rs.RetailPrice, '')
                )
            ) FILTER (WHERE rs.ItemStatus = 'replacement') as replacements,
            json_group_array(
                json_object(
                    'itemId', rs.ResponseItemID,
                    'hebrewDescription', COALESCE(rs.HebrewDescription, ''),
                    'englishDescription', COALESCE(rs.EnglishDescription, ''),
                    'requestedQty', COALESCE(rs.RequestedQty, ''),
                    'retailPrice', COALESCE(rs.RetailPrice, '')
                )
            ) FILTER (WHERE EXISTS (
                SELECT 1 FROM MissingItems mi 
                WHERE mi.ItemID = rs.ResponseItemID
                AND mi.SupplierID = rs.SupplierID
                AND date(mi.ResponseDate) = date(rs.ResponseDate)
            )) as missingItems,
            json_group_array(
                CASE WHEN sr2.IsPromotion = 1 
                THEN sr2.PromotionName 
                ELSE NULL END
            ) as debugPromotions,
            json_group_array(
                json_object(
                    'itemId', rs.ResponseItemID,
                    'priceQuoted', COALESCE(rs.PriceQuoted, ''),
                    'status', COALESCE(rs.ResponseStatus, ''),
                    'responseId', rs.SupplierResponseID,
                    'hebrewDescription', COALESCE(rs.HebrewDescription, ''),
                    'englishDescription', COALESCE(rs.EnglishDescription, ''),
                    'itemType', rs.ItemStatus,
                    'itemKey', CASE 
                        WHEN rs.ItemStatus = 'replacement' 
                        THEN 'ref-' || rs.ResponseItemID || '-' || rs.ReplacementID
                        ELSE 'resp-' || rs.ResponseItemID
                    END
                )
            ) as items
        FROM ResponseStats rs
        JOIN Supplier s ON rs.SupplierID = s.SupplierID
        JOIN SupplierStats ss ON rs.SupplierID = ss.SupplierID 
            AND date(rs.ResponseDate) = ss.ResponseDate
        LEFT JOIN SupplierResponse sr2 ON rs.SupplierID = sr2.SupplierID 
            AND date(rs.ResponseDate) = date(sr2.ResponseDate)
        GROUP BY date(rs.ResponseDate), rs.SupplierID, s.Name
        ORDER BY rs.ResponseDate DESC`;
}

module.exports = {
    getSupplierResponsesQuery
};
