# Database Tables Reference

## Core Tables

### Item
Primary table for inventory items
- `ItemID` (TEXT, Primary Key)
- `HebrewDescription` (TEXT)
- `EnglishDescription` (TEXT)
- `ImportMarkup` (DECIMAL(10,2), Default: 1.3)
- `HSCode` (TEXT)
- `Image` (TEXT)

### ItemHistory
Tracks historical data for items
- `HistoryID` (INTEGER, Primary Key)
- `ItemID` (TEXT) → References Item(ItemID)
- `ILSRetailPrice` (DECIMAL(10,2))
- `QtyInStock` (INTEGER, Default: 0)
- `QtySoldThisYear` (INTEGER, Default: 0)
- `QtySoldLastYear` (INTEGER, Default: 0)
- `Date` (DATETIME, Default: CURRENT_TIMESTAMP)

### Supplier
Manages supplier information
- `SupplierID` (INTEGER, Primary Key)
- `Name` (TEXT, NOT NULL)
- `ContactPerson` (TEXT)
- `Email` (TEXT)
- `Phone` (TEXT)

## Inquiry System

### Inquiry
Manages inquiry records
- `InquiryID` (INTEGER, Primary Key)
- `InquiryNumber` (TEXT, UNIQUE)
- `Status` (TEXT, NOT NULL)
- `CreatedDate` (DATETIME, Default: CURRENT_TIMESTAMP)
- `Date` (DATETIME, Default: CURRENT_TIMESTAMP)

### InquiryItem
Items included in inquiries
- `InquiryItemID` (INTEGER, Primary Key)
- `InquiryID` (INTEGER) → References Inquiry(InquiryID)
- `ItemID` (TEXT) → References Item(ItemID)
- `OriginalItemID` (TEXT) → References Item(ItemID)
- `RequestedQty` (INTEGER, NOT NULL, Default: 0)
- `HebrewDescription` (TEXT)
- `EnglishDescription` (TEXT)
- `HSCode` (TEXT)
- `ImportMarkup` (DECIMAL(10,2))
- `QtyInStock` (INTEGER)
- `RetailPrice` (DECIMAL(10,2))
- `SoldThisYear` (INTEGER)
- `SoldLastYear` (INTEGER)
- `NewReferenceID` (TEXT)
- `ReferenceNotes` (TEXT)

## Supplier Response System

### SupplierResponse
Tracks supplier responses to inquiries
- `SupplierResponseID` (INTEGER, Primary Key)
- `InquiryID` (INTEGER) → References Inquiry(InquiryID)
- `SupplierID` (INTEGER) → References Supplier(SupplierID)
- `ItemID` (TEXT) → References Item(ItemID)
- `PriceQuoted` (DECIMAL(10,2))
- `Status` (TEXT, Default: 'pending')
- `IsPromotion` (BOOLEAN, Default: 0)
- `PromotionName` (TEXT)
- `ResponseDate` (DATETIME, Default: CURRENT_TIMESTAMP)

### SupplierResponseItem
Detailed items in supplier responses
- `ResponseItemID` (INTEGER, Primary Key)
- `SupplierResponseID` (INTEGER) → References SupplierResponse(SupplierResponseID)
- `ItemID` (TEXT) → References Item(ItemID)
- `Price` (DECIMAL(10,2))
- `Notes` (TEXT)
- `HSCode` (TEXT)
- `EnglishDescription` (TEXT)
- `NewReferenceID` (TEXT)

### SupplierPrice
Tracks supplier pricing history
- `PriceID` (INTEGER, Primary Key)
- `ItemID` (TEXT) → References Item(ItemID)
- `SupplierID` (INTEGER) → References Supplier(SupplierID)
- `PriceQuoted` (DECIMAL(10,2), NOT NULL)
- `ImportMarkup` (DECIMAL(10,2), Default: 1.3)
- `RetailPrice` (DECIMAL(10,2))
- `HebrewDescription` (TEXT)
- `EnglishDescription` (TEXT)
- `LastUpdated` (DATETIME, Default: CURRENT_TIMESTAMP)

## Order Management

### "Order"
Manages orders
- `OrderID` (INTEGER, Primary Key)
- `InquiryID` (INTEGER) → References Inquiry(InquiryID)
- `SupplierID` (INTEGER) → References Supplier(SupplierID)
- `OrderDate` (DATETIME, Default: CURRENT_TIMESTAMP)
- `Status` (TEXT, Default: 'Pending')
- `Notes` (TEXT)

### OrderItem
Items included in orders
- `OrderItemID` (INTEGER, Primary Key)
- `OrderID` (INTEGER) → References "Order"(OrderID)
- `ItemID` (TEXT) → References Item(ItemID)
- `InquiryItemID` (INTEGER) → References InquiryItem(InquiryItemID)
- `Quantity` (INTEGER, NOT NULL)
- `PriceQuoted` (DECIMAL(10,2), NOT NULL)
- `IsPromotion` (BOOLEAN, Default: 0)
- `PromotionGroupID` (INTEGER) → References promotions(id)
- `SupplierResponseID` (INTEGER) → References SupplierResponse(SupplierResponseID)

## Promotions

### promotions
Manages promotional campaigns
- `id` (INTEGER, Primary Key)
- `name` (TEXT, NOT NULL)
- `supplier_id` (INTEGER) → References Supplier(SupplierID)
- `start_date` (DATETIME)
- `end_date` (DATETIME)
- `is_active` (BOOLEAN, Default: 1)
- `created_at` (DATETIME, Default: CURRENT_TIMESTAMP)

### promotion_items
Items included in promotions
- `id` (INTEGER, Primary Key)
- `item_id` (TEXT) → References Item(ItemID)
- `promotion_id` (INTEGER) → References promotions(id)
- `promotion_price` (DECIMAL(10,2), NOT NULL)
- `created_at` (DATETIME, Default: CURRENT_TIMESTAMP)

## Reference Management

### ItemReferenceChange
Tracks changes in item references
- `ChangeID` (INTEGER, Primary Key)
- `OriginalItemID` (TEXT) → References Item(ItemID)
- `NewReferenceID` (TEXT) → References Item(ItemID)
- `ChangeDate` (DATETIME, Default: CURRENT_TIMESTAMP)
- `ChangedByUser` (BOOLEAN, Default: 0)
- `SupplierID` (INTEGER) → References Supplier(SupplierID)
- `Notes` (TEXT)

## Views

### ItemDetails
Provides consolidated item information
- Combines data from Item and latest ItemHistory
- Includes:
  - Basic item information (ItemID, HebrewDescription, EnglishDescription, ImportMarkup, HSCode, Image)
  - Latest retail price (ILSRetailPrice)
  - Current stock quantities (QtyInStock)
  - Sales history (QtySoldThisYear, QtySoldLastYear)
  - Last update timestamp (HistoryDate)

## Important Notes

1. Foreign Key Constraints are enabled (PRAGMA foreign_keys = ON)
2. Extensive indexing is implemented for performance optimization
3. Automatic triggers maintain data consistency:
   - `set_original_item_id`: Sets OriginalItemID on InquiryItem insert
   - `update_item_history_on_inquiry`: Updates Item and ItemHistory on InquiryItem insert
4. All monetary values use DECIMAL(10,2) for precision
5. Most tables include timestamp fields for tracking creation/updates
6. Unique constraints prevent duplicate records where necessary
