-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;

-- Create trigger to update ItemHistory when InquiryItem is inserted or updated
CREATE TRIGGER update_item_history_on_inquiry
AFTER INSERT ON InquiryItem
BEGIN
    -- Only insert history record if RetailPrice is not null
    INSERT INTO ItemHistory (
        ItemID,
        ILSRetailPrice,
        QtyInStock,
        QtySoldThisYear,
        QtySoldLastYear,
        Date
    )
    SELECT 
        NEW.ItemID,
        NEW.RetailPrice,
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID)
    WHERE NEW.RetailPrice IS NOT NULL;
END;

-- Create trigger for updates to InquiryItem
CREATE TRIGGER update_item_history_on_inquiry_update
AFTER UPDATE OF RetailPrice ON InquiryItem
WHEN NEW.RetailPrice IS NOT NULL AND NEW.RetailPrice != OLD.RetailPrice
BEGIN
    INSERT INTO ItemHistory (
        ItemID,
        ILSRetailPrice,
        QtyInStock,
        QtySoldThisYear,
        QtySoldLastYear,
        Date
    )
    SELECT 
        NEW.ItemID,
        NEW.RetailPrice,
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID);
END;

-- Backfill historical data from existing inquiries
INSERT INTO ItemHistory (
    ItemID,
    ILSRetailPrice,
    QtyInStock,
    QtySoldThisYear,
    QtySoldLastYear,
    Date
)
SELECT DISTINCT
    ii.ItemID,
    ii.RetailPrice,
    COALESCE(ii.QtyInStock, 0),
    COALESCE(ii.SoldThisYear, 0),
    COALESCE(ii.SoldLastYear, 0),
    i.Date
FROM InquiryItem ii
JOIN Inquiry i ON ii.InquiryID = i.InquiryID
WHERE ii.RetailPrice IS NOT NULL
AND NOT EXISTS (
    SELECT 1 
    FROM ItemHistory ih 
    WHERE ih.ItemID = ii.ItemID 
    AND ih.Date = i.Date
    AND ih.ILSRetailPrice = ii.RetailPrice
);
