function getSupplierResponsesQuery() {
    return `
        WITH InquiryItems AS (
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
                CASE
                    WHEN ii.ItemID IS NULL THEN 'extra'
                    WHEN irc.NewReferenceID IS NOT NULL THEN 'replacement'
                    ELSE 'matched'
                END as ItemStatus
            FROM SupplierResponse sr
            LEFT JOIN InquiryItems ii ON sr.ItemID = ii.ItemID
            LEFT JOIN ItemReferenceChange irc ON sr.ItemID = irc.OriginalItemID 
                AND sr.SupplierID = irc.SupplierID
                AND strftime('%Y-%m-%d %H:%M', sr.ResponseDate) = strftime('%Y-%m-%d %H:%M', irc.ChangeDate)
        ),
        SupplierResponses AS (
            -- Get unique supplier responses
            SELECT DISTINCT
                sr.SupplierID,
                sr.ResponseDate,
                s.Name as SupplierName
            FROM SupplierResponse sr
            JOIN Supplier s ON sr.SupplierID = s.SupplierID
            WHERE EXISTS (SELECT 1 FROM InquiryItems ii WHERE ii.ItemID = sr.ItemID)
        ),
        MissingItems AS (
            -- Find items in inquiry that are missing per supplier response
            SELECT 
                sr.SupplierID,
                sr.ResponseDate,
                ii.ItemID,
                ii.HebrewDescription,
                ii.EnglishDescription,
                ii.RequestedQty,
                ii.RetailPrice
            FROM InquiryItems ii
            CROSS JOIN SupplierResponses sr
            LEFT JOIN SupplierResponse resp ON 
                resp.ItemID = ii.ItemID 
                AND resp.SupplierID = sr.SupplierID
                AND strftime('%Y-%m-%d %H:%M', resp.ResponseDate) = strftime('%Y-%m-%d %H:%M', sr.ResponseDate)
            WHERE resp.ItemID IS NULL
        ),
        SupplierActions AS (
            -- Get suppliers with responses (excluding those with promotions)
            SELECT DISTINCT 
                MIN(sr.ResponseDate) as ActionDate,
                sr.SupplierID,
                s.Name as SupplierName,
                COUNT(*) as ItemCount,
                -- Get statistics
                (SELECT COUNT(*) FROM ResponseStats rs2 
                 WHERE rs2.SupplierID = sr.SupplierID 
                 AND strftime('%Y-%m-%d %H:%M', rs2.ResponseDate) = strftime('%Y-%m-%d %H:%M', MIN(sr.ResponseDate))
                 AND rs2.ItemStatus = 'extra') as ExtraItemsCount,
                (SELECT COUNT(*) FROM ResponseStats rs2 
                 WHERE rs2.SupplierID = sr.SupplierID 
                 AND strftime('%Y-%m-%d %H:%M', rs2.ResponseDate) = strftime('%Y-%m-%d %H:%M', MIN(sr.ResponseDate))
                 AND rs2.ItemStatus = 'replacement') as ReplacementsCount,
                (SELECT COUNT(*) FROM MissingItems mi
                 WHERE mi.SupplierID = sr.SupplierID
                 AND strftime('%Y-%m-%d %H:%M', mi.ResponseDate) = strftime('%Y-%m-%d %H:%M', MIN(sr.ResponseDate))
                ) as MissingItemsCount,
                -- Get item details for tooltips
                (SELECT json_group_array(json_object(
                    'itemId', ResponseItemID,
                    'hebrewDescription', HebrewDescription,
                    'englishDescription', EnglishDescription,
                    'requestedQty', RequestedQty,
                    'retailPrice', RetailPrice
                )) 
                FROM ResponseStats rs2 
                WHERE rs2.SupplierID = sr.SupplierID 
                AND strftime('%Y-%m-%d %H:%M', rs2.ResponseDate) = strftime('%Y-%m-%d %H:%M', MIN(sr.ResponseDate))
                AND rs2.ItemStatus = 'extra') as ExtraItems,
                (SELECT json_group_array(json_object(
                    'original', ResponseItemID,
                    'replacement', ReplacementID,
                    'hebrewDescription', HebrewDescription,
                    'englishDescription', EnglishDescription,
                    'requestedQty', RequestedQty,
                    'retailPrice', RetailPrice
                )) 
                FROM ResponseStats rs2 
                WHERE rs2.SupplierID = sr.SupplierID 
                AND strftime('%Y-%m-%d %H:%M', rs2.ResponseDate) = strftime('%Y-%m-%d %H:%M', MIN(sr.ResponseDate))
                AND rs2.ItemStatus = 'replacement') as Replacements,
                (SELECT json_group_array(json_object(
                    'itemId', ItemID,
                    'hebrewDescription', HebrewDescription,
                    'englishDescription', EnglishDescription,
                    'requestedQty', RequestedQty,
                    'retailPrice', RetailPrice
                )) 
                FROM MissingItems mi
                WHERE mi.SupplierID = sr.SupplierID
                AND strftime('%Y-%m-%d %H:%M', mi.ResponseDate) = strftime('%Y-%m-%d %H:%M', MIN(sr.ResponseDate))
                ) as MissingItems,
                'response' as ActionType,
                COALESCE((SELECT GROUP_CONCAT(DISTINCT PromotionName)
                 FROM SupplierResponse sr2
                 WHERE sr2.SupplierID = sr.SupplierID
                 AND sr2.IsPromotion = 1), '') as DebugPromotions
            FROM SupplierResponse sr
            JOIN Supplier s ON sr.SupplierID = s.SupplierID
            JOIN InquiryItems ii ON sr.ItemID = ii.ItemID
            GROUP BY strftime('%Y-%m-%d %H:%M', sr.ResponseDate), sr.SupplierID, s.Name
            
            UNION
            
            -- Get suppliers with reference changes
            SELECT DISTINCT 
                MIN(irc.ChangeDate) as ActionDate,
                irc.SupplierID,
                s.Name as SupplierName,
                COUNT(*) as ItemCount,
                0 as ExtraItemsCount,
                COUNT(*) as ReplacementsCount,
                0 as MissingItemsCount,
                '[]' as ExtraItems,
                json_group_array(json_object(
                    'original', irc.OriginalItemID,
                    'replacement', irc.NewReferenceID,
                    'hebrewDescription', i.HebrewDescription,
                    'englishDescription', i.EnglishDescription,
                    'requestedQty', ii.RequestedQty,
                    'retailPrice', ii.RetailPrice
                )) as Replacements,
                '[]' as MissingItems,
                'reference' as ActionType,
                COALESCE((SELECT GROUP_CONCAT(DISTINCT PromotionName)
                 FROM SupplierResponse sr
                 WHERE sr.SupplierID = irc.SupplierID
                 AND sr.IsPromotion = 1), '') as DebugPromotions
            FROM ItemReferenceChange irc
            JOIN Supplier s ON irc.SupplierID = s.SupplierID
            JOIN InquiryItems ii ON irc.OriginalItemID = ii.ItemID
            JOIN Item i ON irc.OriginalItemID = i.ItemID
            GROUP BY strftime('%Y-%m-%d %H:%M', irc.ChangeDate), irc.SupplierID, s.Name
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
                COALESCE(sr.IsPromotion, 0) as DebugIsPromotion,
                COALESCE(sr.PromotionName, '') as DebugPromotionName
            FROM SupplierActions sa
            JOIN SupplierResponse sr ON 
                strftime('%Y-%m-%d %H:%M', sa.ActionDate) = strftime('%Y-%m-%d %H:%M', sr.ResponseDate) AND 
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
                0 as DebugIsPromotion,
                '' as DebugPromotionName
            FROM SupplierActions sa
            JOIN ItemReferenceChange irc ON 
                strftime('%Y-%m-%d %H:%M', sa.ActionDate) = strftime('%Y-%m-%d %H:%M', irc.ChangeDate) AND 
                sa.SupplierID = irc.SupplierID
            JOIN Item i ON irc.OriginalItemID = i.ItemID
            WHERE sa.ActionType = 'reference'
        ),
        ItemDetails AS (
            SELECT * FROM ResponseItems
            UNION ALL
            SELECT * FROM ReferenceItems
        )
        SELECT 
            sa.ActionDate as date,
            sa.SupplierID as supplierId,
            sa.SupplierName as supplierName,
            sa.ItemCount as itemCount,
            sa.ExtraItemsCount as extraItemsCount,
            sa.ReplacementsCount as replacementsCount,
            sa.MissingItemsCount as missingItemsCount,
            sa.ExtraItems as extraItems,
            sa.Replacements as replacements,
            sa.MissingItems as missingItems,
            COALESCE(sa.DebugPromotions, '') as debugPromotions,
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
            strftime('%Y-%m-%d %H:%M', sa.ActionDate) = strftime('%Y-%m-%d %H:%M', id.ActionDate) AND 
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
