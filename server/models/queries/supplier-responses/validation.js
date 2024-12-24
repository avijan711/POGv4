/**
 * Utility functions for parameter validation in supplier response queries
 */

class ValidationError extends Error {
  constructor(message, params = {}) {
    super(message);
    this.name = 'ValidationError';
    this.params = params;
  }
}

/**
 * Coerces a value to the specified type
 * @param {*} value - Value to coerce
 * @param {string} type - Target type ('number' or 'string')
 * @returns {*} Coerced value
 * @throws {ValidationError} If coercion fails
 */
function coerceValue(value, type) {
  if (value === null || value === undefined) {
    return value;
  }

  switch (type) {
  case 'number':
    // Handle string numbers
    if (typeof value === 'string') {
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
    }
    // Handle actual numbers
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    throw new ValidationError(`Could not coerce value to number: ${value}`);

  case 'string':
    return String(value);

  default:
    return value;
  }
}

/**
 * Validates a single parameter against its schema
 * @param {string} paramName - Name of the parameter
 * @param {*} value - Value to validate
 * @param {Object} schema - Validation schema
 * @throws {ValidationError} If validation fails
 */
function validateParameter(paramName, value, schema) {
  if (schema.required && (value === undefined || value === null)) {
    throw new ValidationError(`Required parameter '${paramName}' is missing`, {
      parameter: paramName,
      value,
      schema,
    });
  }

  if (value !== undefined && value !== null) {
    // Try to coerce the value to the expected type
    try {
      const coercedValue = coerceValue(value, schema.type);
      if (!schema.validate(coercedValue)) {
        throw new ValidationError(
          `Parameter '${paramName}' failed validation after coercion`,
          {
            parameter: paramName,
            originalValue: value,
            coercedValue,
            expectedType: schema.type,
          },
        );
      }
      // Return the coerced value for use
      return coercedValue;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Parameter '${paramName}' validation error: ${error.message}`,
        {
          parameter: paramName,
          value,
          expectedType: schema.type,
        },
      );
    }
  }

  return value;
}

/**
 * Validates multiple parameters against their schemas
 * @param {Object} params - Parameters to validate
 * @param {Object} schemas - Schema definitions to validate against
 * @returns {Object} Object with validated and coerced values
 * @throws {ValidationError} If any validation fails
 */
function validateParams(params, schemas) {
  const validatedParams = {};
  Object.entries(schemas).forEach(([paramName, schema]) => {
    validatedParams[paramName] = validateParameter(paramName, params[paramName], schema);
  });
  return validatedParams;
}

/**
 * Creates a parameter array for a query based on parameter mapping
 * @param {Object} params - Source parameters
 * @param {Array<string>} paramMapping - Array of parameter names in order
 * @returns {Array} Array of parameter values in correct order
 */
function createParamArray(params, paramMapping) {
  return paramMapping.map(paramName => {
    const value = params[paramName];
    if (value === undefined) {
      throw new ValidationError(`Missing parameter mapping for '${paramName}'`, {
        parameter: paramName,
        mapping: paramMapping,
      });
    }
    return value;
  });
}

module.exports = {
  ValidationError,
  validateParameter,
  validateParams,
  createParamArray,
  coerceValue,
};
