import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../package.json');

try {
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkgData.version || '0.0.0';
  const parts = currentVersion.split('.').map(Number);
  
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    parts[2] += 1;
    pkgData.version = parts.join('.');
  } else {
    pkgData.version = '0.0.1';
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');
  console.log(`[inter-rater] Version bumped from ${currentVersion} to ${pkgData.version}`);
} catch (err) {
  console.error('[inter-rater] Failed to bump version:', err);
}
