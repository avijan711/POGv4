const debug = {
    log: function(message, data = null) {
        const timestamp = new Date().toISOString();
        const logPrefix = `[${timestamp}] [DEBUG]`;
        
        if (data && typeof data === 'object') {
            // Special handling for sales data
            if (data.qtySoldThisYear !== undefined || data.qtySoldLastYear !== undefined) {
                console.log(`${logPrefix} ${message}`, {
                    ...data,
                    _salesDataNote: 'Sales data present in this log'
                });
            } else {
                try {
                    // Pretty print objects with proper indentation
                    const prettyData = JSON.stringify(data, null, 2);
                    console.log(`${logPrefix} ${message}\n${prettyData}`);
                } catch (e) {
                    console.log(`${logPrefix} ${message}`, data);
                }
            }
        } else {
            console.log(`${logPrefix} ${message}`);
        }
    },

    error: function(message, error = null) {
        const timestamp = new Date().toISOString();
        const logPrefix = `[${timestamp}] [ERROR]`;
        
        if (error) {
            console.error(`${logPrefix} ${message}`);
            if (error instanceof Error) {
                console.error(`Stack trace:\n${error.stack}`);
                if (error.cause) {
                    console.error('Caused by:', error.cause);
                }
            } else {
                console.error('Error details:', error);
            }
        } else {
            console.error(`${logPrefix} ${message}`);
        }
    },

    time: function(label) {
        const timestamp = new Date().toISOString();
        console.time(`[${timestamp}] [DEBUG] ${label}`);
    },

    timeEnd: function(label) {
        const timestamp = new Date().toISOString();
        console.timeEnd(`[${timestamp}] [DEBUG] ${label}`);
    },

    logQuery: function(description, query, params = []) {
        const timestamp = new Date().toISOString();
        const logPrefix = `[${timestamp}] [DEBUG]`;
        const formattedQuery = query.replace(/\s+/g, ' ').trim();
        
        console.log(`${logPrefix} SQL ${description}:`);
        console.log('Query:', formattedQuery);
        if (params && params.length > 0) {
            console.log('Parameters:', JSON.stringify(params, null, 2));
        }
    },

    logRoute: function(method, path, handler) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [DEBUG] Route registered: ${method.toUpperCase()} ${path}`);
    },

    logMiddleware: function(name) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [DEBUG] Middleware registered: ${name}`);
    },

    logDatabase: function(operation, details) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [DEBUG] Database ${operation}:`, JSON.stringify(details, null, 2));
    }
};

module.exports = debug;
