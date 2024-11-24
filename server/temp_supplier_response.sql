-- Drop existing tables if they exist
DROP TABLE IF EXISTS SupplierResponseItem;
DROP TABLE IF EXISTS SupplierResponse;

-- Create new SupplierResponse table
CREATE TABLE IF NOT EXISTS SupplierResponse (
    SupplierResponseID INTEGER PRIMARY KEY AUTOINCREMENT,
    InquiryID INTEGER NOT NULL,
    SupplierID INTEGER NOT NULL,
    ItemID TEXT NOT NULL,
    PriceQuoted DECIMAL(10,2),
    Status TEXT DEFAULT 'pending',
    IsPromotion BOOLEAN DEFAULT 0,
    PromotionName TEXT,
    ResponseDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (InquiryID) REFERENCES Inquiry(InquiryID),
    FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID),
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

-- Create SupplierResponseItem table
CREATE TABLE IF NOT EXISTS SupplierResponseItem (
    ResponseItemID INTEGER PRIMARY KEY AUTOINCREMENT,
    SupplierResponseID INTEGER NOT NULL,
    ItemID TEXT NOT NULL,
    Price DECIMAL(10,2),
    Notes TEXT,
    HSCode TEXT,
    EnglishDescription TEXT,
    NewReferenceID TEXT,
    FOREIGN KEY (SupplierResponseID) REFERENCES SupplierResponse(SupplierResponseID),
    FOREIGN KEY (ItemID) REFERENCES Item(ItemID)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_response_inquiry ON SupplierResponse(InquiryID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_supplier ON SupplierResponse(SupplierID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_item ON SupplierResponse(ItemID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_date ON SupplierResponse(ResponseDate);
CREATE INDEX IF NOT EXISTS idx_supplier_response_item_response ON SupplierResponseItem(SupplierResponseID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_item_item ON SupplierResponseItem(ItemID);
