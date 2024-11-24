module.exports = `
    WITH LatestInquiryItems AS (
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
        AND ii.ItemID = ?
        AND i.Date = (
            SELECT MAX(i2.Date)
            FROM InquiryItem ii2
            JOIN Inquiry i2 ON ii2.InquiryID = i2.InquiryID
            WHERE ii2.ItemID = ii.ItemID
            AND i2.Status = 'new'
        )
    ),
    LatestHistory AS (
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
        WHERE ih.ItemID = ?
    ),
    PriceHistoryData AS (
        SELECT
            ih.ItemID,
            ih.Date,
            ih.ILSRetailPrice,
            ih.QtyInStock
        FROM ItemHistory ih
        WHERE ih.ItemID = ?
        ORDER BY ih.Date DESC
    ),
    SupplierResponseData AS (
        SELECT
            sri.ItemID,
            s.Name as supplierName,
            sr.SupplierID as supplierId,
            sri.Price as price,
            sr.ResponseDate as date,
            sr.IsPromotion as isPromotion,
            sr.PromotionName as promotionName,
            sr.Status as status,
            sri.Notes as notes,
            sri.HSCode as hsCode,
            sri.EnglishDescription as englishDescription,
            sri.NewReferenceID as newReferenceID
        FROM SupplierResponse sr
        JOIN Supplier s ON sr.SupplierID = s.SupplierID
        JOIN SupplierResponseItem sri ON sr.SupplierResponseID = sri.SupplierResponseID
        WHERE sri.ItemID = ?
        AND sr.Status = 'active'
        ORDER BY sr.ResponseDate DESC
    ),
    PromotionData AS (
        SELECT
            pi.item_id as ItemID,
            p.id,
            p.name,
            s.Name as supplierName,
            p.supplier_id as supplierId,
            p.start_date as startDate,
            p.end_date as endDate,
            p.is_active as isActive,
            p.created_at as createdAt,
            pi.promotion_price as price
        FROM promotions p
        JOIN promotion_items pi ON p.id = pi.promotion_id
        JOIN Supplier s ON p.supplier_id = s.SupplierID
        WHERE pi.item_id = ?
        AND p.is_active = 1
        ORDER BY p.created_at DESC
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
            li.RetailPrice as RetailPrice,  -- Use InquiryItem's RetailPrice directly
            COALESCE(li.QtyInStock, h.QtyInStock, 0) as QtyInStock,
            COALESCE(li.SoldThisYear, h.QtySoldThisYear, 0) as SoldThisYear,
            COALESCE(li.SoldLastYear, h.QtySoldLastYear, 0) as SoldLastYear,
            COALESCE(li.InquiryDate, h.HistoryDate) as LastUpdated,
            NULL as NewReferenceID,
            NULL as ReferenceNotes
        FROM Item i
        LEFT JOIN LatestHistory h ON i.ItemID = h.ItemID
        LEFT JOIN LatestInquiryItems li ON i.ItemID = li.ItemID
        WHERE i.ItemID = ?
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
        )
        AND OriginalItemID = ?
    ),
    ReferencingItems AS (
        SELECT 
            rc.NewReferenceID as ItemID,
            json_group_array(
                CASE 
                    WHEN rc.OriginalItemID != rc.NewReferenceID THEN
                        json_object(
                            'itemID', rc.OriginalItemID,
                            'hebrewDescription', i.HebrewDescription,
                            'englishDescription', i.EnglishDescription,
                            'changedByUser', rc.ChangedByUser,
                            'changeDate', rc.ChangeDate,
                            'notes', rc.Notes,
                            'supplierName', s.Name,
                            'source', CASE
                                WHEN rc.SupplierID IS NOT NULL THEN 'supplier'
                                WHEN rc.ChangedByUser = 1 THEN 'user'
                                ELSE NULL
                            END
                        )
                    ELSE NULL
                END
            ) as ReferencingItemsArray
        FROM ItemReferenceChange rc
        LEFT JOIN Item i ON rc.OriginalItemID = i.ItemID
        LEFT JOIN Supplier s ON rc.SupplierID = s.SupplierID
        WHERE rc.NewReferenceID = ?
        GROUP BY rc.NewReferenceID
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
            WHEN (rc1.NewReferenceID IS NOT NULL AND rc1.NewReferenceID != i.ItemID) 
                 OR (i.NewReferenceID IS NOT NULL AND i.NewReferenceID != i.ItemID) 
            THEN json_object(
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
        COALESCE(ri.ReferencingItemsArray, '[]') as referencingItems,
        CASE 
            WHEN (rc1.NewReferenceID IS NOT NULL AND rc1.NewReferenceID != i.ItemID) 
                 OR (i.NewReferenceID IS NOT NULL AND i.NewReferenceID != i.ItemID) 
            THEN 1
            ELSE 0
        END as hasReferenceChange,
        CASE 
            WHEN ri.ReferencingItemsArray IS NOT NULL AND ri.ReferencingItemsArray != '[null]' THEN 1
            ELSE 0
        END as isReferencedBy,
        COALESCE(
            json_group_array(
                json_object(
                    'date', ph.Date,
                    'price', ph.ILSRetailPrice,
                    'qtyInStock', ph.QtyInStock,
                    'source', 'history'
                )
            ) FILTER (WHERE ph.ItemID IS NOT NULL),
            '[]'
        ) as priceHistory,
        COALESCE(
            json_group_array(
                json_object(
                    'supplierName', sr.supplierName,
                    'supplierId', sr.supplierId,
                    'price', sr.price,
                    'date', sr.date,
                    'isPromotion', COALESCE(sr.isPromotion, 0),
                    'promotionName', sr.promotionName,
                    'status', sr.status,
                    'notes', sr.notes,
                    'hsCode', sr.hsCode,
                    'englishDescription', sr.englishDescription,
                    'newReferenceID', sr.newReferenceID
                )
            ) FILTER (WHERE sr.ItemID IS NOT NULL),
            '[]'
        ) as supplierPrices,
        COALESCE(
            json_group_array(
                json_object(
                    'id', p.id,
                    'name', p.name,
                    'supplierName', p.supplierName,
                    'supplierId', p.supplierId,
                    'startDate', p.startDate,
                    'endDate', p.endDate,
                    'isActive', p.isActive,
                    'createdAt', p.createdAt,
                    'price', p.price
                )
            ) FILTER (WHERE p.ItemID IS NOT NULL),
            '[]'
        ) as promotions
    FROM BaseItems i
    LEFT JOIN LatestReferenceChanges rc1 ON i.ItemID = rc1.OriginalItemID
    LEFT JOIN ReferencingItems ri ON i.ItemID = ri.ItemID
    LEFT JOIN Supplier s1 ON rc1.SupplierID = s1.SupplierID
    LEFT JOIN PriceHistoryData ph ON i.ItemID = ph.ItemID
    LEFT JOIN SupplierResponseData sr ON i.ItemID = sr.ItemID
    LEFT JOIN PromotionData p ON i.ItemID = p.ItemID`;
