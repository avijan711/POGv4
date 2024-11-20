module.exports = `
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
        WHERE ih.ItemID = ?
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
        AND ii.ItemID = ?
        AND i.Date = (
            SELECT MAX(i2.Date)
            FROM InquiryItem ii2
            JOIN Inquiry i2 ON ii2.InquiryID = i2.InquiryID
            WHERE ii2.ItemID = ii.ItemID
            AND i2.Status = 'new'
        )
    ),
    PriceHistory AS (
        SELECT json_group_array(
            json_object(
                'date', ih.Date,
                'price', ih.ILSRetailPrice,
                'qtyInStock', ih.QtyInStock,
                'source', 'history'
            )
        ) as PriceHistoryArray
        FROM ItemHistory ih
        WHERE ih.ItemID = ?
        ORDER BY ih.Date DESC
    ),
    SupplierResponses AS (
        SELECT json_group_array(
            json_object(
                'supplierName', s.Name,
                'supplierId', sr.SupplierID,
                'price', sr.PriceQuoted,
                'date', sr.ResponseDate,
                'isPromotion', COALESCE(sr.IsPromotion, 0),
                'promotionName', sr.PromotionName,
                'status', sr.Status
            )
        ) as SupplierPricesArray
        FROM SupplierResponse sr
        JOIN Supplier s ON sr.SupplierID = s.SupplierID
        WHERE sr.ItemID = ?
        AND sr.Status != 'deleted'
        ORDER BY sr.ResponseDate DESC
    ),
    ActivePromotions AS (
        SELECT json_group_array(
            json_object(
                'id', p.id,
                'name', p.name,
                'supplierName', s.Name,
                'supplierId', p.supplier_id,
                'startDate', p.start_date,
                'endDate', p.end_date,
                'isActive', p.is_active,
                'createdAt', p.created_at,
                'price', pi.promotion_price
            )
        ) as PromotionsArray
        FROM promotions p
        JOIN promotion_items pi ON p.id = pi.promotion_id
        JOIN Supplier s ON p.supplier_id = s.SupplierID
        WHERE pi.item_id = ?
        AND p.is_active = 1
        AND (p.start_date IS NULL OR p.start_date <= datetime('now'))
        AND (p.end_date IS NULL OR p.end_date >= datetime('now'))
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
            COALESCE(li.RetailPrice, h.ILSRetailPrice) as RetailPrice,
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
        ph.PriceHistoryArray as priceHistory,
        COALESCE(sr.SupplierPricesArray, '[]') as supplierPrices,
        COALESCE(ap.PromotionsArray, '[]') as promotions
    FROM BaseItems i
    LEFT JOIN LatestReferenceChanges rc1 ON i.ItemID = rc1.OriginalItemID
    LEFT JOIN ReferencingItems ri ON i.ItemID = ri.ItemID
    LEFT JOIN Supplier s1 ON rc1.SupplierID = s1.SupplierID
    LEFT JOIN PriceHistory ph ON 1=1
    LEFT JOIN SupplierResponses sr ON 1=1
    LEFT JOIN ActivePromotions ap ON 1=1`;
