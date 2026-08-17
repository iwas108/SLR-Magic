import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const moduleDir = path.resolve(__dirname, '..');
const pkgPath = path.resolve(moduleDir, 'package.json');
const lastHashPath = path.resolve(moduleDir, '.last-build-hash');

function computeSourceHash() {
  const hash = crypto.createHash('sha256');
  const sourceTargets = [
    path.join(moduleDir, 'src'),
    path.join(moduleDir, 'public'),
    path.join(moduleDir, 'index.html'),
    path.join(moduleDir, 'vite.config.ts'),
  ];

  const ignoreList = ['node_modules', 'dist', '.last-build-hash', 'package.json', 'package-lock.json'];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (ignoreList.includes(entry.name)) continue;
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        hash.update(path.relative(moduleDir, full));
        hash.update(fs.readFileSync(full));
      }
    }
  }

  for (const target of sourceTargets) {
    if (!fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      hash.update(path.relative(moduleDir, target));
      hash.update(fs.readFileSync(target));
    } else if (stat.isDirectory()) {
      walk(target);
    }
  }

  return hash.digest('hex');
}

try {
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkgData.version || '1.0.0';
  const currentHash = computeSourceHash();
  const previousHash = fs.existsSync(lastHashPath) ? fs.readFileSync(lastHashPath, 'utf8').trim() : '';

  const forceBump = process.argv.includes('--force');
  const hasChanges = forceBump || !previousHash || currentHash !== previousHash;

  if (hasChanges) {
    const parts = currentVersion.split('.').map(Number);
    if (parts.length === 3 && parts.every(n => !isNaN(n))) {
      parts[2] += 1;
      pkgData.version = parts.join('.');
    } else {
      pkgData.version = '1.0.1';
    }

    fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');
    fs.writeFileSync(lastHashPath, currentHash, 'utf8');
    console.log(`[slr-viewer] Source changes detected. Version bumped from ${currentVersion} to ${pkgData.version}`);
  } else {
    console.log(`[slr-viewer] No source code changes detected. Preserving version v${currentVersion}`);
  }
} catch (err) {
  console.error('[slr-viewer] Failed in smart versioning check:', err);
}
