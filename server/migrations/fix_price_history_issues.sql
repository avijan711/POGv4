-- Drop view first
DROP VIEW IF EXISTS ItemDetails;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry_update;

-- Fix ItemHistory table schema
DROP TABLE IF EXISTS ItemHistory;
CREATE TABLE ItemHistory (
    HistoryID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID TEXT NOT NULL,
    ILSRetailPrice DECIMAL(10,2),
    QtyInStock INTEGER DEFAULT 0,
    QtySoldThisYear INTEGER DEFAULT 0,
    QtySoldLastYear INTEGER DEFAULT 0,
    Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

-- Create indexes
CREATE INDEX idx_item_history_item ON ItemHistory(ItemID);
CREATE INDEX idx_item_history_date ON ItemHistory(Date);
CREATE INDEX idx_item_history_retail ON ItemHistory(ItemID, ILSRetailPrice);

-- Recreate triggers with fixed syntax
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

-- Populate initial data from inquiries
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
WHERE ii.RetailPrice IS NOT NULL;

-- Recreate ItemDetails view
CREATE VIEW IF NOT EXISTS ItemDetails AS
SELECT 
    i.*,
    COALESCE(h.ILSRetailPrice, 0) as CurrentRetailPrice,
    COALESCE(h.QtyInStock, 0) as CurrentStock,
    COALESCE(h.QtySoldThisYear, 0) as CurrentYearSales,
    COALESCE(h.QtySoldLastYear, 0) as LastYearSales,
    h.Date as LastUpdated
FROM Item i
LEFT JOIN (
    SELECT 
        ItemID,
        ILSRetailPrice,
        QtyInStock,
        QtySoldThisYear,
        QtySoldLastYear,
        Date
    FROM ItemHistory
    WHERE (ItemID, Date) IN (
        SELECT ItemID, MAX(Date)
        FROM ItemHistory
        GROUP BY ItemID
    )
) h ON i.ItemID = h.ItemID;
