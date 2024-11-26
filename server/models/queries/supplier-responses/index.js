const { getInquiryItemsQuery } = require('./inquiry-items');
const { getResponseStatsQuery } = require('./response-stats');
const { getSupplierStatsQuery } = require('./supplier-stats');
const { getMissingItemsQuery } = require('./missing-items');
const { getMainQuery } = require('./main-query');

function getSupplierResponsesQuery() {
    return {
        query: `
            WITH RECURSIVE 
            inquiry_items AS (
                SELECT DISTINCT 
                    ii.item_id,
                    i.hebrew_description,
                    i.english_description,
                    ii.requested_qty,
                    ii.retail_price
                FROM inquiry_item ii
                JOIN item i ON ii.item_id = i.item_id
                WHERE ii.inquiry_id = ?
            ),
            response_stats AS (
                SELECT DISTINCT
                    sr.item_id as response_item_id,
                    ii.item_id as inquiry_item_id,
                    irc.new_reference_id as replacement_id,
                    sr.supplier_id,
                    sr.response_date,
                    ii.hebrew_description,
                    ii.english_description,
                    ii.requested_qty,
                    ii.retail_price,
                    sr.price_quoted,
                    sr.status as response_status,
                    sr.supplier_response_id,
                    CASE
                        WHEN ii.item_id IS NULL THEN 'extra'
                        WHEN irc.new_reference_id IS NOT NULL THEN 'replacement'
                        ELSE 'matched'
                    END as item_status
                FROM supplier_response sr
                LEFT JOIN inquiry_items ii ON sr.item_id = ii.item_id
                LEFT JOIN item_reference_change irc ON sr.item_id = irc.original_item_id 
                    AND sr.supplier_id = irc.supplier_id
                    AND date(sr.response_date) = date(irc.change_date)
                WHERE sr.inquiry_id = ?
            ),
            supplier_stats AS (
                SELECT 
                    rs.supplier_id,
                    date(rs.response_date) as response_date,
                    COUNT(DISTINCT CASE WHEN rs.item_status = 'extra' THEN rs.response_item_id END) as extra_count,
                    COUNT(DISTINCT CASE WHEN rs.item_status = 'replacement' THEN rs.response_item_id END) as replacement_count,
                    COUNT(DISTINCT rs.response_item_id) as total_count
                FROM response_stats rs
                GROUP BY rs.supplier_id, date(rs.response_date)
            ),
            missing_items AS (
                SELECT DISTINCT
                    sr.supplier_id,
                    sr.response_date,
                    ii.item_id,
                    ii.hebrew_description,
                    ii.english_description,
                    ii.requested_qty,
                    ii.retail_price
                FROM inquiry_items ii
                CROSS JOIN (
                    SELECT DISTINCT supplier_id, response_date 
                    FROM response_stats
                ) sr
                WHERE NOT EXISTS (
                    SELECT 1 
                    FROM response_stats rs 
                    WHERE rs.response_item_id = ii.item_id
                    AND rs.supplier_id = sr.supplier_id
                    AND date(rs.response_date) = date(sr.response_date)
                )
            )
            SELECT 
                date(rs.response_date) as date,
                rs.supplier_id,
                s.name as supplier_name,
                ss.total_count as item_count,
                ss.extra_count as extra_items_count,
                ss.replacement_count as replacements_count,
                (
                    SELECT COUNT(DISTINCT item_id)
                    FROM missing_items mi
                    WHERE mi.supplier_id = rs.supplier_id
                    AND date(mi.response_date) = date(rs.response_date)
                ) as missing_items_count,
                json_group_array(
                    json_object(
                        'item_id', rs.response_item_id,
                        'hebrew_description', COALESCE(rs.hebrew_description, ''),
                        'english_description', COALESCE(rs.english_description, ''),
                        'requested_qty', COALESCE(rs.requested_qty, ''),
                        'retail_price', COALESCE(rs.retail_price, '')
                    )
                ) FILTER (WHERE rs.item_status = 'extra') as extra_items,
                json_group_array(
                    json_object(
                        'original', rs.response_item_id,
                        'replacement', rs.replacement_id,
                        'hebrew_description', COALESCE(rs.hebrew_description, ''),
                        'english_description', COALESCE(rs.english_description, ''),
                        'requested_qty', COALESCE(rs.requested_qty, ''),
                        'retail_price', COALESCE(rs.retail_price, '')
                    )
                ) FILTER (WHERE rs.item_status = 'replacement') as replacements,
                json_group_array(
                    json_object(
                        'item_id', rs.response_item_id,
                        'hebrew_description', COALESCE(rs.hebrew_description, ''),
                        'english_description', COALESCE(rs.english_description, ''),
                        'requested_qty', COALESCE(rs.requested_qty, ''),
                        'retail_price', COALESCE(rs.retail_price, '')
                    )
                ) FILTER (WHERE EXISTS (
                    SELECT 1 FROM missing_items mi 
                    WHERE mi.item_id = rs.response_item_id
                    AND mi.supplier_id = rs.supplier_id
                    AND date(mi.response_date) = date(rs.response_date)
                )) as missing_items,
                json_group_array(
                    CASE WHEN sr2.is_promotion = 1 
                    THEN sr2.promotion_name 
                    ELSE NULL END
                ) as debug_promotions,
                json_group_array(
                    json_object(
                        'item_id', rs.response_item_id,
                        'price_quoted', COALESCE(rs.price_quoted, ''),
                        'status', COALESCE(rs.response_status, ''),
                        'response_id', rs.supplier_response_id,
                        'hebrew_description', COALESCE(rs.hebrew_description, ''),
                        'english_description', COALESCE(rs.english_description, ''),
                        'item_type', rs.item_status,
                        'item_key', CASE 
                            WHEN rs.item_status = 'replacement' 
                            THEN 'ref-' || rs.response_item_id || '-' || rs.replacement_id
                            ELSE 'resp-' || rs.response_item_id
                        END
                    )
                ) as items
            FROM response_stats rs
            JOIN supplier s ON rs.supplier_id = s.supplier_id
            JOIN supplier_stats ss ON rs.supplier_id = ss.supplier_id 
                AND date(rs.response_date) = ss.response_date
            LEFT JOIN supplier_response sr2 ON rs.supplier_id = sr2.supplier_id 
                AND date(rs.response_date) = date(sr2.response_date)
            GROUP BY date(rs.response_date), rs.supplier_id, s.name
            ORDER BY rs.response_date DESC
            LIMIT ? OFFSET ?`,
        params: (inquiryId, page = 1, pageSize = 50) => {
            const offset = (page - 1) * pageSize;
            return [inquiryId, inquiryId, pageSize, offset];
        }
    };
}

module.exports = {
    getSupplierResponsesQuery
};
