function getSupplierStatsQuery() {
    return `SupplierStats AS (
        -- Calculate statistics per supplier
        SELECT 
            rs.SupplierID,
            rs.ResponseDate,
            COUNT(DISTINCT CASE WHEN rs.ItemStatus = 'extra' THEN rs.ResponseItemID END) as ExtraCount,
            COUNT(DISTINCT CASE WHEN rs.ItemStatus = 'replacement' THEN rs.ResponseItemID END) as ReplacementCount,
            COUNT(DISTINCT rs.ResponseItemID) as TotalCount
        FROM ResponseStats rs
        GROUP BY rs.SupplierID, rs.ResponseDate
    )`;
}

module.exports = {
    getSupplierStatsQuery
};
