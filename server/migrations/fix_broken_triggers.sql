-- Drop existing broken triggers
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry_update;

-- Create INSERT trigger with correct syntax
CREATE TRIGGER update_item_history_on_inquiry 
AFTER INSERT ON InquiryItem 
FOR EACH ROW 
WHEN NEW.RetailPrice IS NOT NULL
BEGIN
    INSERT INTO ItemHistory (HistoryID, ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
    VALUES (
        NULL,
        NEW.ItemID,
        NEW.RetailPrice,
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID)
    );
END;

-- Create UPDATE trigger with correct syntax
CREATE TRIGGER update_item_history_on_inquiry_update 
AFTER UPDATE OF RetailPrice ON InquiryItem 
FOR EACH ROW 
WHEN NEW.RetailPrice IS NOT NULL AND NEW.RetailPrice != OLD.RetailPrice
BEGIN
    INSERT INTO ItemHistory (HistoryID, ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
    VALUES (
        NULL,
        NEW.ItemID,
        NEW.RetailPrice,
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID)
    );
END;

-- Clean up duplicate/invalid records
DELETE FROM ItemHistory 
WHERE (ItemID, Date) IN (
    SELECT ItemID, Date
    FROM ItemHistory
    WHERE ILSRetailPrice IS NULL
);

-- Backfill missing history data
INSERT INTO ItemHistory (HistoryID, ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
SELECT DISTINCT
    NULL,
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

-- Verify trigger creation
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='update_item_history_on_inquiry')
    AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='update_item_history_on_inquiry_update')
    THEN 'Triggers created successfully'
    ELSE 'Trigger creation failed'
END as status;
