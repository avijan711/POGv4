-- Create order_fulfillment table
CREATE TABLE IF NOT EXISTS order_fulfillment (
    fulfillment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    order_item_id INTEGER NOT NULL,
    quantity_supplied INTEGER NOT NULL CHECK (quantity_supplied > 0),
    fulfillment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES "order"(order_id) ON DELETE CASCADE,
    FOREIGN KEY (order_item_id) REFERENCES order_item(order_item_id) ON DELETE CASCADE
);

-- Add new columns to order_item table
ALTER TABLE order_item
ADD COLUMN supplied_quantity INTEGER NOT NULL DEFAULT 0
CHECK (supplied_quantity >= 0);

ALTER TABLE order_item
ADD COLUMN remaining_quantity INTEGER NOT NULL DEFAULT 0
CHECK (remaining_quantity >= 0);

ALTER TABLE order_item
ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'pending'
CHECK (fulfillment_status IN ('pending', 'partial', 'fulfilled', 'cancelled'));

-- Create indexes for performance
CREATE INDEX idx_order_fulfillment_order ON order_fulfillment(order_id);
CREATE INDEX idx_order_fulfillment_item ON order_fulfillment(order_item_id);
CREATE INDEX idx_order_fulfillment_date ON order_fulfillment(fulfillment_date);

-- Create trigger to update order_item quantities
CREATE TRIGGER update_order_item_quantities
AFTER INSERT ON order_fulfillment
BEGIN
    UPDATE order_item
    SET 
        supplied_quantity = supplied_quantity + NEW.quantity_supplied,
        remaining_quantity = quantity - (supplied_quantity + NEW.quantity_supplied),
        fulfillment_status = CASE
            WHEN quantity = (supplied_quantity + NEW.quantity_supplied) THEN 'fulfilled'
            ELSE 'partial'
        END
    WHERE order_item_id = NEW.order_item_id;
END;

-- Create trigger to initialize remaining_quantity
CREATE TRIGGER initialize_remaining_quantity
AFTER INSERT ON order_item
BEGIN
    UPDATE order_item
    SET remaining_quantity = quantity
    WHERE order_item_id = NEW.order_item_id;
END;

-- Create trigger to prevent over-fulfillment
CREATE TRIGGER prevent_over_fulfillment
BEFORE INSERT ON order_fulfillment
BEGIN
    SELECT RAISE(ABORT, 'Cannot supply more than ordered quantity')
    WHERE (
        SELECT supplied_quantity + NEW.quantity_supplied
        FROM order_item
        WHERE order_item_id = NEW.order_item_id
    ) > (
        SELECT quantity
        FROM order_item
        WHERE order_item_id = NEW.order_item_id
    );
END;

-- Create view for order fulfillment status
CREATE VIEW order_fulfillment_status AS
SELECT 
    o.order_id,
    o.supplier_id,
    o.status as order_status,
    oi.order_item_id,
    oi.item_id,
    oi.quantity as ordered_quantity,
    oi.supplied_quantity,
    oi.remaining_quantity,
    oi.fulfillment_status,
    oi.price_quoted,
    (
        SELECT GROUP_CONCAT(
            json_object(
                'fulfillment_id', f.fulfillment_id,
                'quantity_supplied', f.quantity_supplied,
                'fulfillment_date', f.fulfillment_date,
                'notes', f.notes
            )
        )
        FROM order_fulfillment f
        WHERE f.order_item_id = oi.order_item_id
        ORDER BY f.fulfillment_date DESC
    ) as fulfillment_history
FROM "order" o
JOIN order_item oi ON o.order_id = oi.order_id;