-- Disable foreign key checks temporarily
PRAGMA foreign_keys = OFF;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
DROP TRIGGER IF EXISTS update_item_history_on_inquiry_update;

-- Create temporary table to store existing data
CREATE TEMPORARY TABLE temp_item_history AS 
SELECT * FROM ItemHistory;

-- Drop and recreate ItemHistory table with correct schema
DROP TABLE IF EXISTS ItemHistory;
CREATE TABLE ItemHistory (
    HistoryID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID TEXT NOT NULL,
    ILSRetailPrice REAL,  -- Using REAL instead of DECIMAL for SQLite compatibility
    QtyInStock INTEGER DEFAULT 0,
    QtySoldThisYear INTEGER DEFAULT 0,
    QtySoldLastYear INTEGER DEFAULT 0,
    Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID),
    CHECK (ILSRetailPrice IS NULL OR ILSRetailPrice >= 0)
);

-- Restore existing data
INSERT INTO ItemHistory 
SELECT 
    HistoryID,
    ItemID,
    CAST(ILSRetailPrice AS REAL),
    COALESCE(QtyInStock, 0),
    COALESCE(QtySoldThisYear, 0),
    COALESCE(QtySoldLastYear, 0),
    Date
FROM temp_item_history;

-- Drop temporary table
DROP TABLE temp_item_history;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_history_item ON ItemHistory(ItemID);
CREATE INDEX IF NOT EXISTS idx_item_history_date ON ItemHistory(Date);
CREATE INDEX IF NOT EXISTS idx_item_history_retail ON ItemHistory(ItemID, ILSRetailPrice);

-- Create trigger for new inquiry items
CREATE TRIGGER IF NOT EXISTS update_item_history_on_inquiry 
AFTER INSERT ON InquiryItem 
WHEN NEW.RetailPrice IS NOT NULL
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
        CAST(NEW.RetailPrice AS REAL),
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID);
END;

-- Create trigger for price updates
CREATE TRIGGER IF NOT EXISTS update_item_history_on_inquiry_update 
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
        CAST(NEW.RetailPrice AS REAL),
        COALESCE(NEW.QtyInStock, 0),
        COALESCE(NEW.SoldThisYear, 0),
        COALESCE(NEW.SoldLastYear, 0),
        (SELECT Date FROM Inquiry WHERE InquiryID = NEW.InquiryID);
END;

-- Backfill missing price history from inquiries
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
    CAST(ii.RetailPrice AS REAL),
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

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- Verify data integrity
CREATE TEMPORARY TABLE IF NOT EXISTS missing_prices AS
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

-- Output any items with missing price history
SELECT * FROM missing_prices;
