const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../package.json');
const indexHtmlPath = path.resolve(__dirname, '../../index.html');

try {
  // --- 1. Bump slr-ide/package.json patch version ---
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkgData.version || '0.1.0';
  const parts = currentVersion.split('.').map(Number);

  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    parts[2] += 1;
    pkgData.version = parts.join('.');
  } else {
    pkgData.version = '0.1.1';
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');
  console.log(`[slr-ide] Version bumped from ${currentVersion} to ${pkgData.version}`);

  // --- 2. Sync new version & build time into root index.html ---
  if (!fs.existsSync(indexHtmlPath)) {
    console.warn('[slr-ide] index.html not found at root, skipping sync.');
  } else {
    const buildTime = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true,
    });

    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // Replace the content of the version badge (id="platform-version-badge")
    html = html.replace(
      /(<span[^>]+id="platform-version-badge"[^>]*>)[^<]*(<\/span>)/,
      `$1v${pkgData.version}$2`
    );

    // Update the title tooltip with build time
    html = html.replace(
      /(<span[^>]+id="platform-version-badge"[^>]*)title="[^"]*"([^>]*>)/,
      `$1title="Compiled on: ${buildTime}"$2`
    );

    // If no title attribute yet, inject it
    if (!html.includes('title="Compiled on:')) {
      html = html.replace(
        /(<span[^>]+id="platform-version-badge")([^>]*>)/,
        `$1 title="Compiled on: ${buildTime}"$2`
      );
    }

    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    console.log(`[slr-ide] index.html synced → v${pkgData.version} (${buildTime})`);
  }
} catch (err) {
  console.error('[slr-ide] Failed to bump version:', err);
}
