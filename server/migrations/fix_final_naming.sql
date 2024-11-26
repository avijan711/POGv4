-- Begin transaction
BEGIN TRANSACTION;

-- Rename supplierX to supplier
ALTER TABLE supplierX RENAME TO supplier;

-- Verify changes
SELECT 'Current tables:';
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Commit transaction
COMMIT;
