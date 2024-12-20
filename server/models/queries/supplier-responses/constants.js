/**
 * Constants for supplier response query parameters
 */
const QUERY_PARAMS = {
    STATS: {
        INQUIRY_ITEMS: 'inquiry_items_cte',
        NOT_EXISTS: 'not_exists_subquery',
        RESPONSE_STATS: 'response_stats_where',
        ALL_RESPONDED: 'all_responded_items_cte',
        TOTAL_RESPONSES: 'total_responses_subquery'
    },
    RESPONSES: {
        INQUIRY_ITEMS: 'inquiry_items_cte',
        SUPPLIER_FILTER: 'supplier_filter'
    },
    MISSING_ITEMS: {
        INQUIRY_ITEMS: 'inquiry_items_cte',
        PROMOTION_SUPPLIER: 'promotion_supplier_filter',
        RESPONSE_SUPPLIER: 'response_supplier_filter',
        RESPONSE_INQUIRY: 'response_inquiry_filter'
    }
};

/**
 * Parameter validation schemas with type coercion support
 */
const PARAM_SCHEMAS = {
    inquiryId: {
        type: 'number',
        required: true,
        validate: (value) => {
            // After coercion, ensure it's a positive integer
            return typeof value === 'number' && 
                   Number.isInteger(value) && 
                   value > 0;
        }
    },
    supplierId: {
        type: 'number',
        required: true,
        validate: (value) => {
            // After coercion, ensure it's a positive integer
            return typeof value === 'number' && 
                   Number.isInteger(value) && 
                   value > 0;
        }
    }
};

module.exports = {
    QUERY_PARAMS,
    PARAM_SCHEMAS
};
