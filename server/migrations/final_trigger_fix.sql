DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry_update;

CREATE TRIGGER update_item_history_on_inquiry 
AFTER INSERT ON InquiryItem 
FOR EACH ROW 
WHEN NEW.RetailPrice IS NOT NULL
BEGIN
    INSERT INTO ItemHistory (HistoryID, ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
    SELECT 
        NULL,
        NEW.ItemID,
        NEW.RetailPrice,
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID);
END;

CREATE TRIGGER update_item_history_on_inquiry_update 
AFTER UPDATE OF RetailPrice ON InquiryItem 
FOR EACH ROW 
WHEN NEW.RetailPrice IS NOT NULL AND NEW.RetailPrice != OLD.RetailPrice
BEGIN
    INSERT INTO ItemHistory (HistoryID, ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
    SELECT 
        NULL,
        NEW.ItemID,
        NEW.RetailPrice,
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID);
END;
