const fs = require('fs');
const filepath = 'llm-proxy/frontend/src/pages/Configuration.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// Global Cache Update missing dark backgrounds
content = content.replace(
    'className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"',
    'className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"'
);

fs.writeFileSync(filepath, content);
