-- Drop existing triggers
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry_update;

-- Recreate triggers with correct syntax
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
