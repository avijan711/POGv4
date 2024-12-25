-- Fix debug settings to use proper boolean values
UPDATE settings 
SET value = json_object(
  'general', CASE WHEN json_extract(value, '$.general') IN (1, '1', 'true') THEN 'true' ELSE 'false' END,
  'errors', CASE WHEN json_extract(value, '$.errors') IN (1, '1', 'true') THEN 'true' ELSE 'false' END,
  'database', CASE WHEN json_extract(value, '$.database') IN (1, '1', 'true') THEN 'true' ELSE 'false' END,
  'performance', CASE WHEN json_extract(value, '$.performance') IN (1, '1', 'true') THEN 'true' ELSE 'false' END,
  'routes', CASE WHEN json_extract(value, '$.routes') IN (1, '1', 'true') THEN 'true' ELSE 'false' END,
  'middleware', CASE WHEN json_extract(value, '$.middleware') IN (1, '1', 'true') THEN 'true' ELSE 'false' END
)
WHERE key = 'debug';