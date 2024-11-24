-- Disable foreign key checks temporarily
PRAGMA foreign_keys = OFF;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry_update;

-- Drop and recreate ItemHistory table with correct schema
DROP TABLE IF EXISTS ItemHistory;
CREATE TABLE ItemHistory (
    HistoryID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID TEXT NOT NULL,
    ILSRetailPrice REAL,
    QtyInStock INTEGER DEFAULT 0,
    QtySoldThisYear INTEGER DEFAULT 0,
    QtySoldLastYear INTEGER DEFAULT 0,
    Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID),
    CHECK (ILSRetailPrice IS NULL OR ILSRetailPrice >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_history_item ON ItemHistory(ItemID);
CREATE INDEX IF NOT EXISTS idx_item_history_date ON ItemHistory(Date);
CREATE INDEX IF NOT EXISTS idx_item_history_retail ON ItemHistory(ItemID, ILSRetailPrice);

-- Create simplified trigger for new inquiry items
CREATE TRIGGER update_item_history_on_inquiry 
AFTER INSERT ON InquiryItem 
FOR EACH ROW 
WHEN NEW.RetailPrice IS NOT NULL
BEGIN
    INSERT INTO ItemHistory (ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
    VALUES (
        NEW.ItemID, 
        NEW.RetailPrice, 
        COALESCE(NEW.QtyInStock, 0), 
        COALESCE(NEW.SoldThisYear, 0), 
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID)
    );
END;

-- Create simplified trigger for price updates
CREATE TRIGGER update_item_history_on_inquiry_update 
AFTER UPDATE OF RetailPrice ON InquiryItem 
FOR EACH ROW 
WHEN NEW.RetailPrice IS NOT NULL AND NEW.RetailPrice != OLD.RetailPrice
BEGIN
    INSERT INTO ItemHistory (ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
    VALUES (
        NEW.ItemID, 
        NEW.RetailPrice, 
        COALESCE(NEW.QtyInStock, 0), 
        COALESCE(NEW.SoldThisYear, 0), 
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID)
    );
END;

-- Backfill price history from inquiries
INSERT INTO ItemHistory (ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
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

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- Check for any items with missing prices
SELECT i.ItemID, i.HebrewDescription 
FROM Item i
LEFT JOIN ItemHistory ih ON i.ItemID = ih.ItemID
WHERE ih.ItemID IS NULL
AND EXISTS (
    SELECT 1 
    FROM InquiryItem ii 
    WHERE ii.ItemID = i.ItemID 
    AND ii.RetailPrice IS NOT NULL
);
