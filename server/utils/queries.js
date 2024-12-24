const { getSupplierResponsesQuery } = require('../models/queries/supplier-responses');
const { getInquiriesQuery, getInquiryByIdQuery } = require('../models/queries/inquiries');

module.exports = {
  getSupplierResponsesQuery,
  getInquiriesQuery,
  getInquiryByIdQuery,
};
