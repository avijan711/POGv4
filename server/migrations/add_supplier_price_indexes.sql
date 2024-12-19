-- Add columns to supplier_response table if they don't exist
SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE supplier_response ADD COLUMN promotion_name TEXT'
END AS sql_statement
FROM pragma_table_info('supplier_response')
WHERE name = 'promotion_name';

SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE supplier_response ADD COLUMN is_promotion INTEGER DEFAULT 0'
END AS sql_statement
FROM pragma_table_info('supplier_response')
WHERE name = 'is_promotion';

SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE supplier_response ADD COLUMN price_quoted DECIMAL(10,2)'
END AS sql_statement
FROM pragma_table_info('supplier_response')
WHERE name = 'price_quoted';

SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE supplier_response ADD COLUMN status TEXT DEFAULT ''active'''
END AS sql_statement
FROM pragma_table_info('supplier_response')
WHERE name = 'status';
