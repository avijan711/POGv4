// Debug logging utilities
const DEBUG_ENABLED = false; // Enable debugging

// UI-related debug logs
export const uiDebug = {
    log: (...args) => {
        if (DEBUG_ENABLED) {
            console.log('[UI] LOG:', ...args);
        }
    },
    error: (...args) => {
        if (DEBUG_ENABLED) {
            console.error('[UI] ERROR:', ...args);
        }
    },
    warn: (...args) => {
        if (DEBUG_ENABLED) {
            console.warn('[UI] WARN:', ...args);
        }
    },
    info: (...args) => {
        if (DEBUG_ENABLED) {
            console.info('[UI] INFO:', ...args);
        }
    }
};

// Data-related debug logs
export const dataDebug = {
    log: (...args) => {
        if (DEBUG_ENABLED) {
            console.log('[DATA] LOG:', ...args);
        }
    },
    error: (...args) => {
        if (DEBUG_ENABLED) {
            console.error('[DATA] ERROR:', ...args);
        }
    },
    warn: (...args) => {
        if (DEBUG_ENABLED) {
            console.warn('[DATA] WARN:', ...args);
        }
    },
    info: (...args) => {
        if (DEBUG_ENABLED) {
            console.info('[DATA] INFO:', ...args);
        }
    },
    // Special method for logging data structures
    logData: (label, data) => {
        if (DEBUG_ENABLED) {
            console.group('[DATA] ' + label);
            console.log('Raw:', data);
            if (data) {
                console.log('Type:', typeof data);
                if (typeof data === 'object') {
                    if (data instanceof FormData) {
                        console.log('FormData entries:');
                        for (let [key, value] of data.entries()) {
                            console.log(`  ${key}:`, value);
                        }
                    } else {
                        console.log('Keys:', Object.keys(data));
                        console.log('Values:', Object.values(data));
                    }
                }
            }
            console.groupEnd();
        }
    }
};

// Performance-related debug logs
export const perfDebug = {
    time: (label) => {
        if (DEBUG_ENABLED) {
            console.time(label);
        }
    },
    timeEnd: (label) => {
        if (DEBUG_ENABLED) {
            console.timeEnd(label);
            const entries = performance.getEntriesByName(label);
            if (entries.length > 0) {
                console.log(`[PERFORMANCE] ${label}: ${entries[entries.length - 1].duration} ms`);
            }
        }
    }
};
