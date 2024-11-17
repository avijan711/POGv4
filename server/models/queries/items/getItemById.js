const getItemByIdQuery = `
    WITH LatestHistory AS (
        SELECT 
            ih.ItemID,
            ih.ILSRetailPrice,
            ih.QtyInStock,
            ih.QtySoldThisYear,
            ih.QtySoldLastYear,
            ih.Date as HistoryDate
        FROM ItemHistory ih
        INNER JOIN (
            SELECT ItemID, MAX(Date) as MaxDate
            FROM ItemHistory
            WHERE ItemID = ?
            GROUP BY ItemID
        ) latest ON ih.ItemID = latest.ItemID AND ih.Date = latest.MaxDate
    ),
    LatestInquiryItems AS (
        SELECT 
            ii.ItemID,
            ii.RetailPrice,
            ii.QtyInStock,
            ii.SoldThisYear,
            ii.SoldLastYear,
            i.Date as InquiryDate,
            ii.NewReferenceID,
            ii.ReferenceNotes
        FROM InquiryItem ii
        JOIN Inquiry i ON ii.InquiryID = i.InquiryID
        WHERE i.Status = 'new'
        AND ii.RetailPrice IS NOT NULL
        AND ii.ItemID = ?
    ),
    ItemData AS (
        SELECT 
            i.ItemID,
            i.HebrewDescription,
            i.EnglishDescription,
            COALESCE(CAST(i.ImportMarkup AS REAL), 1.30) as ImportMarkup,
            i.HSCode,
            i.Image,
            COALESCE(li.RetailPrice, h.ILSRetailPrice) as RetailPrice,
            COALESCE(li.QtyInStock, h.QtyInStock, 0) as QtyInStock,
            COALESCE(li.SoldThisYear, h.QtySoldThisYear, 0) as SoldThisYear,
            COALESCE(li.SoldLastYear, h.QtySoldLastYear, 0) as SoldLastYear,
            COALESCE(li.InquiryDate, h.HistoryDate) as LastUpdated,
            li.NewReferenceID,
            li.ReferenceNotes
        FROM Item i
        LEFT JOIN LatestHistory h ON i.ItemID = h.ItemID
        LEFT JOIN LatestInquiryItems li ON i.ItemID = li.ItemID
        WHERE i.ItemID = ?
        
        UNION ALL
        
        SELECT DISTINCT
            ii.ItemID,
            ii.HebrewDescription,
            ii.EnglishDescription,
            COALESCE(CAST(ii.ImportMarkup AS REAL), 1.30) as ImportMarkup,
            ii.HSCode,
            NULL as Image,
            ii.RetailPrice,
            ii.QtyInStock,
            ii.SoldThisYear,
            ii.SoldLastYear,
            i.Date as LastUpdated,
            ii.NewReferenceID,
            ii.ReferenceNotes
        FROM InquiryItem ii
        JOIN Inquiry i ON ii.InquiryID = i.InquiryID
        WHERE i.Status = 'new'
        AND ii.ItemID = ?
        AND ii.ItemID NOT IN (SELECT ItemID FROM Item)
    ),
    LatestReferenceChanges AS (
        SELECT 
            OriginalItemID,
            NewReferenceID,
            ChangedByUser,
            ChangeDate,
            Notes,
            SupplierID
        FROM ItemReferenceChange irc1
        WHERE ChangeDate = (
            SELECT MAX(ChangeDate)
            FROM ItemReferenceChange irc2
            WHERE (irc2.OriginalItemID = irc1.OriginalItemID
            OR irc2.NewReferenceID = irc1.NewReferenceID)
            AND (irc2.OriginalItemID = ? OR irc2.NewReferenceID = ?)
        )
        AND OriginalItemID != NewReferenceID
    ),
    PriceHistoryData AS (
        SELECT 
            ih.ItemID,
            ih.Date,
            ih.ILSRetailPrice as price,
            ih.QtyInStock,
            ih.QtySoldThisYear as soldThisYear,
            ih.QtySoldLastYear as soldLastYear
        FROM ItemHistory ih
        WHERE ih.ItemID = ?
        ORDER BY ih.Date DESC
    ),
    SupplierPricesData AS (
        SELECT 
            sr.ItemID,
            s.Name as supplierName,
            sr.PriceQuoted as price,
            sr.ResponseDate as date,
            sr.PromotionName as notes
        FROM SupplierResponse sr
        JOIN Supplier s ON sr.SupplierID = s.SupplierID
        WHERE sr.ItemID = ?
        ORDER BY sr.ResponseDate DESC
    ),
    PromotionsData AS (
        SELECT 
            p.ItemID,
            pg.StartDate as startDate,
            pg.EndDate as endDate,
            p.PromoPrice as price,
            pg.Name as notes
        FROM Promotion p
        JOIN PromotionGroup pg ON p.PromotionGroupID = pg.PromotionGroupID
        WHERE p.ItemID = ?
        AND p.IsActive = 1
        AND pg.IsActive = 1
        AND (pg.EndDate IS NULL OR pg.EndDate >= datetime('now'))
        ORDER BY pg.StartDate DESC
    )
    SELECT 
        i.ItemID as itemID,
        i.HebrewDescription as hebrewDescription,
        COALESCE(i.EnglishDescription, '') as englishDescription,
        i.ImportMarkup as importMarkup,
        COALESCE(i.HSCode, '') as hsCode,
        i.Image as image,
        i.RetailPrice as retailPrice,
        i.QtyInStock as qtyInStock,
        i.SoldThisYear as soldThisYear,
        i.SoldLastYear as soldLastYear,
        i.LastUpdated as lastUpdated,
        CASE 
            WHEN rc1.NewReferenceID IS NOT NULL OR i.NewReferenceID IS NOT NULL THEN json_object(
                'newReferenceID', COALESCE(rc1.NewReferenceID, i.NewReferenceID),
                'changedByUser', COALESCE(rc1.ChangedByUser, 1),
                'changeDate', COALESCE(rc1.ChangeDate, i.LastUpdated),
                'notes', COALESCE(rc1.Notes, i.ReferenceNotes),
                'supplierName', s1.Name,
                'source', CASE 
                    WHEN rc1.SupplierID IS NOT NULL THEN 'supplier'
                    WHEN rc1.ChangedByUser = 1 OR i.NewReferenceID IS NOT NULL THEN 'user'
                    ELSE NULL
                END
            )
            ELSE NULL
        END as referenceChange,
        CASE 
            WHEN rc2.OriginalItemID IS NOT NULL THEN json_object(
                'originalItemID', rc2.OriginalItemID,
                'changedByUser', rc2.ChangedByUser,
                'changeDate', rc2.ChangeDate,
                'notes', rc2.Notes,
                'supplierName', s2.Name,
                'source', CASE 
                    WHEN rc2.SupplierID IS NOT NULL THEN 'supplier'
                    WHEN rc2.ChangedByUser = 1 THEN 'user'
                    ELSE NULL
                END
            )
            ELSE NULL
        END as referencedBy,
        COALESCE(
            (
                SELECT json_group_array(
                    json_object(
                        'date', ph.Date,
                        'price', ph.price,
                        'qtyInStock', ph.QtyInStock,
                        'soldThisYear', ph.soldThisYear,
                        'soldLastYear', ph.soldLastYear
                    )
                )
                FROM PriceHistoryData ph
            ),
            '[]'
        ) as priceHistory,
        COALESCE(
            (
                SELECT json_group_array(
                    json_object(
                        'supplierName', sp.supplierName,
                        'price', sp.price,
                        'date', sp.date,
                        'notes', sp.notes
                    )
                )
                FROM SupplierPricesData sp
            ),
            '[]'
        ) as supplierPrices,
        COALESCE(
            (
                SELECT json_group_array(
                    json_object(
                        'startDate', p.startDate,
                        'endDate', p.endDate,
                        'price', p.price,
                        'notes', p.notes
                    )
                )
                FROM PromotionsData p
            ),
            '[]'
        ) as promotions
    FROM ItemData i
    LEFT JOIN LatestReferenceChanges rc1 ON i.ItemID = rc1.OriginalItemID
    LEFT JOIN LatestReferenceChanges rc2 ON i.ItemID = rc2.NewReferenceID
    LEFT JOIN Supplier s1 ON rc1.SupplierID = s1.SupplierID
    LEFT JOIN Supplier s2 ON rc2.SupplierID = s2.SupplierID
`;

module.exports = getItemByIdQuery;
