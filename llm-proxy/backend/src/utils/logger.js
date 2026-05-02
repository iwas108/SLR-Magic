const getTimestamp = () => new Date().toISOString();

const logger = {
    info: (...args) => {
        console.log(`[${getTimestamp()}]`, ...args);
    },
    error: (...args) => {
        console.error(`[${getTimestamp()}]`, ...args);
    },
    debug: (...args) => {
        console.log(`[${getTimestamp()}] [DEBUG]`, ...args);
    }
};

module.exports = logger;
