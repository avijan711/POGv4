const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

class DateValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DateValidationError';
    }
}

const isValidDate = (dateString) => {
    if (!dateString) return false;
    if (!DATE_REGEX.test(dateString)) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};

const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    } catch {
        return null;
    }
};

const getSQLDate = (date = null) => {
    if (date) {
        const formatted = formatDate(date);
        return formatted ? `datetime('${formatted}')` : `datetime('now')`;
    }
    return `datetime('now')`;
};

module.exports = {
    DATE_FORMAT,
    DATE_REGEX,
    DateValidationError,
    isValidDate,
    formatDate,
    getSQLDate
};
