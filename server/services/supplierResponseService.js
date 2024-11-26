const debug = require('../utils/debug');
const ResponseQueries = require('./supplierResponse/responseQueries');
const ItemUpdates = require('./supplierResponse/itemUpdates');
const ResponseProcessing = require('./supplierResponse/responseProcessing');

class SupplierResponseService {
    constructor(db) {
        this.db = db;
        this.responseQueries = new ResponseQueries(db);
        this.itemUpdates = new ItemUpdates(db);
        this.responseProcessing = new ResponseProcessing(db, this.itemUpdates, this.responseQueries);
    }

    async getSupplierResponses(inquiryId, page = 1, pageSize = 50) {
        debug.log('Getting supplier responses for inquiry:', inquiryId);
        return this.responseQueries.getSupplierResponses(inquiryId, page, pageSize);
    }

    async deleteResponse(responseId) {
        debug.log('Deleting supplier response:', responseId);
        return this.responseQueries.deleteResponse(responseId);
    }

    async deleteReferenceChange(changeId) {
        debug.log('Deleting reference change:', changeId);
        return this.responseQueries.deleteReferenceChange(changeId);
    }

    async deleteBulkResponses(date, supplierId) {
        debug.log('Deleting bulk responses:', { date, supplierId });
        return this.responseQueries.deleteBulkResponses(date, supplierId);
    }

    async processUpload(file, columnMapping, supplierId, inquiryId) {
        debug.log('Processing supplier response upload:', {
            filename: file.filename,
            supplierId,
            inquiryId
        });

        if (!file || !columnMapping || !supplierId || !inquiryId) {
            debug.error('Missing required parameters for upload');
            throw new Error('Missing required parameters');
        }

        return this.responseProcessing.processUpload(file, columnMapping, supplierId, inquiryId);
    }
}

module.exports = SupplierResponseService;
