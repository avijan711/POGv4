const { DatabaseAccessLayer } = require('../config/database');

async function cleanupSelfReferences(db) {
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    try {
        console.log('Cleaning up self-references...');
        const result = await dal.run(
            `DELETE FROM item_reference_change 
             WHERE original_item_id = new_reference_id`
        );
        console.log(`Cleaned up ${result.changes} self-references`);
        return result.changes;
    } catch (err) {
        console.error('Error cleaning up self-references:', err);
        throw err;
    }
}

async function checkReferenceExists(db, originalItemId, newReferenceId) {
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    try {
        const row = await dal.querySingle(
            'SELECT change_id FROM item_reference_change WHERE original_item_id = ? AND new_reference_id = ?',
            [originalItemId, newReferenceId]
        );
        return !!row;
    } catch (err) {
        console.error('Error checking reference exists:', err);
        throw err;
    }
}

async function addReferenceChange(db, originalItemId, newReferenceId, supplierId, notes = null) {
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    try {
        const now = new Date().toISOString();
        const result = await dal.run(
            `INSERT INTO item_reference_change (original_item_id, new_reference_id, supplier_id, change_date, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [originalItemId, newReferenceId, supplierId, now, notes]
        );
        return result.lastID;
    } catch (err) {
        console.error('Error adding reference change:', err);
        throw err;
    }
}

async function getReferenceChain(db, itemId, visited = new Set()) {
    if (visited.has(itemId)) {
        return [];
    }
    visited.add(itemId);

    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    try {
        const rows = await dal.query(
            'SELECT new_reference_id FROM item_reference_change WHERE original_item_id = ?',
            [itemId]
        );

        const chain = [itemId];
        for (const row of rows) {
            const subChain = await getReferenceChain(dal, row.new_reference_id, visited);
            chain.push(...subChain);
        }
        return chain;
    } catch (err) {
        console.error('Error getting reference chain:', err);
        throw err;
    }
}

module.exports = {
    cleanupSelfReferences,
    checkReferenceExists,
    addReferenceChange,
    getReferenceChain
};
