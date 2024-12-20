const { getReferenceChain } = require('./referenceUtils');
const { DatabaseAccessLayer } = require('../config/database');

async function validateReferenceChange(db, originalItemId, newReferenceId) {
    // Check if it's a self-reference
    if (originalItemId === newReferenceId) {
        return { valid: false, reason: 'Self-referencing is not allowed' };
    }

    // Check if there's already a reference chain that would create a cycle
    const chain = await getReferenceChain(db, newReferenceId);
    if (chain.includes(originalItemId)) {
        return { valid: false, reason: 'This reference would create a circular dependency' };
    }

    // Check if both items exist
    const itemsExist = await validateItemsExist(db, [originalItemId, newReferenceId]);
    if (!itemsExist.valid) {
        return itemsExist;
    }

    return { valid: true };
}

async function validateItemsExist(db, itemIds) {
    const dal = db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db);
    try {
        const placeholders = itemIds.map(() => '?').join(',');
        const rows = await dal.query(
            `SELECT ItemID FROM Item WHERE ItemID IN (${placeholders})`,
            itemIds
        );

        if (rows.length !== itemIds.length) {
            const foundIds = rows.map(row => row.ItemID);
            const missingIds = itemIds.filter(id => !foundIds.includes(id));
            return {
                valid: false,
                reason: `Items not found: ${missingIds.join(', ')}`
            };
        }
        return { valid: true };
    } catch (err) {
        console.error('Error validating items exist:', err);
        throw err;
    }
}

async function validateSupplierResponse(data, requiredFields) {
    const errors = [];

    if (!data || !Array.isArray(data)) {
        return {
            valid: false,
            errors: ['Invalid data format: expected an array']
        };
    }

    data.forEach((row, index) => {
        requiredFields.forEach(field => {
            if (!row[field] && row[field] !== 0) {
                errors.push(`Row ${index + 1}: Missing required field '${field}'`);
            }
        });

        if (row.price && isNaN(parseFloat(row.price))) {
            errors.push(`Row ${index + 1}: Invalid price format`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateReferenceChange,
    validateItemsExist,
    validateSupplierResponse
};
