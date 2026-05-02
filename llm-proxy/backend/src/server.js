const logger = require("./utils/logger");
const app = require('./app');
const config = require('./config/index');
const { initDependencies } = require('./di');
const { initWebSocket } = require('./routes/ws');

const PORT = config.PORT;

initDependencies().then(() => {
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Middleman backend started on port ${PORT}`);
    logger.info(`🔗 Active Endpoints: ${config.OLLAMA_URLS.join(', ')}`);
  });

  initWebSocket(server);

  module.exports = server;
});
