-- Add notes column to item table if it doesn't exist
SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE item ADD COLUMN notes TEXT'
END AS sql_statement
FROM pragma_table_info('item')
WHERE name = 'notes';
