const fs = require('fs');
let content = fs.readFileSync('InterRaterExportUI.html', 'utf8');
content = content.replace(/<<<<<<< Updated upstream[\s\S]*?=======\s*(.*?)\s*>>>>>>> Stashed changes/g, '$1');
fs.writeFileSync('InterRaterExportUI.html', content);
