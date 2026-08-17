const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const slrIdeDir = path.resolve(__dirname, '..');
const pkgPath = path.resolve(slrIdeDir, 'package.json');
const indexHtmlPath = path.resolve(slrIdeDir, '../index.html');
const lastHashPath = path.resolve(slrIdeDir, '.last-build-hash');

const IGNORED_DIRS = new Set([
  'node_modules', '.next', 'dist', 'db', 'venv', '.venv',
  '__pycache__', 'cached_pdf', 'pdf_repo', 'downloaded_pdf', '.git'
]);

const IGNORED_FILES = new Set([
  '.last-build-hash', '.DS_Store', 'Thumbs.db', 'package.json', 'package-lock.json', 'slr.db'
]);

function computeSourceHash() {
  const hash = crypto.createHash('sha256');
  const sourceTargets = [
    path.join(slrIdeDir, 'src'),
    path.join(slrIdeDir, 'public'),
    path.join(slrIdeDir, 'python_engine'),
    path.join(slrIdeDir, 'next.config.mjs'),
  ];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        if (!IGNORED_FILES.has(entry.name) && !entry.name.endsWith('.pyc') && !entry.name.endsWith('.log')) {
          const fullPath = path.join(currentDir, entry.name);
          const rel = path.relative(slrIdeDir, fullPath).replace(/\\/g, '/');
          hash.update(rel);
          hash.update(fs.readFileSync(fullPath));
        }
      }
    }
  }

  for (const target of sourceTargets) {
    if (!fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      hash.update(path.relative(slrIdeDir, target).replace(/\\/g, '/'));
      hash.update(fs.readFileSync(target));
    } else if (stat.isDirectory()) {
      walk(target);
    }
  }

  return hash.digest('hex');
}

try {
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkgData.version || '0.1.0';
  const currentHash = computeSourceHash();
  const previousHash = fs.existsSync(lastHashPath) ? fs.readFileSync(lastHashPath, 'utf8').trim() : '';

  const forceBump = process.argv.includes('--force');
  const hasChanges = forceBump || !previousHash || currentHash !== previousHash;

  let activeVersion = currentVersion;

  if (hasChanges) {
    const parts = currentVersion.split('.').map(Number);
    if (parts.length === 3 && parts.every(n => !isNaN(n))) {
      parts[2] += 1;
      activeVersion = parts.join('.');
    } else {
      activeVersion = '0.1.1';
    }

    pkgData.version = activeVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');
    fs.writeFileSync(lastHashPath, currentHash, 'utf8');
    console.log(`[slr-ide] Source changes detected. Version bumped from ${currentVersion} to ${activeVersion}`);
  } else {
    console.log(`[slr-ide] No source code changes detected. Preserving version v${currentVersion}`);
  }

  // Sync version & build time into root index.html
  if (fs.existsSync(indexHtmlPath)) {
    const buildTime = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true,
    });

    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    html = html.replace(
      /(<span[^>]+id="platform-version-badge"[^>]*>)[^<]*(<\/span>)/,
      `$1v${activeVersion}$2`
    );

    html = html.replace(
      /(<span[^>]+id="platform-version-badge"[^>]*)title="[^"]*"([^>]*>)/,
      `$1title="Compiled on: ${buildTime}"$2`
    );

    if (!html.includes('title="Compiled on:')) {
      html = html.replace(
        /(<span[^>]+id="platform-version-badge")([^>]*>)/,
        `$1 title="Compiled on: ${buildTime}"$2`
      );
    }

    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    console.log(`[slr-ide] index.html synced → v${activeVersion} (${buildTime})`);
  }
} catch (err) {
  console.error('[slr-ide] Failed in smart versioning check:', err);
}
