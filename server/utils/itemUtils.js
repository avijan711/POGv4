function cleanItemId(itemId) {
    return itemId.toString().replace(/['"]/g, '').trim();
}

async function checkItemExists(db, itemId) {
    const cleanedId = cleanItemId(itemId);
    return new Promise((resolve, reject) => {
        db.get('SELECT ItemID FROM Item WHERE ItemID = ?', [cleanedId], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

async function createItem(db, itemData) {
    const cleanedId = cleanItemId(itemData.itemID);
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO Item (ItemID, HebrewDescription, EnglishDescription, HSCode) VALUES (?, ?, ?, ?)',
            [cleanedId, '', itemData.englishDescription || '', itemData.hsCode || ''],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

async function updateItem(db, itemData) {
    const cleanedId = cleanItemId(itemData.itemID);
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE Item 
             SET EnglishDescription = COALESCE(NULLIF(?, ''), EnglishDescription),
                 HSCode = COALESCE(NULLIF(?, ''), HSCode)
             WHERE ItemID = ?`,
            [itemData.englishDescription || '', itemData.hsCode || '', cleanedId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

async function getItemDetails(db, itemId) {
    const cleanedId = cleanItemId(itemId);
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 
                i.*,
                GROUP_CONCAT(DISTINCT irc.NewReferenceID) as References,
                GROUP_CONCAT(DISTINCT sr.PriceQuoted) as Prices
             FROM Item i
             LEFT JOIN ItemReferenceChange irc ON i.ItemID = irc.OriginalItemID
             LEFT JOIN SupplierResponse sr ON i.ItemID = sr.ItemID
             WHERE i.ItemID = ?
             GROUP BY i.ItemID`,
            [cleanedId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

async function getItemHistory(db, itemId) {
    const cleanedId = cleanItemId(itemId);
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT 
                'reference' as type,
                irc.ChangeDate as date,
                s.Name as supplierName,
                irc.NewReferenceID as value,
                irc.Notes as notes
             FROM ItemReferenceChange irc
             JOIN Supplier s ON irc.SupplierID = s.SupplierID
             WHERE irc.OriginalItemID = ?
             
             UNION ALL
             
             SELECT 
                'price' as type,
                sr.ResponseDate as date,
                s.Name as supplierName,
                sr.PriceQuoted as value,
                sr.Status as notes
             FROM SupplierResponse sr
             JOIN Supplier s ON sr.SupplierID = s.SupplierID
             WHERE sr.ItemID = ?
             
             ORDER BY date DESC`,
            [cleanedId, cleanedId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = {
    cleanItemId,
    checkItemExists,
    createItem,
    updateItem,
    getItemDetails,
    getItemHistory
};
