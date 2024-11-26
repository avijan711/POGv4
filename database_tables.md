# Database Schema Documentation

## Important Database Settings

```sql
PRAGMA foreign_keys=OFF;
```

## Core Tables

### item
Core table for storing product information.
| Column | Type | Description |
|--------|------|-------------|
| item_id | TEXT | Primary Key - Unique identifier for each item |
| hebrew_description | TEXT | Item description in Hebrew |
| english_description | TEXT | Item description in English |
| import_markup | REAL | Import markup multiplier (Default: 1.30) |
| hs_code | TEXT | Harmonized System code for customs/trade |
| image | TEXT | Image path or URL reference |
| notes | TEXT | General notes about the item |
| origin | TEXT | Item origin or source |
| last_updated | DATETIME | Last update timestamp (Default: CURRENT_TIMESTAMP) |

### supplier
Stores supplier/vendor information.
| Column | Type | Description |
|--------|------|-------------|
| supplier_id | INTEGER | Primary Key (Auto-increment) |
| name | TEXT | Supplier's business name |
| contact_person | TEXT | Contact person name |
| email | TEXT | Contact email |
| phone | TEXT | Contact phone number |

Current auto-increment value: 3

## Tracking & History

### item_history
Tracks historical data for items including pricing and inventory.
| Column | Type | Description |
|--------|------|-------------|
| history_id | INTEGER | Primary Key (Auto-increment) |
| item_id | TEXT | References item(item_id) |
| ils_retail_price | REAL | Retail price in ILS (Israeli Shekels) |
| qty_in_stock | INTEGER | Current inventory quantity |
| qty_sold_this_year | INTEGER | Sales quantity current year |
| qty_sold_last_year | INTEGER | Sales quantity previous year |
| date | DATETIME | Record timestamp (Default: CURRENT_TIMESTAMP) |

Current auto-increment value: 325

### item_reference_change
Tracks changes in item reference numbers and relationships.
| Column | Type | Description |
|--------|------|-------------|
| change_id | INTEGER | Primary Key (Auto-increment) |
| original_item_id | TEXT | References item(item_id) - Original reference |
| new_reference_id | TEXT | References item(item_id) - New reference |
| supplier_id | INTEGER NULL | References supplier(supplier_id) |
| changed_by_user | BOOLEAN | Manual change flag (Default: 0) |
| change_date | DATETIME | Change timestamp (Default: CURRENT_TIMESTAMP) |
| notes | TEXT | Change documentation/notes |

Current auto-increment value: 2

## Inquiry System

### inquiry
Manages customer inquiries/requests.
| Column | Type | Description |
|--------|------|-------------|
| inquiry_id | INTEGER | Primary Key (Auto-increment) |
| inquiry_number | TEXT UNIQUE | Unique inquiry identifier |
| date | DATETIME | Inquiry date (Default: CURRENT_TIMESTAMP) |
| status | TEXT | Inquiry status (Default: 'new') |

Current auto-increment value: 4

### inquiry_item
Items included in customer inquiries.
| Column | Type | Description |
|--------|------|-------------|
| inquiry_item_id | INTEGER | Primary Key (Auto-increment) |
| inquiry_id | INTEGER | References inquiry(inquiry_id) ON DELETE CASCADE |
| item_id | TEXT | References item(item_id) |
| original_item_id | TEXT | Original item ID |
| requested_qty | INTEGER | Requested quantity (Default: 0) |
| hebrew_description | TEXT | Hebrew item description |
| english_description | TEXT | English item description |
| import_markup | REAL | Import markup multiplier |
| hs_code | TEXT | Harmonized System code |
| qty_in_stock | INTEGER | Current stock quantity |
| retail_price | REAL | Retail price |
| sold_this_year | INTEGER | Current year sales |
| sold_last_year | INTEGER | Previous year sales |
| new_reference_id | TEXT | New reference ID |
| reference_notes | TEXT | Reference change notes |

Current auto-increment value: 337

## Supplier Response System

### supplier_response
Tracks supplier responses to inquiries.
| Column | Type | Description |
|--------|------|-------------|
| supplier_response_id | INTEGER | Primary Key (Auto-increment) |
| inquiry_id | INTEGER | References inquiry(inquiry_id) |
| supplier_id | INTEGER | References supplier(supplier_id) |
| item_id | TEXT | References item(item_id) |
| price_quoted | REAL | Quoted price |
| status | TEXT | Response status (Default: 'pending') |
| is_promotion | BOOLEAN | Promotion flag (Default: 0) |
| promotion_name | TEXT | Associated promotion name |
| response_date | DATETIME | Response timestamp (Default: CURRENT_TIMESTAMP) |

### supplier_response_item
Detailed supplier response items.
| Column | Type | Description |
|--------|------|-------------|
| response_item_id | INTEGER | Primary Key (Auto-increment) |
| supplier_response_id | INTEGER | References supplier_response(supplier_response_id) |
| item_id | TEXT | References item(item_id) |
| price | REAL | Item price |
| notes | TEXT | Additional notes |
| hs_code | TEXT | Harmonized System code |
| english_description | TEXT | English description |
| new_reference_id | TEXT | New reference ID if changed |

### supplier_price
Manages supplier-specific pricing information.
| Column | Type | Description |
|--------|------|-------------|
| price_id | INTEGER | Primary Key (Auto-increment) |
| item_id | TEXT | References item(item_id) |
| supplier_id | INTEGER | References supplier(supplier_id) |
| price_quoted | REAL | Price quoted by supplier |
| import_markup | REAL | Import markup factor (Default: 1.3) |
| retail_price | REAL | Calculated retail price |
| hebrew_description | TEXT | Supplier's Hebrew description |
| english_description | TEXT | Supplier's English description |
| last_updated | DATETIME | Last update timestamp |

## Order Management

### order
Manages customer orders.
| Column | Type | Description |
|--------|------|-------------|
| order_id | INTEGER | Primary Key (Auto-increment) |
| inquiry_id | INTEGER | References inquiry(inquiry_id) |
| supplier_id | INTEGER | References supplier(supplier_id) |
| order_date | DATETIME | Order date (Default: CURRENT_TIMESTAMP) |
| status | TEXT | Order status (Default: 'pending') |
| notes | TEXT | Order notes/comments |

### order_item
Individual items within orders.
| Column | Type | Description |
|--------|------|-------------|
| order_item_id | INTEGER | Primary Key (Auto-increment) |
| order_id | INTEGER | References order(order_id) ON DELETE CASCADE |
| item_id | TEXT | References item(item_id) |
| inquiry_item_id | INTEGER | References inquiry_item(inquiry_item_id) |
| quantity | INTEGER | Order quantity |
| price_quoted | REAL | Quoted price |
| is_promotion | BOOLEAN | Promotion flag (Default: 0) |
| promotion_id | INTEGER | References promotion(promotion_id) |
| supplier_response_id | INTEGER | References supplier_response(supplier_response_id) |

## Promotional System

### promotion
Manages promotions.
| Column | Type | Description |
|--------|------|-------------|
| promotion_id | INTEGER | Primary Key (Auto-increment) |
| name | TEXT | Promotion name/identifier |
| supplier_id | INTEGER | References supplier(supplier_id) |
| start_date | DATETIME | Promotion start datetime |
| end_date | DATETIME | Promotion end datetime |
| is_active | BOOLEAN | Active status (Default: 1) |
| created_at | DATETIME | Creation timestamp |

### promotion_item
Links items to promotions with promotional pricing.
| Column | Type | Description |
|--------|------|-------------|
| promotion_item_id | INTEGER | Primary Key (Auto-increment) |
| promotion_id | INTEGER | References promotion(promotion_id) ON DELETE CASCADE |
| item_id | TEXT | References item(item_id) |
| promotion_price | REAL | Promotional price |
| created_at | DATETIME | Creation timestamp |

## File Management

### item_files
Manages files associated with items.
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary Key (Auto-increment) |
| item_id | TEXT | References item(item_id) ON DELETE CASCADE |
| file_path | TEXT | Path to stored file |
| file_type | TEXT | File type/extension |
| upload_date | DATETIME | Upload timestamp |
| description | TEXT | File description |

## Views

### item_details
Comprehensive view combining current item data with latest history.
```sql
CREATE VIEW item_details AS
WITH latest_price AS (
    SELECT 
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date
    FROM price_history
    WHERE (item_id, date) IN (
        SELECT item_id, MAX(date)
        FROM price_history
        GROUP BY item_id
    )
)
SELECT
    i.item_id,
    i.hebrew_description,
    i.english_description,
    i.import_markup,
    i.hs_code,
    i.image,
    i.notes,
    i.origin,
    i.last_updated,
    p.ils_retail_price as retail_price,
    p.qty_in_stock as current_stock,
    p.qty_sold_this_year as current_year_sales,
    p.qty_sold_last_year as last_year_sales,
    p.date as last_price_update
FROM item i
LEFT JOIN latest_price p ON i.item_id = p.item_id;
```

## Performance Optimizations

### Indexes
```sql
-- Item Files
CREATE INDEX idx_item_files_item ON item_files(item_id);
CREATE INDEX idx_item_files_type ON item_files(file_type);

-- Inquiry Items
CREATE INDEX idx_inquiry_item_inquiry ON inquiry_item(inquiry_id);
CREATE INDEX idx_inquiry_item_item ON inquiry_item(item_id);
CREATE INDEX idx_inquiry_item_original ON inquiry_item(original_item_id);
CREATE INDEX idx_inquiry_item_reference ON inquiry_item(new_reference_id);

-- Price History
CREATE INDEX idx_price_history_item ON price_history(item_id);
CREATE INDEX idx_price_history_date ON price_history(date);

-- Supplier Response
CREATE INDEX idx_supplier_response_inquiry ON supplier_response(inquiry_id);
CREATE INDEX idx_supplier_response_supplier ON supplier_response(supplier_id);
CREATE INDEX idx_supplier_response_item ON supplier_response(item_id);
CREATE INDEX idx_supplier_response_date ON supplier_response(response_date);

-- Order Management
CREATE INDEX idx_order_inquiry ON "order"(inquiry_id);
CREATE INDEX idx_order_supplier ON "order"(supplier_id);
CREATE INDEX idx_order_date ON "order"(order_date);
CREATE INDEX idx_order_status ON "order"(status);

CREATE INDEX idx_order_item_order ON order_item(order_id);
CREATE INDEX idx_order_item_item ON order_item(item_id);
CREATE INDEX idx_order_item_inquiry ON order_item(inquiry_item_id);

-- Promotions
CREATE INDEX idx_promotion_supplier ON promotion(supplier_id);
CREATE INDEX idx_promotion_dates ON promotion(start_date, end_date);
CREATE INDEX idx_promotion_active ON promotion(is_active);

CREATE INDEX idx_promotion_item_promotion ON promotion_item(promotion_id);
CREATE INDEX idx_promotion_item_item ON promotion_item(item_id);
```

## Database Triggers

### update_item_timestamp
```sql
CREATE TRIGGER update_item_timestamp
AFTER UPDATE ON item
BEGIN
    UPDATE item 
    SET last_updated = CURRENT_TIMESTAMP
    WHERE item_id = NEW.item_id;
END;
```

### update_price_history_on_inquiry
```sql
CREATE TRIGGER update_price_history_on_inquiry
AFTER INSERT ON inquiry_item
WHEN NEW.retail_price IS NOT NULL
BEGIN
    INSERT INTO price_history (
        item_id,
        ils_retail_price,
        qty_in_stock,
        qty_sold_this_year,
        qty_sold_last_year,
        date
    )
    VALUES (
        NEW.item_id,
        NEW.retail_price,
        NEW.qty_in_stock,
        NEW.sold_this_year,
        NEW.sold_last_year,
        (SELECT date FROM inquiry WHERE inquiry_id = NEW.inquiry_id)
    );
END;
```

### prevent_self_reference
```sql
CREATE TRIGGER prevent_self_reference
BEFORE INSERT ON inquiry_item
WHEN NEW.item_id = NEW.new_reference_id
BEGIN
    SELECT RAISE(ABORT, 'Cannot reference an item to itself');
END;
