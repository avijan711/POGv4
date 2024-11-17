const getAllItemsQuery = `
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
            GROUP BY ItemID
        ) latest ON ih.ItemID = latest.ItemID AND ih.Date = latest.MaxDate
    ),
    LatestInquiryItems AS (
        SELECT 
            ii.ItemID,
            ii.HebrewDescription,
            ii.EnglishDescription,
            ii.ImportMarkup,
            ii.HSCode,
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
        AND i.Date = (
            SELECT MAX(i2.Date)
            FROM InquiryItem ii2
            JOIN Inquiry i2 ON ii2.InquiryID = i2.InquiryID
            WHERE ii2.ItemID = ii.ItemID
            AND i2.Status = 'new'
        )
    ),
    BaseItems AS (
        -- Get items from Item table with latest updates
        SELECT 
            i.ItemID,
            COALESCE(li.HebrewDescription, i.HebrewDescription) as HebrewDescription,
            COALESCE(li.EnglishDescription, i.EnglishDescription, '') as EnglishDescription,
            COALESCE(CAST(li.ImportMarkup AS REAL), CAST(i.ImportMarkup AS REAL), 1.30) as ImportMarkup,
            COALESCE(li.HSCode, i.HSCode, '') as HSCode,
            i.Image,
            COALESCE(li.RetailPrice, h.ILSRetailPrice) as RetailPrice,
            COALESCE(li.QtyInStock, h.QtyInStock, 0) as QtyInStock,
            COALESCE(li.SoldThisYear, h.QtySoldThisYear, 0) as SoldThisYear,
            COALESCE(li.SoldLastYear, h.QtySoldLastYear, 0) as SoldLastYear,
            COALESCE(li.InquiryDate, h.HistoryDate) as LastUpdated,
            COALESCE(li.NewReferenceID, NULL) as NewReferenceID,
            COALESCE(li.ReferenceNotes, NULL) as ReferenceNotes
        FROM Item i
        LEFT JOIN LatestHistory h ON i.ItemID = h.ItemID
        LEFT JOIN LatestInquiryItems li ON i.ItemID = li.ItemID

        UNION

        -- Get new items from InquiryItem that don't exist in Item table
        SELECT 
            li.ItemID,
            li.HebrewDescription,
            COALESCE(li.EnglishDescription, '') as EnglishDescription,
            COALESCE(CAST(li.ImportMarkup AS REAL), 1.30) as ImportMarkup,
            COALESCE(li.HSCode, '') as HSCode,
            NULL as Image,
            li.RetailPrice,
            COALESCE(li.QtyInStock, 0) as QtyInStock,
            COALESCE(li.SoldThisYear, 0) as SoldThisYear,
            COALESCE(li.SoldLastYear, 0) as SoldLastYear,
            li.InquiryDate as LastUpdated,
            li.NewReferenceID,
            li.ReferenceNotes
        FROM LatestInquiryItems li
        WHERE li.ItemID NOT IN (SELECT ItemID FROM Item)
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
            WHERE irc2.OriginalItemID = irc1.OriginalItemID
            OR irc2.NewReferenceID = irc1.NewReferenceID
        )
        AND OriginalItemID != NewReferenceID
    )
    SELECT DISTINCT
        i.ItemID as itemID,
        i.HebrewDescription as hebrewDescription,
        i.EnglishDescription as englishDescription,
        i.ImportMarkup as importMarkup,
        i.HSCode as hsCode,
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
        END as referencedBy
    FROM BaseItems i
    LEFT JOIN LatestReferenceChanges rc1 ON i.ItemID = rc1.OriginalItemID
    LEFT JOIN LatestReferenceChanges rc2 ON i.ItemID = rc2.NewReferenceID
    LEFT JOIN Supplier s1 ON rc1.SupplierID = s1.SupplierID
    LEFT JOIN Supplier s2 ON rc2.SupplierID = s2.SupplierID
    ORDER BY i.ItemID
`;

module.exports = getAllItemsQuery;
