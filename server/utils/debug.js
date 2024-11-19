const debug = {
    log: (message, data) => {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_LEVEL === 'verbose') {
            console.log(message, data);
        }
    },
    error: (message, error) => {
        console.error(message, error);
    },
    time: (label) => {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_LEVEL === 'verbose') {
            console.time(label);
        }
    },
    timeEnd: (label) => {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_LEVEL === 'verbose') {
            console.timeEnd(label);
        }
    },
    logQuery: (message, query, params) => {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_LEVEL === 'verbose') {
            console.log(message, { query, params });
        }
    }
};

module.exports = debug;
