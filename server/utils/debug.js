const debug = {
    log: function(message, data = null) {
        const timestamp = new Date().toISOString();
        if (data && typeof data === 'object') {
            // Special handling for sales data
            if (data.qtySoldThisYear !== undefined || data.qtySoldLastYear !== undefined) {
                console.log(`[${timestamp}] [DEBUG] ${message}`, {
                    ...data,
                    _salesDataNote: 'Sales data present in this log'
                });
            } else {
                console.log(`[${timestamp}] [DEBUG] ${message}`, data);
            }
        } else {
            console.log(`[${timestamp}] [DEBUG] ${message}`);
        }
    },

    error: function(message, error = null) {
        const timestamp = new Date().toISOString();
        if (error) {
            console.error(`[${timestamp}] [ERROR] ${message}`, error);
        } else {
            console.error(`[${timestamp}] [ERROR] ${message}`);
        }
    },

    time: function(label) {
        console.time(`[DEBUG] ${label}`);
    },

    timeEnd: function(label) {
        console.timeEnd(`[DEBUG] ${label}`);
    },

    logQuery: function(description, query, params = []) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [DEBUG] SQL ${description}:`, {
            query: query.replace(/\s+/g, ' ').trim(),
            params
        });
    }
};

module.exports = debug;
