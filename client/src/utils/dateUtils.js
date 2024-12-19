// Format a date string to DD/MM/YYYY
export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

// Format a date string to DD/MM/YYYY HH:mm
export const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${formatDate(dateString)} ${date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
    })}`;
};

// Check if a date is in the future
export const isFutureDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date > new Date();
};

// Check if a date is in the past
export const isPastDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date < new Date();
};
