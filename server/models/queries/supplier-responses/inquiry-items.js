function getInquiryItemsQuery() {
    return `InquiryItems AS (
        SELECT DISTINCT 
            ii.ItemID,
            i.HebrewDescription,
            i.EnglishDescription,
            ii.RequestedQty,
            ii.RetailPrice
        FROM InquiryItem ii
        JOIN Item i ON ii.ItemID = i.ItemID
        WHERE ii.InquiryID = ?
    )`;
}

module.exports = {
    getInquiryItemsQuery
};
