const getBestSupplierPricesQuery = `
    WITH inquiry_items AS (
        -- Get all items from the inquiry
        SELECT 
            ii.item_id,
            COALESCE(ii.original_item_id, ii.item_id) as original_item_id,
            ii.inquiry_item_id,
            ii.requested_qty,
            ii.hebrew_description as inquiry_description,
            i.hebrew_description as item_description,
            i.english_description as item_english_description,
            i.import_markup as default_import_markup,
            ii.retail_price as current_retail_price
        FROM inquiry_item ii
        LEFT JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    ),
    active_promotions AS (
        -- Get active promotion prices
        SELECT 
            pi.item_id,
            p.supplier_id,
            pi.promotion_price as price_quoted,
            p.name as promotion_name,
            s.name as supplier_name,
            1 as is_promotion,
            p.promotion_id as promotion_group_id
        FROM promotion p
        JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
        JOIN supplier s ON p.supplier_id = s.supplier_id
        WHERE p.is_active = 1
        AND CURRENT_DATE BETWEEN date(p.start_date) AND date(p.end_date)
    ),
    supplier_responses AS (
        -- Get regular supplier responses
        SELECT 
            sr.item_id,
            sr.supplier_id,
            sr.price_quoted,
            sr.inquiry_id,
            sr.is_promotion,
            sr.promotion_name,
            s.name as supplier_name,
            NULL as promotion_group_id
        FROM supplier_response sr
        JOIN supplier s ON sr.supplier_id = s.supplier_id
        JOIN inquiry_items ii ON (
            sr.item_id = ii.item_id 
            OR sr.item_id = ii.original_item_id
        )
        WHERE sr.status = 'active'
        AND sr.inquiry_id = ?
    ),
    all_prices AS (
        -- Combine promotion prices and regular responses
        SELECT * FROM supplier_responses
        UNION ALL
        SELECT 
            item_id,
            supplier_id,
            price_quoted,
            ? as inquiry_id,
            is_promotion,
            promotion_name,
            supplier_name,
            promotion_group_id
        FROM active_promotions
    ),
    best_prices AS (
        -- Get best price per item/supplier
        SELECT 
            item_id,
            supplier_id,
            price_quoted,
            inquiry_id,
            is_promotion,
            promotion_name,
            supplier_name,
            promotion_group_id,
            ROW_NUMBER() OVER (
                PARTITION BY item_id, supplier_id 
                ORDER BY price_quoted ASC
            ) as rn
        FROM all_prices
    )
    SELECT 
        ii.item_id as ItemID,
        ii.inquiry_item_id as InquiryItemID,
        ii.requested_qty as RequestedQty,
        bp.supplier_id as SupplierID,
        bp.price_quoted as PriceQuoted,
        COALESCE(ii.default_import_markup, 1.3) as ImportMarkup,
        ii.current_retail_price as RetailPrice,
        COALESCE(ii.inquiry_description, ii.item_description) as HebrewDescription,
        ii.item_english_description as EnglishDescription,
        bp.supplier_name as SupplierName,
        bp.is_promotion as IsPromotion,
        bp.promotion_name as PromotionName,
        bp.promotion_group_id as PromotionGroupID
    FROM inquiry_items ii
    LEFT JOIN best_prices bp ON (
        (ii.item_id = bp.item_id OR ii.original_item_id = bp.item_id)
        AND bp.rn = 1
    )
    ORDER BY ii.item_id, bp.price_quoted ASC;
`;

// Debug query to check inquiry items
const debugInquiryItemsQuery = `
    SELECT 
        ii.item_id,
        ii.original_item_id,
        ii.inquiry_item_id,
        ii.requested_qty,
        ii.hebrew_description as inquiry_description,
        i.hebrew_description as item_description,
        ii.retail_price
    FROM inquiry_item ii
    JOIN item i ON ii.item_id = i.item_id
    WHERE ii.inquiry_id = ?;
`;

// Debug query to check supplier prices
const debugSupplierPricesQuery = `
    SELECT 
        sr.*,
        s.name as supplier_name,
        i.hebrew_description as item_description,
        i.english_description as item_english_description,
        ii.retail_price,
        p.name as promotion_name,
        p.promotion_id as promotion_group_id,
        pi.promotion_price
    FROM supplier_response sr
    JOIN supplier s ON sr.supplier_id = s.supplier_id
    JOIN item i ON sr.item_id = i.item_id
    LEFT JOIN inquiry_item ii ON sr.item_id = ii.item_id
    LEFT JOIN promotion p ON sr.supplier_id = p.supplier_id
    LEFT JOIN promotion_item pi ON (
        p.promotion_id = pi.promotion_id 
        AND sr.item_id = pi.item_id
    )
    WHERE sr.item_id = ? 
    AND sr.status = 'active'
    AND (
        p.is_active IS NULL 
        OR (
            p.is_active = 1 
            AND CURRENT_DATE BETWEEN date(p.start_date) AND date(p.end_date)
        )
    )
    ORDER BY sr.response_date DESC;
`;

// Debug query to check item references
const debugItemReferencesQuery = `
    SELECT 
        ii.item_id,
        ii.original_item_id,
        sr.item_id as supplier_price_item_id,
        sr.price_quoted,
        sr.response_date,
        sr.is_promotion,
        sr.promotion_name,
        ii.retail_price
    FROM inquiry_item ii
    LEFT JOIN supplier_response sr ON (
        sr.item_id = ii.item_id 
        OR sr.item_id = ii.original_item_id
    )
    WHERE ii.inquiry_id = ? AND sr.status = 'active';
`;

module.exports = {
  getBestSupplierPricesQuery,
  debugInquiryItemsQuery,
  debugSupplierPricesQuery,
  debugItemReferencesQuery,
};
