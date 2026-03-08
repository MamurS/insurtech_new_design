const isDev = import.meta.env.DEV;

const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) console.log(`[DEBUG] ${message}`, ...args);
  },

  info: (message: string, ...args: unknown[]) => {
    if (isDev) console.info(`[INFO] ${message}`, ...args);
  },

  warn: (message: string, ...args: unknown[]) => {
    if (isDev) console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, ...args: unknown[]) => {
    // Always log errors, but sanitize in production
    if (isDev) {
      console.error(`[ERROR] ${message}`, ...args);
    } else {
      // In production, log minimal info (could send to error tracking service)
      console.error(`[ERROR] ${message}`);
    }
  }
};

export default logger;
