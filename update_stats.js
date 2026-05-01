const fs = require('fs');
const filepath = 'llm-proxy/frontend/src/pages/Stats.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// Queue Stats Card
content = content.replace(
  '<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">',
  '<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">'
);

content = content.replace(
  '<div className="flex justify-between items-center py-2 border-b">',
  '<div className="flex justify-between items-center py-2 border-b dark:border-gray-700">'
);
content = content.replace(
  '<div className="flex justify-between items-center py-2 border-b">',
  '<div className="flex justify-between items-center py-2 border-b dark:border-gray-700">'
);
content = content.replace(
  '<div className="flex justify-between items-center py-2 border-b">',
  '<div className="flex justify-between items-center py-2 border-b dark:border-gray-700">'
);

// Proxy Metrics Card
content = content.replace(
  '<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">',
  '<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">'
);

content = content.replace(
  '<div className="flex justify-between items-center py-2 border-b">',
  '<div className="flex justify-between items-center py-2 border-b dark:border-gray-700">'
);
content = content.replace(
  '<div className="flex justify-between items-center py-2 border-b">',
  '<div className="flex justify-between items-center py-2 border-b dark:border-gray-700">'
);


// Replace text colors across the file using global regexes
content = content.replace(/className="text-gray-600"/g, 'className="text-gray-600 dark:text-gray-400"');
content = content.replace(/className="text-gray-500 italic"/g, 'className="text-gray-500 dark:text-gray-400 italic"');

fs.writeFileSync(filepath, content);
