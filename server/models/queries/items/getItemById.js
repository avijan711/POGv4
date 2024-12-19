module.exports = `
    WITH latest_inquiry_items AS (
        SELECT
            ii.item_id,
            ii.hebrew_description,
            ii.english_description,
            ii.import_markup,
            ii.hs_code,
            ii.retail_price,
            ii.qty_in_stock,
            ii.sold_this_year,
            ii.sold_last_year,
            i.date as inquiry_date,
            ii.new_reference_id,
            ii.reference_notes,
            ii.origin
        FROM inquiry_item ii
        JOIN inquiry i ON ii.inquiry_id = i.inquiry_id
        WHERE i.status = 'new'
        AND ii.item_id = ?
        AND i.date = (
            SELECT MAX(i2.date)
            FROM inquiry_item ii2
            JOIN inquiry i2 ON ii2.inquiry_id = i2.inquiry_id
            WHERE ii2.item_id = ii.item_id
            AND i2.status = 'new'
        )
    ),
    latest_history AS (
        SELECT
            ph.item_id,
            ph.ils_retail_price,
            ph.qty_in_stock,
            ph.sold_this_year,
            ph.sold_last_year,
            ph.date as history_date
        FROM price_history ph
        WHERE ph.item_id = ?
        AND ph.date = (
            SELECT MAX(date)
            FROM price_history
            WHERE item_id = ph.item_id
        )
    ),
    price_history_data AS (
        SELECT
            ph.item_id,
            ph.date,
            ph.ils_retail_price,
            ph.qty_in_stock,
            ph.sold_this_year,
            ph.sold_last_year
        FROM price_history ph
        WHERE ph.item_id = ?
        ORDER BY ph.date DESC
    ),
    supplier_price_data AS (
        SELECT DISTINCT
            sri.item_id,
            s.name as supplierName,
            s.supplier_id,
            sri.price as priceQuoted,
            sr.response_date as lastUpdated,
            COALESCE(sr.is_promotion, 0) as isPromotion,
            sr.promotion_name as promotionName,
            COALESCE(sr.status, 'active') as status,
            sri.notes,
            sri.hs_code,
            sri.english_description,
            sri.origin,
            sri.new_reference_id
        FROM supplier_response_item sri
        JOIN supplier_response sr ON sri.supplier_response_id = sr.supplier_response_id
        JOIN supplier s ON sr.supplier_id = s.supplier_id
        WHERE sri.item_id = ?
        AND sr.status != 'deleted'
        AND sri.price IS NOT NULL
        GROUP BY sri.item_id, s.name, s.supplier_id, sri.price, sr.response_date, sr.is_promotion, sr.promotion_name, sr.status, sri.notes, sri.hs_code, sri.english_description, sri.origin, sri.new_reference_id
        ORDER BY sr.response_date DESC
    ),
    promotion_data AS (
        SELECT
            pi.item_id,
            p.promotion_id as id,
            p.name,
            s.name as supplier_name,
            p.supplier_id,
            p.start_date,
            p.end_date,
            p.is_active,
            p.created_at,
            pi.promotion_price as price
        FROM promotion p
        JOIN promotion_item pi ON p.promotion_id = pi.promotion_id
        JOIN supplier s ON p.supplier_id = s.supplier_id
        WHERE pi.item_id = ?
        AND p.is_active = 1
        ORDER BY p.created_at DESC
    ),
    base_items AS (
        -- Get items from Item table with latest updates
        SELECT
            i.item_id,
            COALESCE(li.hebrew_description, i.hebrew_description) as hebrew_description,
            COALESCE(li.english_description, i.english_description, '') as english_description,
            COALESCE(CAST(li.import_markup AS REAL), CAST(i.import_markup AS REAL), 1.30) as import_markup,
            COALESCE(li.hs_code, i.hs_code, '') as hs_code,
            COALESCE(li.origin, i.origin, '') as origin,
            i.image,
            i.notes,
            COALESCE(li.retail_price, h.ils_retail_price) as retail_price,
            COALESCE(li.qty_in_stock, h.qty_in_stock, 0) as qty_in_stock,
            COALESCE(li.sold_this_year, h.sold_this_year, 0) as sold_this_year,
            COALESCE(li.sold_last_year, h.sold_last_year, 0) as sold_last_year,
            COALESCE(li.inquiry_date, h.history_date) as last_updated,
            li.new_reference_id,
            li.reference_notes
        FROM item i
        LEFT JOIN latest_history h ON i.item_id = h.item_id
        LEFT JOIN latest_inquiry_items li ON i.item_id = li.item_id
        WHERE i.item_id = ?
    ),
    latest_references AS (
        SELECT
            ii.item_id,
            ii.new_reference_id,
            ii.reference_notes,
            i.date as change_date,
            s.supplier_id,
            s.name as supplier_name,
            sr.status as supplier_status
        FROM inquiry_item ii
        JOIN inquiry i ON ii.inquiry_id = i.inquiry_id
        LEFT JOIN supplier_response sr ON ii.inquiry_id = sr.inquiry_id AND ii.item_id = sr.item_id
        LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
        WHERE ii.new_reference_id IS NOT NULL
        AND ii.item_id = ?
        AND i.date = (
            SELECT MAX(i2.date)
            FROM inquiry_item ii2
            JOIN inquiry i2 ON ii2.inquiry_id = i2.inquiry_id
            WHERE ii2.item_id = ii.item_id
            AND ii2.new_reference_id IS NOT NULL
        )
    ),
    referencing_items AS (
        SELECT 
            ii.new_reference_id as item_id,
            json_group_array(
                CASE 
                    WHEN ii.item_id != ii.new_reference_id THEN
                        json_object(
                            'item_id', ii.item_id,
                            'hebrew_description', i2.hebrew_description,
                            'english_description', i2.english_description,
                            'change_date', inq.date,
                            'notes', ii.reference_notes,
                            'supplier_name', s.name,
                            'source', CASE
                                WHEN sr.supplier_id IS NOT NULL THEN 'supplier'
                                ELSE 'user'
                            END
                        )
                    ELSE NULL
                END
            ) as referencing_items_array
        FROM inquiry_item ii
        JOIN inquiry inq ON ii.inquiry_id = inq.inquiry_id
        LEFT JOIN item i2 ON ii.item_id = i2.item_id
        LEFT JOIN supplier_response sr ON ii.inquiry_id = sr.inquiry_id AND ii.item_id = sr.item_id
        LEFT JOIN supplier s ON sr.supplier_id = s.supplier_id
        WHERE ii.new_reference_id = ?
        GROUP BY ii.new_reference_id
    )
    SELECT DISTINCT
        i.item_id,
        i.hebrew_description,
        i.english_description,
        i.import_markup,
        i.hs_code,
        i.origin,
        i.image,
        i.notes,
        COALESCE(ph.ils_retail_price, li.retail_price) as retail_price,
        COALESCE(ph.qty_in_stock, li.qty_in_stock, 0) as qty_in_stock,
        COALESCE(ph.sold_this_year, li.sold_this_year, 0) as sold_this_year,
        COALESCE(ph.sold_last_year, li.sold_last_year, 0) as sold_last_year,
        COALESCE(ph.date, li.inquiry_date) as last_price_update,
        lr.new_reference_id as reference_id,
        lr.reference_notes,
        lr.change_date as reference_change_date,
        lr.supplier_name as reference_supplier,
        CASE 
            WHEN lr.new_reference_id IS NOT NULL THEN 1
            ELSE 0
        END as has_reference_change,
        CASE
            WHEN ri.referencing_items_array != '[]' 
            AND ri.referencing_items_array != '[null]' THEN 1
            ELSE 0
        END as is_referenced_by,
        COALESCE(
            json_group_array(
                json_object(
                    'date', ph.date,
                    'price', ph.ils_retail_price,
                    'stock', ph.qty_in_stock
                )
            ) FILTER (WHERE ph.item_id IS NOT NULL),
            '[]'
        ) as price_history,
        COALESCE(
            json_group_array(
                json_object(
                    'supplierName', sp.supplierName,
                    'lastUpdated', sp.lastUpdated,
                    'priceQuoted', sp.priceQuoted,
                    'isPromotion', sp.isPromotion,
                    'promotionName', sp.promotionName,
                    'status', sp.status,
                    'notes', sp.notes,
                    'hs_code', sp.hs_code,
                    'english_description', sp.english_description,
                    'origin', sp.origin,
                    'new_reference_id', sp.new_reference_id
                )
            ) FILTER (WHERE sp.item_id IS NOT NULL),
            '[]'
        ) as supplier_prices,
        COALESCE(
            json_group_array(
                json_object(
                    'id', p.id,
                    'name', p.name,
                    'supplier_name', p.supplier_name,
                    'supplier_id', p.supplier_id,
                    'start_date', p.start_date,
                    'end_date', p.end_date,
                    'is_active', p.is_active,
                    'created_at', p.created_at,
                    'price', p.price
                )
            ) FILTER (WHERE p.item_id IS NOT NULL),
            '[]'
        ) as promotions
    FROM base_items i
    LEFT JOIN latest_references lr ON i.item_id = lr.item_id
    LEFT JOIN referencing_items ri ON i.item_id = ri.item_id
    LEFT JOIN price_history_data ph ON i.item_id = ph.item_id
    LEFT JOIN supplier_price_data sp ON i.item_id = sp.item_id
    LEFT JOIN latest_inquiry_items li ON i.item_id = li.item_id
    LEFT JOIN promotion_data p ON i.item_id = p.item_id
    GROUP BY i.item_id, ph.date, ph.ils_retail_price, ph.qty_in_stock
`;
