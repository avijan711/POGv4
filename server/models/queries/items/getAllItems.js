module.exports = `
    WITH latest_history AS (
        SELECT
            ph.item_id,
            ph.ils_retail_price,
            ph.qty_in_stock,
            ph.sold_this_year,
            ph.sold_last_year,
            ph.date as history_date
        FROM price_history ph
        INNER JOIN (
            SELECT item_id, MAX(date) as max_date
            FROM price_history
            GROUP BY item_id
        ) latest ON ph.item_id = latest.item_id AND ph.date = latest.max_date
    ),
    latest_inquiry_dates AS (
        SELECT 
            ii2.item_id,
            MAX(i2.date) as max_date
        FROM inquiry_item ii2
        JOIN inquiry i2 ON ii2.inquiry_id = i2.inquiry_id
        WHERE i2.status = 'new'
        GROUP BY ii2.item_id
    ),
    latest_inquiry_items AS (
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
        JOIN latest_inquiry_dates lid ON ii.item_id = lid.item_id AND i.date = lid.max_date
        WHERE i.status = 'new'
    ),
    base_items AS (
        -- Get items from item table with latest updates
        SELECT
            i.item_id,
            COALESCE(li.hebrew_description, i.hebrew_description) as hebrew_description,
            COALESCE(li.english_description, i.english_description, '') as english_description,
            COALESCE(CAST(li.import_markup AS REAL), CAST(i.import_markup AS REAL), 1.30) as import_markup,
            COALESCE(li.hs_code, i.hs_code, '') as hs_code,
            COALESCE(li.origin, i.origin, '') as origin,
            i.image,
            COALESCE(li.retail_price, h.ils_retail_price) as retail_price,
            COALESCE(li.qty_in_stock, h.qty_in_stock, 0) as qty_in_stock,
            COALESCE(li.sold_this_year, h.sold_this_year, 0) as sold_this_year,
            COALESCE(li.sold_last_year, h.sold_last_year, 0) as sold_last_year,
            COALESCE(li.inquiry_date, h.history_date) as last_updated,
            COALESCE(li.new_reference_id, NULL) as new_reference_id,
            COALESCE(li.reference_notes, NULL) as reference_notes
        FROM item i
        LEFT JOIN latest_history h ON i.item_id = h.item_id
        LEFT JOIN latest_inquiry_items li ON i.item_id = li.item_id

        UNION

        -- Get new items from inquiry_item that don't exist in item table
        SELECT
            li.item_id,
            li.hebrew_description,
            COALESCE(li.english_description, '') as english_description,
            COALESCE(CAST(li.import_markup AS REAL), 1.30) as import_markup,
            COALESCE(li.hs_code, '') as hs_code,
            COALESCE(li.origin, '') as origin,
            NULL as image,
            li.retail_price,
            COALESCE(li.qty_in_stock, 0) as qty_in_stock,
            COALESCE(li.sold_this_year, 0) as sold_this_year,
            COALESCE(li.sold_last_year, 0) as sold_last_year,
            li.inquiry_date as last_updated,
            NULL as new_reference_id,
            NULL as reference_notes
        FROM latest_inquiry_items li
        WHERE li.item_id NOT IN (SELECT item_id FROM item)
    ),
    latest_reference_changes AS (
        SELECT
            original_item_id,
            new_reference_id,
            changed_by_user,
            change_date,
            notes,
            supplier_id
        FROM item_reference_change irc1
        WHERE change_date = (
            SELECT MAX(change_date)
            FROM item_reference_change irc2
            WHERE irc2.original_item_id = irc1.original_item_id
        )
    ),
    referencing_items AS (
        SELECT 
            rc.new_reference_id as item_id,
            json_group_array(
                CASE 
                    WHEN rc.original_item_id != rc.new_reference_id THEN
                        json_object(
                            'item_id', rc.original_item_id,
                            'hebrew_description', i.hebrew_description,
                            'english_description', i.english_description,
                            'changed_by_user', rc.changed_by_user,
                            'change_date', rc.change_date,
                            'notes', rc.notes,
                            'supplier_name', s.name,
                            'source', CASE
                                WHEN rc.supplier_id IS NOT NULL THEN 'supplier'
                                WHEN rc.changed_by_user = 1 THEN 'user'
                                ELSE NULL
                            END
                        )
                    ELSE NULL
                END
            ) as referencing_items_array
        FROM item_reference_change rc
        LEFT JOIN item i ON rc.original_item_id = i.item_id
        LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
        GROUP BY rc.new_reference_id
    )
    SELECT DISTINCT
        i.item_id,
        i.hebrew_description,
        i.english_description,
        i.import_markup,
        i.hs_code,
        i.origin,
        i.image,
        i.retail_price,
        i.qty_in_stock,
        i.sold_this_year,
        i.sold_last_year,
        i.last_updated,
        CASE
            WHEN (rc1.new_reference_id IS NOT NULL AND rc1.new_reference_id != i.item_id) 
                 OR (i.new_reference_id IS NOT NULL AND i.new_reference_id != i.item_id) 
            THEN json_object(
                'new_reference_id', COALESCE(rc1.new_reference_id, i.new_reference_id),
                'changed_by_user', COALESCE(rc1.changed_by_user, 1),
                'change_date', COALESCE(rc1.change_date, i.last_updated),
                'notes', COALESCE(rc1.notes, i.reference_notes),
                'supplier_name', s1.name,
                'source', CASE
                    WHEN rc1.supplier_id IS NOT NULL THEN 'supplier'
                    WHEN rc1.changed_by_user = 1 OR i.new_reference_id IS NOT NULL THEN 'user'
                    ELSE NULL
                END
            )
            ELSE NULL
        END as reference_change,
        COALESCE(ri.referencing_items_array, '[]') as referencing_items,
        CASE 
            WHEN (rc1.new_reference_id IS NOT NULL AND rc1.new_reference_id != i.item_id) 
                 OR (i.new_reference_id IS NOT NULL AND i.new_reference_id != i.item_id) 
            THEN 1
            ELSE 0
        END as has_reference_change,
        CASE 
            WHEN ri.referencing_items_array IS NOT NULL AND ri.referencing_items_array != '[null]' THEN 1
            ELSE 0
        END as is_referenced_by
    FROM base_items i
    LEFT JOIN latest_reference_changes rc1 ON i.item_id = rc1.original_item_id
    LEFT JOIN referencing_items ri ON i.item_id = ri.item_id
    LEFT JOIN supplier s1 ON rc1.supplier_id = s1.supplier_id
    ORDER BY i.item_id`;
