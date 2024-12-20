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
