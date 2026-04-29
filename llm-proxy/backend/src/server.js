const app = require('./app');
const config = require('./config/index');
const { initDependencies } = require('./di');

const PORT = config.PORT;

initDependencies().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Middleman backend started on port ${PORT}`);
    console.log(`🔗 Active Endpoints: ${config.OLLAMA_URLS.join(', ')}`);
  });

  module.exports = server;
});
