const BaseModel = require('./BaseModel');
const debug = require('../utils/debug');

class SupplierModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async getAllSuppliers() {
        const sql = 'SELECT supplier_id, name, contact_person, email, phone FROM supplier ORDER BY name';
        return await this.executeQuery(sql);
    }

    async getSupplierById(supplierId) {
        const sql = 'SELECT supplier_id, name, contact_person, email, phone FROM supplier WHERE supplier_id = ?';
        return await this.executeQuerySingle(sql, [supplierId]);
    }

    async createSupplier({ name, contactPerson, email, phone }) {
        const sql = 'INSERT INTO supplier (name, contact_person, email, phone) VALUES (?, ?, ?, ?)';
        const result = await this.executeRun(sql, [name, contactPerson || null, email || null, phone || null]);
        return await this.getSupplierById(result.lastID);
    }

    async updateSupplier(supplierId, { name, contactPerson, email, phone }) {
        const sql = 'UPDATE supplier SET name = ?, contact_person = ?, email = ?, phone = ? WHERE supplier_id = ?';
        const result = await this.executeRun(sql, [name, contactPerson || null, email || null, phone || null, supplierId]);
        if (result.changes === 0) {
            return null;
        }
        return await this.getSupplierById(supplierId);
    }

    async deleteSupplier(supplierId) {
        const sql = 'DELETE FROM supplier WHERE supplier_id = ?';
        const result = await this.executeRun(sql, [supplierId]);
        return { deleted: result.changes > 0 };
    }
}

module.exports = SupplierModel;
