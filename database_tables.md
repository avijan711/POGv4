# SQLite Database Documentation

## Overview
This document describes the SQLite database schema used in the POG system. The database uses SQLite version 3 and follows specific naming conventions and data types.

## Naming Conventions

### Tables
- PascalCase for main entities: `Item`, `Supplier`, `Order`, etc.
- snake_case for auxiliary tables: `promotion_items`
- Prefixes/Suffixes:
  - History tables: Suffix with "History" (e.g., `ItemHistory`)
  - Reference tables: Suffix with "Reference" (e.g., `ItemReferenceChange`)
  - Response tables: Prefix with "Supplier" (e.g., `SupplierResponse`)

### Columns
- PascalCase for most columns: `ItemID`, `HebrewDescription`
- snake_case for some newer tables: `supplier_id`, `is_active`
- Common patterns:
  - Primary keys: TableName + "ID" (e.g., `ItemID`, `SupplierID`)
  - Foreign keys: Referenced table + "ID" (e.g., `InquiryID`, `SupplierID`)
  - Timestamps: Suffix with "Date" (e.g., `OrderDate`, `ChangeDate`)
  - Boolean flags: Prefix with "Is" (e.g., `IsActive`, `IsPromotion`)

### Indexes
- snake_case with prefix `idx_`
- Format: `idx_table_column(s)` (e.g., `idx_supplier_prices_item`)

## Data Types

SQLite core types used in the schema:
- `INTEGER`: For auto-incrementing IDs and numeric values
- `TEXT`: For string data and some IDs
- `VARCHAR`: For string data with potential length limits
- `NUMERIC`/`DECIMAL`: For decimal numbers (prices, markups)
- `TIMESTAMP`/`DATETIME`: For date and time values
- `BOOLEAN`: For true/false flags
- `BLOB`: For binary data (e.g., Excel files)
- `JSON`: For structured data (e.g., contact information)

## Tables

### Item
Core table for item information
```sql
CREATE TABLE Item (
  ItemID VARCHAR PRIMARY KEY,
  HebrewDescription TEXT,
  EnglishDescription TEXT,
  ImportMarkup NUMERIC DEFAULT 1.30,
  HSCode VARCHAR,
  Image TEXT
);
```

### Supplier
Stores supplier information
```sql
CREATE TABLE Supplier (
  SupplierID INTEGER PRIMARY KEY AUTOINCREMENT,
  Name TEXT,
  ContactInfo JSON
);
```

### ItemHistory
Tracks historical data for items
```sql
CREATE TABLE ItemHistory (
  ItemHistoryID INTEGER PRIMARY KEY AUTOINCREMENT,
  ItemID VARCHAR,
  ILSRetailPrice NUMERIC,
  QtyInStock INTEGER,
  QtySoldThisYear INTEGER,
  QtySoldLastYear INTEGER,
  Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(ItemID) REFERENCES Item(ItemID)
);
```

### Inquiry
Manages customer inquiries
```sql
CREATE TABLE Inquiry (
  InquiryID INTEGER PRIMARY KEY AUTOINCREMENT,
  InquiryNumber VARCHAR UNIQUE,
  Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ExcelFile BLOB,
  Status TEXT DEFAULT 'New'
);
```

### InquiryItem
Links items to inquiries with additional details
```sql
CREATE TABLE InquiryItem (
  InquiryItemID INTEGER PRIMARY KEY AUTOINCREMENT,
  InquiryID INTEGER,
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
  FOREIGN KEY(InquiryID) REFERENCES Inquiry(InquiryID) ON DELETE CASCADE,
  FOREIGN KEY(ItemID) REFERENCES Item(ItemID)
);
```

### Order
Tracks orders placed with suppliers
```sql
CREATE TABLE "Order" (
  OrderID INTEGER PRIMARY KEY AUTOINCREMENT,
  InquiryID INTEGER,
  SupplierID INTEGER NOT NULL,
  OrderDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  Status TEXT DEFAULT 'Pending',
  Notes TEXT,
  FOREIGN KEY(InquiryID) REFERENCES Inquiry(InquiryID),
  FOREIGN KEY(SupplierID) REFERENCES Supplier(SupplierID)
);
```

### OrderItem
Individual items within orders
```sql
CREATE TABLE OrderItem (
  OrderItemID INTEGER PRIMARY KEY AUTOINCREMENT,
  OrderID INTEGER NOT NULL,
  ItemID TEXT NOT NULL,
  InquiryItemID INTEGER,
  Quantity INTEGER NOT NULL,
  PriceQuoted DECIMAL(10,2) NOT NULL,
  IsPromotion BOOLEAN DEFAULT 0,
  PromotionGroupID INTEGER,
  SupplierResponseID INTEGER,
  FOREIGN KEY(OrderID) REFERENCES "Order"(OrderID) ON DELETE CASCADE,
  FOREIGN KEY(ItemID) REFERENCES Item(ItemID),
  FOREIGN KEY(InquiryItemID) REFERENCES InquiryItem(InquiryItemID),
  FOREIGN KEY(PromotionGroupID) REFERENCES promotions(id),
  FOREIGN KEY(SupplierResponseID) REFERENCES SupplierResponse(SupplierResponseID)
);
```

### ItemReferenceChange
Tracks changes in item references
```sql
CREATE TABLE ItemReferenceChange (
  ChangeID INTEGER PRIMARY KEY AUTOINCREMENT,
  OriginalItemID VARCHAR,
  NewReferenceID VARCHAR,
  SupplierID INTEGER NULL,
  ChangedByUser BOOLEAN DEFAULT 0,
  ChangeDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  Notes TEXT,
  FOREIGN KEY(OriginalItemID) REFERENCES Item(ItemID),
  FOREIGN KEY(NewReferenceID) REFERENCES Item(ItemID),
  FOREIGN KEY(SupplierID) REFERENCES Supplier(SupplierID)
);
```

### promotions
Manages promotional campaigns
```sql
CREATE TABLE promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  supplier_id INTEGER REFERENCES Supplier(SupplierID),
  start_date DATETIME,
  end_date DATETIME,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### promotion_items
Items included in promotions
```sql
CREATE TABLE promotion_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  promotion_id INTEGER NOT NULL,
  promotion_price DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
);
```

### SupplierPrice
Tracks supplier pricing history
```sql
CREATE TABLE SupplierPrice (
  PriceID INTEGER PRIMARY KEY AUTOINCREMENT,
  ItemID TEXT NOT NULL,
  SupplierID INTEGER NOT NULL,
  PriceQuoted DECIMAL(10,2) NOT NULL,
  ImportMarkup DECIMAL(10,2) DEFAULT 1.3,
  RetailPrice DECIMAL(10,2),
  HebrewDescription TEXT,
  EnglishDescription TEXT,
  LastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(ItemID) REFERENCES Item(ItemID),
  FOREIGN KEY(SupplierID) REFERENCES Supplier(SupplierID)
);
```

### SupplierResponse
Tracks supplier responses to inquiries
```sql
CREATE TABLE SupplierResponse (
  SupplierResponseID INTEGER PRIMARY KEY AUTOINCREMENT,
  InquiryID INTEGER NOT NULL,
  SupplierID INTEGER NOT NULL,
  ItemID TEXT NOT NULL,
  PriceQuoted DECIMAL(10,2),
  Status TEXT DEFAULT 'pending',
  IsPromotion BOOLEAN DEFAULT 0,
  PromotionName TEXT,
  ResponseDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(InquiryID) REFERENCES Inquiry(InquiryID),
  FOREIGN KEY(SupplierID) REFERENCES Supplier(SupplierID),
  FOREIGN KEY(ItemID) REFERENCES Item(ItemID)
);
```

### SupplierResponseItem
Detailed supplier response items
```sql
CREATE TABLE SupplierResponseItem (
  ResponseItemID INTEGER PRIMARY KEY AUTOINCREMENT,
  SupplierResponseID INTEGER NOT NULL,
  ItemID TEXT NOT NULL,
  Price DECIMAL(10,2),
  Notes TEXT,
  HSCode TEXT,
  EnglishDescription TEXT,
  NewReferenceID TEXT,
  FOREIGN KEY(SupplierResponseID) REFERENCES SupplierResponse(SupplierResponseID),
  FOREIGN KEY(ItemID) REFERENCES Item(ItemID)
);
```

## Views

### ItemDetails
Provides a consolidated view of item information with latest history
```sql
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
```

## Triggers

### set_original_item_id
Automatically sets the original item ID when creating new inquiry items
```sql
CREATE TRIGGER set_original_item_id
AFTER INSERT ON InquiryItem
WHEN NEW.OriginalItemID IS NULL
BEGIN
    UPDATE InquiryItem
    SET OriginalItemID = NEW.ItemID
    WHERE InquiryItemID = NEW.InquiryItemID;
END;
```

### update_item_history_on_inquiry
Updates item history when new inquiry items are created
```sql
CREATE TRIGGER update_item_history_on_inquiry
AFTER INSERT ON InquiryItem
WHEN NEW.RetailPrice IS NOT NULL OR NEW.ImportMarkup IS NOT NULL
BEGIN
    -- Update Item table if it doesn't exist
    INSERT OR IGNORE INTO Item (
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
        NULL
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
```

## Performance Optimizations

### Indexes
The database includes numerous indexes for optimal query performance:

#### Reference Changes
- `idx_reference_changes_original`: `ItemReferenceChange(OriginalItemID)`
- `idx_reference_changes_new`: `ItemReferenceChange(NewReferenceID)`
- `idx_reference_changes_supplier`: `ItemReferenceChange(SupplierID)`
- `idx_reference_changes_date`: `ItemReferenceChange(ChangeDate)`

#### Supplier Related
- `idx_supplier_prices_item`: `SupplierPrice(ItemID)`
- `idx_supplier_prices_supplier`: `SupplierPrice(SupplierID)`
- `idx_supplier_response_inquiry`: `SupplierResponse(InquiryID)`
- `idx_supplier_response_supplier`: `SupplierResponse(SupplierID)`
- `idx_supplier_response_item`: `SupplierResponse(ItemID)`
- `idx_supplier_response_date`: `SupplierResponse(ResponseDate)`
- `idx_supplier_response_item_response`: `SupplierResponseItem(SupplierResponseID)`
- `idx_supplier_response_item_item`: `SupplierResponseItem(ItemID)`

#### Item History
- `idx_item_history_item`: `ItemHistory(ItemID)`
- `idx_item_history_date`: `ItemHistory(Date)`
- `idx_item_history_retail`: `ItemHistory(ItemID, ILSRetailPrice)`

#### Promotions
- `idx_promotion_dates`: `promotions(start_date, end_date)`
- `idx_promotion_supplier`: `promotions(supplier_id)`
- `idx_promotion_active`: `promotions(is_active)`
- `idx_promotion_items_item`: `promotion_items(item_id)`
- `idx_promotion_items_promotion`: `promotion_items(promotion_id)`

#### Orders
- `idx_order_inquiry`: `Order(InquiryID)`
- `idx_order_supplier`: `Order(SupplierID)`
- `idx_order_date`: `Order(OrderDate)`
- `idx_order_status`: `Order(Status)`
- `idx_order_item_order`: `OrderItem(OrderID)`
- `idx_order_item_item`: `OrderItem(ItemID)`
- `idx_order_item_inquiry`: `OrderItem(InquiryItemID)`

#### Inquiry
- `idx_inquiry_item_retail`: `InquiryItem(ItemID, RetailPrice)`

### Foreign Key Constraints
- ON DELETE CASCADE for:
  - OrderItem -> Order
  - InquiryItem -> Inquiry
  - promotion_items -> promotions
- Standard foreign key constraints for data integrity on all relationships
