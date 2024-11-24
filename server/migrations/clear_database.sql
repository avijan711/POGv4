-- Disable foreign key constraint checks temporarily
PRAGMA foreign_keys = OFF;

-- Clear all tables in correct order
DELETE FROM OrderItem;
DELETE FROM "Order";
DELETE FROM promotion_items;
DELETE FROM promotions;
DELETE FROM SupplierResponseItem;
DELETE FROM SupplierResponse;
DELETE FROM InquiryItem;
DELETE FROM Inquiry;
DELETE FROM ItemHistory;
DELETE FROM ItemReferenceChange;
DELETE FROM SupplierPrice;
DELETE FROM Supplier;
DELETE FROM Item;

-- Re-enable foreign key constraint checks
PRAGMA foreign_keys = ON;

-- Vacuum the database to reclaim space and reset auto-increment counters
VACUUM;
