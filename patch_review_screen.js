const fs = require('fs');
let content = fs.readFileSync('inter-rater/src/components/ReviewScreen.jsx', 'utf8');
content = content.replace(/<<<<<<< Updated upstream[\s\S]*?=======\s*(.*?)\s*>>>>>>> Stashed changes/m, '$1');
fs.writeFileSync('inter-rater/src/components/ReviewScreen.jsx', content);
