-- Insert sample supplier
INSERT INTO supplier (name, contact_person, email, phone)
VALUES ('Test Supplier', 'John Doe', 'john@example.com', '123-456-7890');

-- Insert sample inquiry
INSERT INTO inquiry (inquiry_number, status, date)
VALUES ('INQ-2024-001', 'new', datetime('now'));

-- Get the inquiry_id and supplier_id
WITH inquiry_data AS (
    SELECT inquiry_id FROM inquiry WHERE inquiry_number = 'INQ-2024-001'
),
supplier_data AS (
    SELECT supplier_id FROM supplier WHERE name = 'Test Supplier'
)
-- Insert sample inquiry items from sample_inventory.xlsx
INSERT INTO inquiry_item (
    inquiry_id,
    item_id,
    original_item_id,
    hebrew_description,
    english_description,
    import_markup,
    hs_code,
    qty_in_stock,
    retail_price,
    sold_this_year,
    sold_last_year,
    requested_qty
)
VALUES 
    ((SELECT inquiry_id FROM inquiry_data), '012747', '012747', 'מח שמן פולי ג''מפי3', 'Oil Filter', 1.30, 'HS001', 45, 418.92, 120, 98, 5),
    ((SELECT inquiry_id FROM inquiry_data), '0209JS', '0209JS', 'סתם ראש ברלי3 מידה 1.45', 'Brake Head', 1.30, 'HS002', 85, 327.01, 85, 65, 3),
    ((SELECT inquiry_id FROM inquiry_data), '037989', '037989', 'שייבה לבורג 308 לטורבו X4', 'Washer', 1.10, 'HS003', 60, 39.67, 92, 78, 10),
    ((SELECT inquiry_id FROM inquiry_data), '0816F6', '0816F6', 'שרשרת קמשפט פיקC4 מנ DW10FD', 'Chain', 1.30, 'HS004', 180, 388.58, 156, 134, 2),
    ((SELECT inquiry_id FROM inquiry_data), '084930', '084930', 'מותח קמשפט פיקC4 לשרשר DW10FD', 'Tensioner', 1.30, 'HS005', 50, 580.35, 45, 32, 8);

-- Insert sample supplier responses
WITH inquiry_data AS (
    SELECT inquiry_id FROM inquiry WHERE inquiry_number = 'INQ-2024-001'
),
supplier_data AS (
    SELECT supplier_id FROM supplier WHERE name = 'Test Supplier'
)
INSERT INTO supplier_response (
    inquiry_id,
    supplier_id,
    item_id,
    price_quoted,
    status,
    response_date
)
SELECT 
    inquiry_id,
    (SELECT supplier_id FROM supplier_data),
    item_id,
    retail_price * 0.8, -- 20% discount
    'active',
    datetime('now')
FROM inquiry_item
WHERE inquiry_id = (SELECT inquiry_id FROM inquiry_data);

-- Insert supplier response items
WITH inquiry_data AS (
    SELECT inquiry_id FROM inquiry WHERE inquiry_number = 'INQ-2024-001'
),
supplier_data AS (
    SELECT supplier_id FROM supplier WHERE name = 'Test Supplier'
)
INSERT INTO supplier_response_item (
    supplier_response_id,
    item_id,
    price,
    notes,
    hs_code,
    english_description
)
SELECT 
    sr.supplier_response_id,
    sr.item_id,
    sr.price_quoted,
    'Sample response',
    ii.hs_code,
    ii.english_description
FROM supplier_response sr
JOIN inquiry_item ii ON sr.item_id = ii.item_id AND sr.inquiry_id = ii.inquiry_id
WHERE sr.inquiry_id = (SELECT inquiry_id FROM inquiry_data);
