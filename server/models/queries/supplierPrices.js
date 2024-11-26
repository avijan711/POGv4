const getBestSupplierPricesQuery = `
    WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'supplier_price'
        ) as has_supplier_price
    ),
    inquiry_items AS (
        -- Get all items from the inquiry
        SELECT 
            ii.item_id,
            COALESCE(ii.original_item_id, ii.item_id) as original_item_id,
            ii.inquiry_item_id,
            ii.requested_qty,
            ii.hebrew_description as inquiry_description,
            i.hebrew_description as item_description,
            i.english_description as item_english_description
        FROM inquiry_item ii
        JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    ),
    supplier_prices AS (
        -- Get all supplier prices for inquiry items
        SELECT 
            sp.item_id,
            sp.supplier_id,
            sp.price_quoted,
            sp.import_markup,
            sp.retail_price,
            sp.hebrew_description,
            sp.english_description,
            s.name as supplier_name,
            ROW_NUMBER() OVER (
                PARTITION BY sp.item_id, sp.supplier_id 
                ORDER BY sp.last_updated DESC
            ) as rn
        FROM check_tables ct
        CROSS JOIN (SELECT 1) params
        LEFT JOIN supplier_price sp ON ct.has_supplier_price = 1
        LEFT JOIN supplier s ON sp.supplier_id = s.supplier_id
        WHERE ct.has_supplier_price = 0 OR EXISTS (
            SELECT 1 
            FROM inquiry_items ii 
            WHERE sp.item_id = ii.item_id
            OR sp.item_id = ii.original_item_id
        )
    )
    SELECT 
        ii.item_id,
        ii.inquiry_item_id,
        ii.requested_qty,
        sp.supplier_id,
        sp.price_quoted,
        sp.import_markup,
        sp.retail_price,
        COALESCE(sp.hebrew_description, ii.item_description) as hebrew_description,
        COALESCE(sp.english_description, ii.item_english_description) as english_description,
        sp.supplier_name,
        0 as is_promotion
    FROM inquiry_items ii
    LEFT JOIN supplier_prices sp ON (
        ii.item_id = sp.item_id 
        OR ii.original_item_id = sp.item_id
    )
    AND sp.rn = 1
    WHERE sp.item_id IS NOT NULL
    ORDER BY ii.item_id, sp.price_quoted ASC;
`;

// Debug query to check inquiry items
const debugInquiryItemsQuery = `
    SELECT 
        ii.item_id,
        ii.original_item_id,
        ii.inquiry_item_id,
        ii.requested_qty,
        ii.hebrew_description as inquiry_description,
        i.hebrew_description as item_description
    FROM inquiry_item ii
    JOIN item i ON ii.item_id = i.item_id
    WHERE ii.inquiry_id = ?;
`;

// Debug query to check supplier prices
const debugSupplierPricesQuery = `
    WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'supplier_price'
        ) as has_supplier_price
    )
    SELECT 
        sp.*,
        s.name as supplier_name,
        i.hebrew_description as item_description,
        i.english_description as item_english_description
    FROM check_tables ct
    CROSS JOIN (SELECT ? as item_id) params
    LEFT JOIN supplier_price sp ON ct.has_supplier_price = 1
    LEFT JOIN supplier s ON sp.supplier_id = s.supplier_id
    LEFT JOIN item i ON sp.item_id = i.item_id
    WHERE ct.has_supplier_price = 0 OR sp.item_id = params.item_id
    ORDER BY sp.last_updated DESC;
`;

// Debug query to check item references
const debugItemReferencesQuery = `
    WITH check_tables AS (
        SELECT EXISTS (
            SELECT 1 FROM sqlite_master 
            WHERE type = 'table' AND name = 'supplier_price'
        ) as has_supplier_price
    )
    SELECT 
        ii.item_id,
        ii.original_item_id,
        sp.item_id as supplier_price_item_id,
        sp.price_quoted,
        sp.last_updated
    FROM inquiry_item ii
    CROSS JOIN check_tables ct
    LEFT JOIN supplier_price sp ON ct.has_supplier_price = 1 AND (
        sp.item_id = ii.item_id 
        OR sp.item_id = ii.original_item_id
    )
    WHERE ii.inquiry_id = ?;
`;

module.exports = {
    getBestSupplierPricesQuery,
    debugInquiryItemsQuery,
    debugSupplierPricesQuery,
    debugItemReferencesQuery
};
