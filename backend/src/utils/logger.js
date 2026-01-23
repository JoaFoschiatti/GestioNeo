const shouldLog = process.env.NODE_ENV !== 'test';

const logger = {
  info: (...args) => {
    if (!shouldLog) return;
    // eslint-disable-next-line no-console
    console.log(...args);
  },
  warn: (...args) => {
    if (!shouldLog) return;
    // eslint-disable-next-line no-console
    console.warn(...args);
  },
  error: (...args) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

module.exports = { logger };

