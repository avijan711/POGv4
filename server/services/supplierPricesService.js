const debug = require('../utils/debug');
const { getSupplierPricesQuery, getSupplierPricesCountQuery } = require('../models/queries/supplier-prices');

class SupplierPricesService {
    constructor(db) {
        this.db = db;
    }

    async getSupplierPrices(itemId, { limit = 10, offset = 0, fromDate = null, supplierId = null } = {}) {
        try {
            debug.log('Fetching supplier prices:', {
                itemId,
                limit,
                offset,
                fromDate,
                supplierId
            });

            let query = getSupplierPricesQuery;
            let params = [itemId, limit, offset];

            // Add date filter if provided
            if (fromDate) {
                query = query.replace(
                    'WHERE item_id = ?',
                    'WHERE item_id = ? AND date >= ?'
                );
                params.splice(1, 0, fromDate);
            }

            // Add supplier filter if provided
            if (supplierId) {
                query = query.replace(
                    'WHERE item_id = ?',
                    'WHERE item_id = ? AND supplier_id = ?'
                );
                params.splice(1, 0, supplierId);
            }

            const prices = await this.db.executeQuery(query, params);

            // Get total count for pagination
            const [{ total }] = await this.db.executeQuery(
                getSupplierPricesCountQuery,
                [itemId]
            );

            return {
                prices,
                total,
                hasMore: offset + limit < total
            };
        } catch (error) {
            debug.error('Error fetching supplier prices:', error);
            throw error;
        }
    }

    async getSuppliers() {
        try {
            const query = `
                SELECT DISTINCT 
                    s.supplier_id as id,
                    s.name,
                    s.contact_person,
                    s.email,
                    s.phone
                FROM supplier s
                JOIN supplier_response sr ON s.supplier_id = sr.supplier_id
                WHERE sr.status = 'active'
                UNION
                SELECT DISTINCT 
                    s.supplier_id as id,
                    s.name,
                    s.contact_person,
                    s.email,
                    s.phone
                FROM supplier s
                JOIN promotion p ON s.supplier_id = p.supplier_id
                WHERE p.is_active = 1
                ORDER BY name;
            `;

            return await this.db.executeQuery(query);
        } catch (error) {
            debug.error('Error fetching suppliers:', error);
            throw error;
        }
    }
}

module.exports = SupplierPricesService;
