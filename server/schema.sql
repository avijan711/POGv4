-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- Create base tables first (no foreign key dependencies)
CREATE TABLE IF NOT EXISTS Item (
    ItemID TEXT PRIMARY KEY,
    HebrewDescription TEXT,
    EnglishDescription TEXT,
    ImportMarkup DECIMAL(10,2) DEFAULT 1.3,
    HSCode TEXT,
    Image TEXT
);

CREATE TABLE IF NOT EXISTS Supplier (
    SupplierID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    ContactPerson TEXT,
    Email TEXT,
    Phone TEXT
);

-- Create tables with foreign key dependencies
CREATE TABLE IF NOT EXISTS ItemHistory (
    HistoryID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID TEXT NOT NULL,
    ILSRetailPrice DECIMAL(10,2),
    QtyInStock INTEGER DEFAULT 0,
    QtySoldThisYear INTEGER DEFAULT 0,
    QtySoldLastYear INTEGER DEFAULT 0,
    Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

CREATE TABLE IF NOT EXISTS Inquiry (
    InquiryID INTEGER PRIMARY KEY AUTOINCREMENT,
    InquiryNumber TEXT UNIQUE,
    Status TEXT NOT NULL,
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    Date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PromotionGroup (
    PromotionGroupID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    StartDate DATETIME,
    EndDate DATETIME,
    IsActive BOOLEAN DEFAULT 1,
    ExcelFilePath TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    SupplierID INTEGER,
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

CREATE TABLE IF NOT EXISTS Promotion (
    PromotionID INTEGER PRIMARY KEY AUTOINCREMENT,
    PromotionGroupID INTEGER NOT NULL,
    ItemID TEXT NOT NULL,
    PromoPrice DECIMAL(10,2),
    MinQuantity INTEGER,
    IsActive BOOLEAN DEFAULT 1,
    FOREIGN KEY (PromotionGroupID) REFERENCES PromotionGroup(PromotionGroupID),
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

CREATE TABLE IF NOT EXISTS ItemReferenceChange (
    ChangeID INTEGER PRIMARY KEY AUTOINCREMENT,
    OriginalItemID TEXT NOT NULL,
    NewReferenceID TEXT NOT NULL,
    ChangeDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    ChangedByUser BOOLEAN DEFAULT 0,
    SupplierID INTEGER,
    Notes TEXT,
    FOREIGN KEY (OriginalItemID) REFERENCES Item(ItemID),
    FOREIGN KEY (NewReferenceID) REFERENCES Item(ItemID),
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID),
    CHECK (OriginalItemID != NewReferenceID)
);

CREATE TABLE IF NOT EXISTS InquiryItem (
    InquiryItemID INTEGER PRIMARY KEY AUTOINCREMENT,
    InquiryID INTEGER NOT NULL,
    ItemID TEXT NOT NULL,
    OriginalItemID TEXT REFERENCES Item(ItemID),
    RequestedQty INTEGER NOT NULL,
    HebrewDescription TEXT,
    EnglishDescription TEXT,
    HSCode TEXT,
    ImportMarkup DECIMAL(10,2),
    QtyInStock INTEGER,
    RetailPrice DECIMAL(10,2),
    SoldThisYear INTEGER,
    SoldLastYear INTEGER,
    NewReferenceID TEXT,
    ReferenceNotes TEXT,
    FOREIGN KEY (InquiryID) REFERENCES Inquiry(InquiryID),
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

CREATE TABLE IF NOT EXISTS SupplierPrice (
    PriceID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID TEXT NOT NULL,
    SupplierID INTEGER NOT NULL,
    PriceQuoted DECIMAL(10,2) NOT NULL,
    ImportMarkup DECIMAL(10,2) DEFAULT 1.3,
    RetailPrice DECIMAL(10,2),
    HebrewDescription TEXT,
    EnglishDescription TEXT,
    LastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID),
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

CREATE TABLE IF NOT EXISTS SupplierResponse (
    SupplierResponseID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID TEXT NOT NULL,
    SupplierID INTEGER NOT NULL,
    PriceQuoted DECIMAL(10,2),
    Status TEXT DEFAULT 'Active',
    ResponseDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsPromotion BOOLEAN DEFAULT 0,
    PromotionName TEXT,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID),
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reference_changes_original ON ItemReferenceChange(OriginalItemID);
CREATE INDEX IF NOT EXISTS idx_reference_changes_new ON ItemReferenceChange(NewReferenceID);
CREATE INDEX IF NOT EXISTS idx_reference_changes_supplier ON ItemReferenceChange(SupplierID);
CREATE INDEX IF NOT EXISTS idx_reference_changes_date ON ItemReferenceChange(ChangeDate);
CREATE INDEX IF NOT EXISTS idx_inquiry_items_original ON InquiryItem(OriginalItemID);
CREATE INDEX IF NOT EXISTS idx_inquiry_items_both_ids ON InquiryItem(ItemID, OriginalItemID);
CREATE INDEX IF NOT EXISTS idx_supplier_prices_item ON SupplierPrice(ItemID);
CREATE INDEX IF NOT EXISTS idx_supplier_prices_supplier ON SupplierPrice(SupplierID);
CREATE INDEX IF NOT EXISTS idx_item_history_item ON ItemHistory(ItemID);
CREATE INDEX IF NOT EXISTS idx_item_history_date ON ItemHistory(Date);
CREATE INDEX IF NOT EXISTS idx_promotion_group_dates ON PromotionGroup(StartDate, EndDate);
CREATE INDEX IF NOT EXISTS idx_promotion_group_supplier ON PromotionGroup(SupplierID);
CREATE INDEX IF NOT EXISTS idx_promotion_item ON Promotion(ItemID);
CREATE INDEX IF NOT EXISTS idx_promotion_group ON Promotion(PromotionGroupID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_item ON SupplierResponse(ItemID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_supplier ON SupplierResponse(SupplierID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_date ON SupplierResponse(ResponseDate);
CREATE INDEX IF NOT EXISTS idx_inquiry_item_retail ON InquiryItem(ItemID, RetailPrice);
CREATE INDEX IF NOT EXISTS idx_item_history_retail ON ItemHistory(ItemID, ILSRetailPrice);

-- Create triggers
DROP TRIGGER IF EXISTS set_original_item_id;
CREATE TRIGGER set_original_item_id
AFTER INSERT ON InquiryItem
WHEN NEW.OriginalItemID IS NULL
BEGIN
    UPDATE InquiryItem 
    SET OriginalItemID = NEW.ItemID 
    WHERE InquiryItemID = NEW.InquiryItemID;
END;

-- Create trigger to update Item and ItemHistory when InquiryItem is inserted
DROP TRIGGER IF EXISTS update_item_history_on_inquiry;
CREATE TRIGGER update_item_history_on_inquiry
AFTER INSERT ON InquiryItem
WHEN NEW.RetailPrice IS NOT NULL OR NEW.ImportMarkup IS NOT NULL
BEGIN
    -- Update Item table
    INSERT OR REPLACE INTO Item (
        ItemID,
        HebrewDescription,
        EnglishDescription,
        ImportMarkup,
        HSCode,
        Image
    )
    VALUES (
        NEW.ItemID,
        NEW.HebrewDescription,
        NEW.EnglishDescription,
        COALESCE(NEW.ImportMarkup, 1.30),
        NEW.HSCode,
        (SELECT Image FROM Item WHERE ItemID = NEW.ItemID)
    );

    -- Insert into ItemHistory if retail price exists
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
        datetime('now')
    WHERE NEW.RetailPrice IS NOT NULL;
END;

-- Create view for consistent item details retrieval
DROP VIEW IF EXISTS ItemDetails;
CREATE VIEW ItemDetails AS
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
)
SELECT 
    i.ItemID,
    i.HebrewDescription,
    i.EnglishDescription,
    COALESCE(CAST(i.ImportMarkup AS REAL), 1.30) as ImportMarkup,
    i.HSCode,
    i.Image,
    h.ILSRetailPrice as RetailPrice,
    COALESCE(h.QtyInStock, 0) as QtyInStock,
    COALESCE(h.QtySoldThisYear, 0) as SoldThisYear,
    COALESCE(h.QtySoldLastYear, 0) as SoldLastYear,
    h.HistoryDate as LastUpdated
FROM Item i
LEFT JOIN LatestHistory h ON i.ItemID = h.ItemID;
