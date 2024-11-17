const getReplacementsQuery = `
    WITH RECURSIVE InquiryItems AS (
        -- Get all items from the inquiry
        SELECT 
            ii.ItemID,
            COALESCE(ii.OriginalItemID, ii.ItemID) as OriginalItemID,
            ii.InquiryItemID,
            0 as Level,
            ii.HebrewDescription as InquiryDescription,
            i.HebrewDescription as ItemDescription,
            i.EnglishDescription as ItemEnglishDescription
        FROM InquiryItem ii
        JOIN Item i ON ii.ItemID = i.ItemID
        WHERE ii.InquiryID = ?
    ),
    ReferenceChanges AS (
        -- Get all reference changes for inquiry items
        SELECT 
            rc.OriginalItemID,
            rc.NewReferenceID,
            rc.ChangedByUser,
            rc.ChangeDate,
            rc.Notes,
            rc.SupplierID,
            s.Name as SupplierName,
            i_orig.HebrewDescription as OriginalDescription,
            i_orig.EnglishDescription as OriginalEnglishDescription,
            i_new.HebrewDescription as NewDescription,
            i_new.EnglishDescription as NewEnglishDescription,
            ROW_NUMBER() OVER (
                PARTITION BY rc.OriginalItemID 
                ORDER BY rc.ChangeDate DESC
            ) as rn
        FROM ItemReferenceChange rc
        JOIN Item i_orig ON rc.OriginalItemID = i_orig.ItemID
        JOIN Item i_new ON rc.NewReferenceID = i_new.ItemID
        LEFT JOIN Supplier s ON rc.SupplierID = s.SupplierID
    )
    SELECT 
        ii.ItemID as originalItemId,
        rc.NewReferenceID as newItemId,
        CASE 
            WHEN rc.SupplierID IS NOT NULL THEN 'supplier'
            WHEN rc.ChangedByUser = 1 THEN 'user'
            ELSE NULL
        END as source,
        rc.SupplierName as supplierName,
        rc.Notes as description,
        rc.ChangeDate as changeDate,
        COALESCE(rc.OriginalDescription, ii.ItemDescription) as originalDescription,
        COALESCE(rc.OriginalEnglishDescription, ii.ItemEnglishDescription) as originalEnglishDescription,
        rc.NewDescription as newDescription,
        rc.NewEnglishDescription as newEnglishDescription,
        ii.InquiryDescription as inquiryDescription
    FROM InquiryItems ii
    JOIN ReferenceChanges rc ON (
        ii.ItemID = rc.OriginalItemID 
        OR ii.OriginalItemID = rc.OriginalItemID
    )
    AND rc.rn = 1
    ORDER BY rc.ChangeDate DESC;
`;

// Debug query to check item references
const debugItemReferencesQuery = `
    SELECT 
        ii.ItemID,
        ii.OriginalItemID,
        ii.HebrewDescription,
        rc.NewReferenceID,
        rc.ChangedByUser,
        rc.SupplierID,
        rc.Notes,
        i_new.HebrewDescription as NewDescription,
        i_new.EnglishDescription as NewEnglishDescription,
        i_orig.HebrewDescription as OriginalDescription,
        i_orig.EnglishDescription as OriginalEnglishDescription
    FROM InquiryItem ii
    LEFT JOIN ItemReferenceChange rc ON (
        ii.ItemID = rc.OriginalItemID 
        OR ii.OriginalItemID = rc.OriginalItemID
    )
    LEFT JOIN Item i_new ON rc.NewReferenceID = i_new.ItemID
    LEFT JOIN Item i_orig ON rc.OriginalItemID = i_orig.ItemID
    WHERE ii.InquiryID = ?;
`;

// Add a query to check if an inquiry exists
const checkInquiryExistsQuery = `
    SELECT 1 FROM Inquiry WHERE InquiryID = ?;
`;

// Add a query to check specific item references
const checkItemReferencesQuery = `
    SELECT 
        rc.*,
        i_orig.HebrewDescription as OriginalDescription,
        i_orig.EnglishDescription as OriginalEnglishDescription,
        i_new.HebrewDescription as NewDescription,
        i_new.EnglishDescription as NewEnglishDescription,
        s.Name as SupplierName
    FROM ItemReferenceChange rc
    JOIN Item i_orig ON rc.OriginalItemID = i_orig.ItemID
    JOIN Item i_new ON rc.NewReferenceID = i_new.ItemID
    LEFT JOIN Supplier s ON rc.SupplierID = s.SupplierID
    WHERE rc.OriginalItemID = ? OR rc.NewReferenceID = ?;
`;

module.exports = {
    getReplacementsQuery,
    debugItemReferencesQuery,
    checkInquiryExistsQuery,
    checkItemReferencesQuery
};
