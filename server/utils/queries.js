function getSupplierResponsesQuery() {
    return `
        WITH InquiryItems AS (
            SELECT DISTINCT ItemID
            FROM InquiryItem
            WHERE InquiryID = ?
        ),
        -- Debug: Show all supplier responses with promotion flag
        DebugPromotions AS (
            SELECT 
                sr.SupplierID,
                s.Name as SupplierName,
                sr.ItemID,
                sr.IsPromotion,
                sr.PromotionName,
                sr.ResponseDate
            FROM SupplierResponse sr
            JOIN Supplier s ON sr.SupplierID = s.SupplierID
            WHERE sr.IsPromotion = 1
        ),
        -- Debug: Show inquiry items with their promotions
        DebugInquiryPromotions AS (
            SELECT 
                ii.ItemID,
                dp.SupplierID,
                dp.SupplierName,
                COALESCE(dp.IsPromotion, 0) as IsPromotion,
                COALESCE(dp.PromotionName, '') as PromotionName
            FROM InquiryItems ii
            LEFT JOIN DebugPromotions dp ON ii.ItemID = dp.ItemID
        ),
        SupplierActions AS (
            -- Get suppliers with responses (excluding those with promotions)
            SELECT DISTINCT 
                sr.ResponseDate as ActionDate,
                sr.SupplierID,
                s.Name as SupplierName,
                COUNT(*) as ItemCount,
                'response' as ActionType,
                -- Debug: Add promotion info
                COALESCE((SELECT GROUP_CONCAT(DISTINCT PromotionName)
                 FROM SupplierResponse sr2
                 WHERE sr2.SupplierID = sr.SupplierID
                 AND sr2.IsPromotion = 1), '') as DebugPromotions
            FROM SupplierResponse sr
            JOIN Supplier s ON sr.SupplierID = s.SupplierID
            JOIN InquiryItems ii ON sr.ItemID = ii.ItemID
            GROUP BY sr.ResponseDate, sr.SupplierID, s.Name
            
            UNION
            
            -- Get suppliers with reference changes
            SELECT DISTINCT 
                irc.ChangeDate as ActionDate,
                irc.SupplierID,
                s.Name as SupplierName,
                COUNT(*) as ItemCount,
                'reference' as ActionType,
                -- Debug: Add promotion info
                COALESCE((SELECT GROUP_CONCAT(DISTINCT PromotionName)
                 FROM SupplierResponse sr
                 WHERE sr.SupplierID = irc.SupplierID
                 AND sr.IsPromotion = 1), '') as DebugPromotions
            FROM ItemReferenceChange irc
            JOIN Supplier s ON irc.SupplierID = s.SupplierID
            JOIN InquiryItems ii ON irc.OriginalItemID = ii.ItemID
            GROUP BY irc.ChangeDate, irc.SupplierID, s.Name
        ),
        ResponseItems AS (
            -- Get items from responses
            SELECT 
                i.ItemID,
                COALESCE(i.HebrewDescription, '') as HebrewDescription,
                COALESCE(i.EnglishDescription, '') as EnglishDescription,
                sa.ActionDate,
                sa.SupplierID,
                sr.PriceQuoted,
                COALESCE(sr.Status, '') as ResponseStatus,
                sr.SupplierResponseID,
                NULL as ChangeID,
                NULL as NewReferenceID,
                NULL as Notes,
                COALESCE(sr.Status, '') as Status,
                'response' as ItemType,
                sr.SupplierResponseID as ItemKey,
                -- Debug: Add promotion info
                COALESCE(sr.IsPromotion, 0) as DebugIsPromotion,
                COALESCE(sr.PromotionName, '') as DebugPromotionName
            FROM SupplierActions sa
            JOIN SupplierResponse sr ON 
                strftime('%Y-%m-%d %H:%M:%S', sa.ActionDate) = strftime('%Y-%m-%d %H:%M:%S', sr.ResponseDate) AND 
                sa.SupplierID = sr.SupplierID
            JOIN Item i ON sr.ItemID = i.ItemID
            WHERE sa.ActionType = 'response'
        ),
        ReferenceItems AS (
            -- Get items from reference changes
            SELECT 
                i.ItemID,
                COALESCE(i.HebrewDescription, '') as HebrewDescription,
                COALESCE(i.EnglishDescription, '') as EnglishDescription,
                sa.ActionDate,
                sa.SupplierID,
                NULL as PriceQuoted,
                NULL as ResponseStatus,
                NULL as SupplierResponseID,
                irc.ChangeID,
                irc.NewReferenceID,
                COALESCE(irc.Notes, '') as Notes,
                CASE 
                    WHEN irc.OriginalItemID = irc.NewReferenceID THEN 'No Change'
                    ELSE 'Reference Changed'
                END as Status,
                'reference' as ItemType,
                irc.ChangeID as ItemKey,
                -- Debug: Add empty promotion fields for union
                0 as DebugIsPromotion,
                '' as DebugPromotionName
            FROM SupplierActions sa
            JOIN ItemReferenceChange irc ON 
                strftime('%Y-%m-%d %H:%M:%S', sa.ActionDate) = strftime('%Y-%m-%d %H:%M:%S', irc.ChangeDate) AND 
                sa.SupplierID = irc.SupplierID
            JOIN Item i ON irc.OriginalItemID = i.ItemID
            WHERE sa.ActionType = 'reference'
        ),
        ItemDetails AS (
            SELECT * FROM ResponseItems
            UNION ALL
            SELECT * FROM ReferenceItems
        ),
        -- Debug: Final check of suppliers with promotions
        DebugFinalPromotions AS (
            SELECT DISTINCT
                s.SupplierID,
                s.Name as SupplierName,
                COUNT(DISTINCT CASE WHEN sr.IsPromotion = 1 THEN sr.ItemID END) as PromotionItemCount,
                COALESCE(GROUP_CONCAT(DISTINCT sr.PromotionName), '') as PromotionNames
            FROM Supplier s
            LEFT JOIN SupplierResponse sr ON s.SupplierID = sr.SupplierID
            WHERE sr.IsPromotion = 1
            GROUP BY s.SupplierID, s.Name
        )
        SELECT 
            sa.ActionDate as date,
            sa.SupplierID as supplierId,
            sa.SupplierName as supplierName,
            sa.ItemCount as itemCount,
            -- Debug: Add promotion info to output
            COALESCE(sa.DebugPromotions, '') as debugPromotions,
            COALESCE((SELECT json_group_array(json_object(
                'supplierId', SupplierID,
                'supplierName', COALESCE(SupplierName, ''),
                'promotionItemCount', COALESCE(PromotionItemCount, 0),
                'promotionNames', COALESCE(PromotionNames, '')
            )) FROM DebugFinalPromotions), '[]') as debugFinalPromotions,
            COALESCE((SELECT json_group_array(json_object(
                'itemId', COALESCE(ItemID, ''),
                'supplierName', COALESCE(SupplierName, ''),
                'isPromotion', COALESCE(IsPromotion, 0),
                'promotionName', COALESCE(PromotionName, '')
            )) FROM DebugInquiryPromotions), '[]') as debugInquiryPromotions,
            COALESCE(json_group_array(
                json_object(
                    'itemId', COALESCE(id.ItemID, ''),
                    'priceQuoted', id.PriceQuoted,
                    'status', COALESCE(id.Status, ''),
                    'responseId', id.SupplierResponseID,
                    'hebrewDescription', COALESCE(id.HebrewDescription, ''),
                    'englishDescription', COALESCE(id.EnglishDescription, ''),
                    'itemType', COALESCE(id.ItemType, ''),
                    'itemKey', id.ItemKey,
                    'debugIsPromotion', COALESCE(id.DebugIsPromotion, 0),
                    'debugPromotionName', COALESCE(id.DebugPromotionName, ''),
                    'referenceChange', CASE 
                        WHEN id.NewReferenceID IS NOT NULL THEN
                            json_object(
                                'changeId', id.ChangeID,
                                'newReferenceID', COALESCE(id.NewReferenceID, ''),
                                'notes', COALESCE(id.Notes, '')
                            )
                        ELSE NULL
                    END
                )
            ), '[]') as items
        FROM SupplierActions sa
        LEFT JOIN ItemDetails id ON 
            strftime('%Y-%m-%d %H:%M:%S', sa.ActionDate) = strftime('%Y-%m-%d %H:%M:%S', id.ActionDate) AND 
            sa.SupplierID = id.SupplierID
        GROUP BY sa.ActionDate, sa.SupplierID, sa.SupplierName
        ORDER BY sa.ActionDate DESC`;
}

function getReferenceChangesQuery() {
    return `
        SELECT 
            irc.ChangeID as changeId,
            irc.OriginalItemID,
            irc.NewReferenceID,
            irc.ChangeDate,
            COALESCE(irc.Notes, '') as Notes,
            COALESCE(s.Name, '') as SupplierName,
            COALESCE(i.HebrewDescription, '') as HebrewDescription,
            COALESCE(i.EnglishDescription, '') as EnglishDescription
        FROM ItemReferenceChange irc
        JOIN Supplier s ON irc.SupplierID = s.SupplierID
        JOIN Item i ON irc.OriginalItemID = i.ItemID
        ORDER BY irc.ChangeDate DESC`;
}

function getSupplierResponsesStatsQuery() {
    return `
        SELECT 
            COALESCE(s.Name, '') as SupplierName,
            sr.ResponseDate,
            COUNT(*) as ResponseCount
        FROM SupplierResponse sr
        JOIN Supplier s ON sr.SupplierID = s.SupplierID
        GROUP BY s.Name, sr.ResponseDate
        ORDER BY sr.ResponseDate DESC`;
}

function getSelfReferencesQuery() {
    return `
        SELECT 
            irc.ChangeID as changeId,
            irc.OriginalItemID,
            irc.NewReferenceID,
            irc.ChangeDate,
            COALESCE(irc.Notes, '') as Notes,
            COALESCE(s.Name, '') as SupplierName
        FROM ItemReferenceChange irc
        JOIN Supplier s ON irc.SupplierID = s.SupplierID
        WHERE irc.OriginalItemID = irc.NewReferenceID`;
}

module.exports = {
    getSupplierResponsesQuery,
    getReferenceChangesQuery,
    getSupplierResponsesStatsQuery,
    getSelfReferencesQuery
};
