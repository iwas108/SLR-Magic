const fs = require('fs');
let content = fs.readFileSync('llm-proxy/backend/src/services/OllamaService.js', 'utf8');

content = content.replace(/\n    \n\nmodule.exports = \{ OllamaService, streamBroadcaster \};/g, '\n}\n\nmodule.exports = { OllamaService, streamBroadcaster };');

fs.writeFileSync('llm-proxy/backend/src/services/OllamaService.js', content);
