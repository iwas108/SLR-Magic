const fs = require('fs');
const filepath = 'llm-proxy/frontend/src/pages/History.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// Thead background and border
content = content.replace(
  '<thead className="bg-gray-50">',
  '<thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">'
);

// Search and datetime inputs
content = content.replace(/border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2/g, 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2');

// text-gray-500 in headers and standard cells (not everywhere, be targeted)
content = content.replace(/text-gray-500 uppercase/g, 'text-gray-500 dark:text-gray-400 uppercase');
content = content.replace(/text-sm text-gray-500/g, 'text-sm text-gray-500 dark:text-gray-400');
content = content.replace(/text-center py-8 text-gray-500/g, 'text-center py-8 text-gray-500 dark:text-gray-400');

// text-gray-900 in cells
content = content.replace(/text-sm font-medium text-gray-900/g, 'text-sm font-medium text-gray-900 dark:text-gray-100');

// Hover state on table rows
content = content.replace(
  'className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"',
  'className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer text-gray-900 dark:text-gray-100"'
);

// hover:bg-gray-100 on headers
content = content.replace(/hover:bg-gray-100/g, 'hover:bg-gray-100 dark:hover:bg-gray-800');

// Modal headers and text missing dark theme (most of it has it but verifying)
content = content.replace(
  'className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-blue-200 dark:border-blue-900/50 text-gray-900 dark:text-gray-200"',
  'className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-blue-200 dark:border-blue-900/50 text-gray-900 dark:text-gray-200"'
); // Just making sure

fs.writeFileSync(filepath, content);
