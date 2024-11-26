async function cleanupSelfReferences(db) {
    return new Promise((resolve, reject) => {
        console.log('Cleaning up self-references...');
        db.run(
            `DELETE FROM item_reference_change 
             WHERE original_item_id = new_reference_id`,
            function(err) {
                if (err) {
                    console.error('Error cleaning up self-references:', err);
                    reject(err);
                } else {
                    console.log(`Cleaned up ${this.changes} self-references`);
                    resolve(this.changes);
                }
            }
        );
    });
}

async function checkReferenceExists(db, originalItemId, newReferenceId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT change_id FROM item_reference_change WHERE original_item_id = ? AND new_reference_id = ?',
            [originalItemId, newReferenceId],
            (err, row) => {
                if (err) reject(err);
                else resolve(!!row);
            }
        );
    });
}

async function addReferenceChange(db, originalItemId, newReferenceId, supplierId, notes = null) {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.run(
            `INSERT INTO item_reference_change (original_item_id, new_reference_id, supplier_id, change_date, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [originalItemId, newReferenceId, supplierId, now, notes],
            function(err) {
                if (err) {
                    console.error('Error adding reference change:', err);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

async function getReferenceChain(db, itemId, visited = new Set()) {
    if (visited.has(itemId)) {
        return [];
    }
    visited.add(itemId);

    return new Promise((resolve, reject) => {
        db.all(
            'SELECT new_reference_id FROM item_reference_change WHERE original_item_id = ?',
            [itemId],
            async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const chain = [itemId];
                for (const row of rows) {
                    const subChain = await getReferenceChain(db, row.new_reference_id, visited);
                    chain.push(...subChain);
                }
                resolve(chain);
            }
        );
    });
}

module.exports = {
    cleanupSelfReferences,
    checkReferenceExists,
    addReferenceChange,
    getReferenceChain
};
