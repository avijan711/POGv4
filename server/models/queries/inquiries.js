function getInquiriesQuery(status) {
    return `
        WITH InquiryStats AS (
            SELECT 
                i.InquiryID,
                COUNT(DISTINCT ii.InquiryItemID) as itemCount,
                COUNT(DISTINCT sr.SupplierID) as respondedSuppliersCount,
                SUM(CASE WHEN sr.SupplierResponseID IS NULL THEN 1 ELSE 0 END) as notRespondedItemsCount,
                COUNT(DISTINCT irc.ChangeID) as totalReplacementsCount
            FROM Inquiry i
            LEFT JOIN InquiryItem ii ON i.InquiryID = ii.InquiryID
            LEFT JOIN SupplierResponse sr ON sr.InquiryID = i.InquiryID AND sr.Status != 'pending'
            LEFT JOIN ItemReferenceChange irc ON irc.OriginalItemID = ii.ItemID
            GROUP BY i.InquiryID
        )
        SELECT 
            i.InquiryID as inquiryID,
            i.InquiryNumber as customNumber,
            i.CreatedDate as date,
            COALESCE(i.Status, 'new') as status,
            COALESCE(s.itemCount, 0) as itemCount,
            COALESCE(s.respondedSuppliersCount, 0) as respondedSuppliersCount,
            COALESCE(s.notRespondedItemsCount, 0) as notRespondedItemsCount,
            COALESCE(s.totalReplacementsCount, 0) as totalReplacementsCount
        FROM Inquiry i
        LEFT JOIN InquiryStats s ON i.InquiryID = s.InquiryID
        ${status ? 'WHERE i.Status = ?' : ''}
        ORDER BY i.CreatedDate DESC`;
}

function getInquiryByIdQuery() {
    return `
        WITH InquiryData AS (
            SELECT 
                i.InquiryID as inquiryID,
                i.InquiryNumber as customNumber,
                i.CreatedDate as date,
                COALESCE(i.Status, 'new') as status
            FROM Inquiry i
            WHERE i.InquiryID = ?
        ),
        ReferenceChanges AS (
            -- Get all reference changes where inquiry items are either original or new reference
            SELECT 
                irc.OriginalItemID,
                irc.ChangeID,
                irc.NewReferenceID,
                irc.Notes,
                s.Name as SupplierName,
                irc.ChangeDate,
                'supplier' as source,
                ii.InquiryID
            FROM ItemReferenceChange irc
            LEFT JOIN SupplierResponse sr ON irc.SupplierID = sr.SupplierID
            LEFT JOIN Supplier s ON irc.SupplierID = s.SupplierID
            JOIN InquiryItem ii ON (
                ii.ItemID = irc.OriginalItemID OR 
                ii.ItemID = irc.NewReferenceID OR
                ii.OriginalItemID = irc.OriginalItemID OR
                ii.OriginalItemID = irc.NewReferenceID
            )
            WHERE ii.InquiryID = ?
        ),
        SupplierResponses AS (
            SELECT 
                sr.ItemID,
                json_group_array(
                    json_object(
                        'responseId', sr.SupplierResponseID,
                        'supplierId', sr.SupplierID,
                        'supplierName', s.Name,
                        'date', sr.ResponseDate,
                        'priceQuoted', COALESCE(sr.PriceQuoted, 0),
                        'status', sr.Status,
                        'notes', sri.Notes,
                        'hsCode', sri.HSCode,
                        'englishDescription', sri.EnglishDescription,
                        'newReferenceID', sri.NewReferenceID
                    )
                ) as responses
            FROM SupplierResponse sr
            JOIN Supplier s ON sr.SupplierID = s.SupplierID
            JOIN SupplierResponseItem sri ON sr.SupplierResponseID = sri.SupplierResponseID
            WHERE sr.InquiryID = ?
            GROUP BY sr.ItemID
        ),
        ItemsData AS (
            SELECT 
                ii.InquiryItemID as inquiryItemID,
                ii.ItemID as itemID,
                ii.OriginalItemID as originalItemID,
                ii.HebrewDescription as hebrewDescription,
                COALESCE(ii.EnglishDescription, '') as englishDescription,
                COALESCE(CAST(ii.ImportMarkup AS REAL), 1.30) as importMarkup,
                COALESCE(ii.HSCode, '') as hsCode,
                COALESCE(ii.QtyInStock, 0) as qtyInStock,
                COALESCE(ii.SoldThisYear, 0) as soldThisYear,
                COALESCE(ii.SoldLastYear, 0) as soldLastYear,
                ii.RetailPrice as retailPrice,
                COALESCE(ii.RequestedQty, 0) as requestedQty,
                ii.NewReferenceID as newReferenceID,
                ii.ReferenceNotes as referenceNotes,
                CASE 
                    WHEN ii.NewReferenceID IS NOT NULL THEN 1
                    WHEN EXISTS (
                        SELECT 1 FROM ReferenceChanges rc 
                        WHERE rc.OriginalItemID = ii.ItemID OR rc.OriginalItemID = ii.OriginalItemID
                    ) THEN 1 
                    ELSE 0 
                END as hasReferenceChange,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM ReferenceChanges rc 
                        WHERE rc.NewReferenceID = ii.ItemID OR rc.NewReferenceID = ii.OriginalItemID
                    ) THEN 1 
                    ELSE 0 
                END as isReferencedBy,
                CASE
                    WHEN ii.NewReferenceID IS NOT NULL THEN json_object(
                        'newReferenceID', ii.NewReferenceID,
                        'source', 'inquiry_item',
                        'notes', COALESCE(ii.ReferenceNotes, '')
                    )
                    ELSE (
                        SELECT json_object(
                            'changeId', rc.ChangeID,
                            'newReferenceID', rc.NewReferenceID,
                            'source', rc.source,
                            'supplierName', COALESCE(rc.SupplierName, ''),
                            'notes', COALESCE(rc.Notes, '')
                        )
                        FROM ReferenceChanges rc
                        WHERE rc.OriginalItemID = ii.ItemID OR rc.OriginalItemID = ii.OriginalItemID
                        ORDER BY rc.ChangeDate DESC
                        LIMIT 1
                    )
                END as referenceChange,
                COALESCE(
                    (
                        SELECT json_group_array(
                            json_object(
                                'itemID', rc.OriginalItemID,
                                'referenceChange', json_object(
                                    'changeId', rc.ChangeID,
                                    'source', rc.source,
                                    'supplierName', COALESCE(rc.SupplierName, ''),
                                    'notes', COALESCE(rc.Notes, '')
                                )
                            )
                        )
                        FROM ReferenceChanges rc
                        WHERE rc.NewReferenceID = ii.ItemID OR rc.NewReferenceID = ii.OriginalItemID
                    ),
                    '[]'
                ) as referencingItems,
                COALESCE(sr.responses, '[]') as supplierResponses
            FROM InquiryItem ii
            LEFT JOIN SupplierResponses sr ON ii.ItemID = sr.ItemID
            WHERE ii.InquiryID = ?
        )
        SELECT 
            json_object(
                'inquiryID', id.inquiryID,
                'customNumber', id.customNumber,
                'date', id.date,
                'status', id.status
            ) as inquiry,
            COALESCE(
                json_group_array(
                    json_object(
                        'inquiryItemID', itd.inquiryItemID,
                        'itemID', itd.itemID,
                        'originalItemID', itd.originalItemID,
                        'hebrewDescription', itd.hebrewDescription,
                        'englishDescription', itd.englishDescription,
                        'importMarkup', itd.importMarkup,
                        'hsCode', itd.hsCode,
                        'qtyInStock', itd.qtyInStock,
                        'soldThisYear', itd.soldThisYear,
                        'soldLastYear', itd.soldLastYear,
                        'retailPrice', itd.retailPrice,
                        'requestedQty', itd.requestedQty,
                        'newReferenceID', itd.newReferenceID,
                        'referenceNotes', COALESCE(itd.referenceNotes, ''),
                        'hasReferenceChange', itd.hasReferenceChange,
                        'isReferencedBy', itd.isReferencedBy,
                        'referenceChange', COALESCE(itd.referenceChange, 'null'),
                        'referencingItems', COALESCE(itd.referencingItems, '[]'),
                        'supplierResponses', json(itd.supplierResponses)
                    )
                ),
                '[]'
            ) as items
        FROM InquiryData id
        LEFT JOIN ItemsData itd ON 1=1
        GROUP BY id.inquiryID`;
}

module.exports = {
    getInquiriesQuery,
    getInquiryByIdQuery
};
