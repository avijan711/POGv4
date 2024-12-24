const getReplacementsQuery = `
    WITH RECURSIVE inquiry_items AS (
        -- Get all items from the inquiry
        SELECT 
            ii.item_id,
            COALESCE(ii.original_item_id, ii.item_id) as original_item_id,
            ii.inquiry_item_id,
            0 as level,
            ii.hebrew_description as inquiry_description,
            i.hebrew_description as item_description,
            i.english_description as item_english_description
        FROM inquiry_item ii
        JOIN item i ON ii.item_id = i.item_id
        WHERE ii.inquiry_id = ?
    ),
    reference_changes AS (
        -- Get all reference changes for inquiry items
        SELECT 
            rc.original_item_id,
            rc.new_reference_id,
            rc.changed_by_user,
            rc.change_date,
            rc.notes,
            rc.supplier_id,
            s.name as supplier_name,
            i_orig.hebrew_description as original_description,
            i_orig.english_description as original_english_description,
            i_new.hebrew_description as new_description,
            i_new.english_description as new_english_description,
            ROW_NUMBER() OVER (
                PARTITION BY rc.original_item_id 
                ORDER BY rc.change_date DESC
            ) as rn
        FROM item_reference_change rc
        JOIN item i_orig ON rc.original_item_id = i_orig.item_id
        JOIN item i_new ON rc.new_reference_id = i_new.item_id
        LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
    )
    SELECT 
        ii.item_id as original_item_id,
        rc.new_reference_id as new_item_id,
        CASE 
            WHEN rc.supplier_id IS NOT NULL THEN 'supplier'
            WHEN rc.changed_by_user = 1 THEN 'user'
            ELSE NULL
        END as source,
        rc.supplier_name,
        rc.notes as description,
        rc.change_date,
        COALESCE(rc.original_description, ii.item_description) as original_description,
        COALESCE(rc.original_english_description, ii.item_english_description) as original_english_description,
        rc.new_description,
        rc.new_english_description,
        ii.inquiry_description
    FROM inquiry_items ii
    JOIN reference_changes rc ON (
        ii.item_id = rc.original_item_id 
        OR ii.original_item_id = rc.original_item_id
    )
    AND rc.rn = 1
    ORDER BY rc.change_date DESC;
`;

// Debug query to check item references
const debugItemReferencesQuery = `
    SELECT 
        ii.item_id,
        ii.original_item_id,
        ii.hebrew_description,
        rc.new_reference_id,
        rc.changed_by_user,
        rc.supplier_id,
        rc.notes,
        i_new.hebrew_description as new_description,
        i_new.english_description as new_english_description,
        i_orig.hebrew_description as original_description,
        i_orig.english_description as original_english_description
    FROM inquiry_item ii
    LEFT JOIN item_reference_change rc ON (
        ii.item_id = rc.original_item_id 
        OR ii.original_item_id = rc.original_item_id
    )
    LEFT JOIN item i_new ON rc.new_reference_id = i_new.item_id
    LEFT JOIN item i_orig ON rc.original_item_id = i_orig.item_id
    WHERE ii.inquiry_id = ?;
`;

// Add a query to check if an inquiry exists
const checkInquiryExistsQuery = `
    SELECT 1 FROM inquiry WHERE inquiry_id = ?;
`;

// Add a query to check specific item references
const checkItemReferencesQuery = `
    SELECT 
        rc.*,
        i_orig.hebrew_description as original_description,
        i_orig.english_description as original_english_description,
        i_new.hebrew_description as new_description,
        i_new.english_description as new_english_description,
        s.name as supplier_name
    FROM item_reference_change rc
    JOIN item i_orig ON rc.original_item_id = i_orig.item_id
    JOIN item i_new ON rc.new_reference_id = i_new.item_id
    LEFT JOIN supplier s ON rc.supplier_id = s.supplier_id
    WHERE rc.original_item_id = ? OR rc.new_reference_id = ?;
`;

module.exports = {
  getReplacementsQuery,
  debugItemReferencesQuery,
  checkInquiryExistsQuery,
  checkItemReferencesQuery,
};
