const fs = require('fs');
const file = 'llm-proxy/frontend/src/pages/Configuration.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /<h2 className="text-2xl font-bold mb-6">Smart Endpoint Manager<\/h2>/,
    `<CloudEndpointsManager />\n            <div className="mt-8"></div>\n            <h2 className="text-2xl font-bold mb-6">Smart Endpoint Manager</h2>`
);

fs.writeFileSync(file, content, 'utf8');
