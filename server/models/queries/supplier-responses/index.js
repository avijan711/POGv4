const { getSupplierStatsQuery } = require('./supplier-stats');
const { getResponseDetailsQuery } = require('./response-details');
const { getMissingItemsQuery } = require('./missing-items');
const { QUERY_PARAMS, PARAM_SCHEMAS } = require('./constants');
const { validateParams, createParamArray } = require('./validation');

/**
 * Get all queries needed for supplier responses with parameter validation
 * @returns {Object} Object containing all necessary queries and their parameters
 */
function getSupplierResponsesQueries() {
    return {
        stats: {
            query: getSupplierStatsQuery(),
            params: (inquiryId) => {
                // Validate and coerce input parameters
                const validatedParams = validateParams(
                    { inquiryId },
                    { inquiryId: PARAM_SCHEMAS.inquiryId }
                );

                // Define parameter mapping for stats query
                const paramMapping = [
                    QUERY_PARAMS.STATS.INQUIRY_ITEMS,
                    QUERY_PARAMS.STATS.NOT_EXISTS,
                    QUERY_PARAMS.STATS.RESPONSE_STATS,
                    QUERY_PARAMS.STATS.ALL_RESPONDED,
                    QUERY_PARAMS.STATS.TOTAL_RESPONSES
                ];

                // Create parameter array with coerced inquiryId for each position
                const params = {};
                paramMapping.forEach(param => {
                    params[param] = validatedParams.inquiryId;
                });

                return createParamArray(params, paramMapping);
            }
        },
        responses: {
            query: getResponseDetailsQuery(),
            params: (inquiryId, supplierId) => {
                // Validate and coerce input parameters
                const validatedParams = validateParams(
                    { inquiryId, supplierId },
                    {
                        inquiryId: PARAM_SCHEMAS.inquiryId,
                        supplierId: PARAM_SCHEMAS.supplierId
                    }
                );

                // Define parameter mapping for responses query
                const paramMapping = [
                    QUERY_PARAMS.RESPONSES.INQUIRY_ITEMS,
                    QUERY_PARAMS.RESPONSES.SUPPLIER_FILTER
                ];

                // Create parameter array with coerced values
                const params = {
                    [QUERY_PARAMS.RESPONSES.INQUIRY_ITEMS]: validatedParams.inquiryId,
                    [QUERY_PARAMS.RESPONSES.SUPPLIER_FILTER]: validatedParams.supplierId
                };

                return createParamArray(params, paramMapping);
            }
        },
        missingItems: {
            query: getMissingItemsQuery(),
            params: (inquiryId, supplierId) => {
                // Validate and coerce input parameters
                const validatedParams = validateParams(
                    { inquiryId, supplierId },
                    {
                        inquiryId: PARAM_SCHEMAS.inquiryId,
                        supplierId: PARAM_SCHEMAS.supplierId
                    }
                );

                // Define parameter mapping for missing items query
                const paramMapping = [
                    QUERY_PARAMS.MISSING_ITEMS.INQUIRY_ITEMS,
                    QUERY_PARAMS.MISSING_ITEMS.PROMOTION_SUPPLIER,
                    QUERY_PARAMS.MISSING_ITEMS.RESPONSE_SUPPLIER,
                    QUERY_PARAMS.MISSING_ITEMS.RESPONSE_INQUIRY
                ];

                // Create parameter array with coerced values
                const params = {
                    [QUERY_PARAMS.MISSING_ITEMS.INQUIRY_ITEMS]: validatedParams.inquiryId,
                    [QUERY_PARAMS.MISSING_ITEMS.PROMOTION_SUPPLIER]: validatedParams.supplierId,
                    [QUERY_PARAMS.MISSING_ITEMS.RESPONSE_SUPPLIER]: validatedParams.supplierId,
                    [QUERY_PARAMS.MISSING_ITEMS.RESPONSE_INQUIRY]: validatedParams.inquiryId
                };

                return createParamArray(params, paramMapping);
            }
        }
    };
}

module.exports = {
    getSupplierResponsesQueries
};
