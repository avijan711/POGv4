// Create debugger for different parts of the application
const createDebugger = (subNamespace) => {
  const prefix = `[${subNamespace.toUpperCase()}]`;
  
  return {
    log: (...args) => console.log(prefix, 'LOG:', ...args),
    error: (...args) => console.error(prefix, 'ERROR:', ...args),
    warn: (...args) => console.warn(prefix, 'WARN:', ...args),
    info: (...args) => console.info(prefix, 'INFO:', ...args),
    debug: (...args) => console.debug(prefix, 'DEBUG:', ...args),
    
    // Performance monitoring
    time: (label) => {
      console.log(prefix, `TIME_START: ${label}`);
      console.time(label);
    },
    timeEnd: (label) => {
      console.log(prefix, `TIME_END: ${label}`);
      console.timeEnd(label);
    },
    
    // Group related logs
    group: (label) => {
      console.log(prefix, `GROUP_START: ${label}`);
      console.group(label);
    },
    groupEnd: () => {
      console.log(prefix, 'GROUP_END');
      console.groupEnd();
    }
  };
};

// Create debuggers for different modules
export const uiDebug = createDebugger('ui');
export const apiDebug = createDebugger('api');
export const dataDebug = createDebugger('data');
export const perfDebug = createDebugger('performance');
