class Debug {
  constructor() {
    this.settings = {
      general: true,
      errors: true,
      database: false,
      performance: false,
      routes: false,
      middleware: false,
    };
  }

  updateSettings(newSettings) {
    // Ensure newSettings is an object
    const settings = typeof newSettings === 'string' ? JSON.parse(newSettings) : newSettings;
    
    // Only update valid debug settings
    const validKeys = ['general', 'errors', 'database', 'performance', 'routes', 'middleware'];
    const filteredSettings = {};
    for (const key of validKeys) {
      if (settings[key] !== undefined) {
        filteredSettings[key] = Boolean(settings[key]);
      }
    }
    
    this.settings = Object.assign({}, this.settings, filteredSettings);
  }

  log(message, data = null) {
    if (!this.settings.general) return;

    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [DEBUG]`;
        
    if (data && typeof data === 'object') {
      if (data.qtySoldThisYear !== undefined || data.qtySoldLastYear !== undefined) {
        console.log(`${logPrefix} ${message}`, {
          qtySoldThisYear: data.qtySoldThisYear,
          qtySoldLastYear: data.qtySoldLastYear,
          _salesDataNote: 'Sales data present in this log',
        });
      } else {
        try {
          const prettyData = JSON.stringify(data, null, 2);
          console.log(`${logPrefix} ${message}\n${prettyData}`);
        } catch (e) {
          console.log(`${logPrefix} ${message}`, data);
        }
      }
    } else {
      console.log(`${logPrefix} ${message}`);
    }
  }

  error(message, error = null) {
    if (!this.settings.errors) return;

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
  }

  time(label) {
    if (!this.settings.performance) return;
    const timestamp = new Date().toISOString();
    console.time(`[${timestamp}] [DEBUG] ${label}`);
  }

  timeEnd(label) {
    if (!this.settings.performance) return;
    const timestamp = new Date().toISOString();
    console.timeEnd(`[${timestamp}] [DEBUG] ${label}`);
  }

  logQuery(description, query, params = []) {
    if (!this.settings.database) return;

    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [DEBUG]`;
    const formattedQuery = query.replace(/\s+/g, ' ').trim();
        
    console.log(`${logPrefix} SQL ${description}:`);
    console.log('Query:', formattedQuery);
    if (params && params.length > 0) {
      console.log('Parameters:', JSON.stringify(params, null, 2));
    }
  }

  logRoute(method, path, handler) {
    if (!this.settings.routes) return;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DEBUG] Route registered: ${method.toUpperCase()} ${path}`);
  }

  logMiddleware(name) {
    if (!this.settings.middleware) return;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DEBUG] Middleware registered: ${name}`);
  }

  logDatabase(operation, details) {
    if (!this.settings.database) return;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DEBUG] Database ${operation}:`, JSON.stringify(details, null, 2));
  }
}

// Create a singleton instance
const debug = new Debug();

module.exports = debug;
