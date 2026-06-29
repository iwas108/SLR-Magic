const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePat = path.join(dir, file);
    if (fs.statSync(filePat).isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('venv') && !file.includes('.git') && !file.includes('dist')) {
        getFiles(filePat, fileList);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.py')) {
        fileList.push(filePat);
      }
    }
  }
  return fileList;
}

const allFiles = getFiles(path.resolve(__dirname, '..'));
const fileLines = allFiles.map(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n').length;
  return { file, lines };
});

fileLines.sort((a, b) => b.lines - a.lines);
console.log('Top 30 largest source files:');
fileLines.slice(0, 30).forEach((f, idx) => {
  console.log(`${idx + 1}. ${f.file.replace(path.resolve(__dirname, '..'), '')} (${f.lines} lines)`);
});
