-- Add indexes for commonly accessed columns
CREATE INDEX IF NOT EXISTS idx_response_stats_supplier_date ON ResponseStats(SupplierID, ResponseDate);
CREATE INDEX IF NOT EXISTS idx_response_stats_item_status ON ResponseStats(ItemStatus, SupplierID, ResponseDate);
CREATE INDEX IF NOT EXISTS idx_supplier_response_date ON SupplierResponse(ResponseDate, SupplierID);
CREATE INDEX IF NOT EXISTS idx_missing_items_supplier_date ON MissingItems(SupplierID, ResponseDate);

-- Create materialized view for supplier stats to avoid recalculation
CREATE VIEW IF NOT EXISTS vw_supplier_response_stats AS
SELECT 
    SupplierID,
    date(ResponseDate) as response_date,
    COUNT(DISTINCT ResponseItemID) as TotalCount,
    SUM(CASE WHEN ItemStatus = 'extra' THEN 1 ELSE 0 END) as ExtraCount,
    SUM(CASE WHEN ItemStatus = 'replacement' THEN 1 ELSE 0 END) as ReplacementCount
FROM ResponseStats
GROUP BY SupplierID, date(ResponseDate);

-- Create view for basic supplier response info
CREATE VIEW IF NOT EXISTS vw_supplier_response_basic AS
SELECT 
    date(rs.ResponseDate) as date,
    rs.SupplierID as supplierId,
    s.Name as supplierName,
    ss.TotalCount as itemCount,
    ss.ExtraCount as extraItemsCount,
    ss.ReplacementCount as replacementsCount,
    (
        SELECT COUNT(DISTINCT ItemID)
        FROM MissingItems mi
        WHERE mi.SupplierID = rs.SupplierID
        AND date(mi.ResponseDate) = date(rs.ResponseDate)
    ) as missingItemsCount
FROM ResponseStats rs
JOIN Supplier s ON rs.SupplierID = s.SupplierID
JOIN vw_supplier_response_stats ss 
    ON rs.SupplierID = ss.SupplierID 
    AND date(rs.ResponseDate) = ss.response_date
GROUP BY date(rs.ResponseDate), rs.SupplierID, s.Name;
