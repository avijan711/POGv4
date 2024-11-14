PRAGMA foreign_keys = ON;

-- Settings table
CREATE TABLE IF NOT EXISTS Settings (
    SettingID INTEGER PRIMARY KEY AUTOINCREMENT,
    SettingKey TEXT UNIQUE NOT NULL,
    SettingValue TEXT NOT NULL,
    LastUpdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Item table
CREATE TABLE IF NOT EXISTS Item (
    ItemID VARCHAR PRIMARY KEY,
    HebrewDescription TEXT,
    EnglishDescription TEXT,
    ImportMarkup NUMERIC DEFAULT 1.30,
    HSCode VARCHAR,
    Image TEXT
);

-- Supplier table
CREATE TABLE IF NOT EXISTS Supplier (
    SupplierID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT,
    ContactPerson TEXT,
    Email TEXT,
    Phone TEXT
);

-- ItemReferenceChange table
CREATE TABLE IF NOT EXISTS ItemReferenceChange (
    ChangeID INTEGER PRIMARY KEY AUTOINCREMENT,
    OriginalItemID VARCHAR,
    NewReferenceID VARCHAR,
    SupplierID INTEGER NULL,
    ChangedByUser BOOLEAN DEFAULT 0,
    ChangeDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Notes TEXT,
    FOREIGN KEY (OriginalItemID) REFERENCES Item(ItemID),
    FOREIGN KEY (NewReferenceID) REFERENCES Item(ItemID),
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

-- ItemHistory table
CREATE TABLE IF NOT EXISTS ItemHistory (
    ItemHistoryID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID VARCHAR,
    ILSRetailPrice NUMERIC,
    QtyInStock INTEGER,
    QtySoldThisYear INTEGER,
    QtySoldLastYear INTEGER,
    Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

-- SupplierResponse table
CREATE TABLE IF NOT EXISTS SupplierResponse (
    SupplierResponseID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemID VARCHAR,
    SupplierID INTEGER,
    PriceQuoted NUMERIC,
    ResponseDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status TEXT,
    IsPromotion BOOLEAN DEFAULT 0,
    PromotionName TEXT,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID),
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

-- PromotionGroup table to manage sets of promotional items
CREATE TABLE IF NOT EXISTS PromotionGroup (
    PromotionGroupID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    StartDate TIMESTAMP NOT NULL,
    EndDate TIMESTAMP NOT NULL,
    SupplierID INTEGER NOT NULL,
    IsActive BOOLEAN DEFAULT 1,
    ExcelFilePath TEXT,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

-- Promotion table (modified to link with PromotionGroup)
CREATE TABLE IF NOT EXISTS Promotion (
    PromotionID INTEGER PRIMARY KEY AUTOINCREMENT,
    PromotionGroupID INTEGER NOT NULL,
    ItemID VARCHAR NOT NULL,
    PromoPrice NUMERIC NOT NULL,
    IsActive BOOLEAN DEFAULT 1,
    FOREIGN KEY (PromotionGroupID) REFERENCES PromotionGroup(PromotionGroupID) ON DELETE CASCADE,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

-- Inquiry table
CREATE TABLE IF NOT EXISTS Inquiry (
    InquiryID INTEGER PRIMARY KEY AUTOINCREMENT,
    InquiryNumber VARCHAR UNIQUE,
    Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ExcelFile BLOB,
    Status TEXT DEFAULT 'New'
);

-- InquiryItem table to store items associated with each inquiry
CREATE TABLE IF NOT EXISTS InquiryItem (
    InquiryItemID INTEGER PRIMARY KEY AUTOINCREMENT,
    InquiryID INTEGER,
    OriginalItemID VARCHAR,
    ItemID VARCHAR,
    HebrewDescription TEXT,
    EnglishDescription TEXT,
    ImportMarkup NUMERIC,
    HSCode VARCHAR,
    QtyInStock INTEGER,
    SoldThisYear INTEGER,
    SoldLastYear INTEGER,
    RetailPrice NUMERIC,
    RequestedQty INTEGER DEFAULT 0,
    ReferenceNotes TEXT,
    FOREIGN KEY (InquiryID) REFERENCES Inquiry(InquiryID) ON DELETE CASCADE,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID),
    FOREIGN KEY (OriginalItemID) REFERENCES Item(ItemID)
);

-- New Order table to track orders per supplier
CREATE TABLE IF NOT EXISTS `Order` (
    OrderID INTEGER PRIMARY KEY AUTOINCREMENT,
    InquiryID INTEGER NOT NULL,
    SupplierID INTEGER NOT NULL,
    OrderDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status TEXT DEFAULT 'Pending',
    Notes TEXT,
    FOREIGN KEY (InquiryID) REFERENCES Inquiry(InquiryID),
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

-- New OrderItem table to track items within each order
CREATE TABLE IF NOT EXISTS OrderItem (
    OrderItemID INTEGER PRIMARY KEY AUTOINCREMENT,
    OrderID INTEGER NOT NULL,
    ItemID VARCHAR NOT NULL,
    InquiryItemID INTEGER NOT NULL,
    Quantity INTEGER NOT NULL,
    PriceQuoted NUMERIC NOT NULL,
    SupplierResponseID INTEGER NOT NULL,
    FOREIGN KEY (OrderID) REFERENCES `Order`(OrderID) ON DELETE CASCADE,
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID),
    FOREIGN KEY (InquiryItemID) REFERENCES InquiryItem(InquiryItemID),
    FOREIGN KEY (SupplierResponseID) REFERENCES SupplierResponse(SupplierResponseID)
);

-- Insert default settings if not exists
INSERT OR IGNORE INTO Settings (SettingKey, SettingValue) VALUES 
('eurToIls', '3.95');
