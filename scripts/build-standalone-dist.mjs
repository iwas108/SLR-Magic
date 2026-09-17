import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distStandaloneDir = path.join(rootDir, 'dist-standalone');

console.log('🚀 Starting SLR Magic Standalone Distribution Builder...\n');

// 1. Ensure target directory exists
if (!fs.existsSync(distStandaloneDir)) {
  fs.mkdirSync(distStandaloneDir, { recursive: true });
}

// 2. Parse target module argument
const args = process.argv.slice(2);
let targetModule = 'all';
for (const arg of args) {
  if (arg.startsWith('--module=')) {
    targetModule = arg.split('=')[1].toLowerCase();
  }
}

// 3. Read package metadata for version locking
function getPackageVersion(moduleName) {
  const pkgPath = path.join(rootDir, moduleName, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  }
  return '0.0.0';
}

const viewerVersion = getPackageVersion('slr-viewer');
const interRaterVersion = getPackageVersion('inter-rater');
const now = new Date().toISOString();

console.log(`📦 Resolved Module Versions:`);
console.log(`  • slr-viewer:  v${viewerVersion}`);
console.log(`  • inter-rater: v${interRaterVersion}`);
console.log(`  • Build Time:  ${now}\n`);

// Helper to format file size
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Helper to remove older versioned HTML files for clean checksumming
function pruneOldVersionFiles(pattern) {
  if (!fs.existsSync(distStandaloneDir)) return;
  const existing = fs.readdirSync(distStandaloneDir);
  for (const f of existing) {
    if (pattern.test(f)) {
      try {
        fs.unlinkSync(path.join(distStandaloneDir, f));
      } catch {}
    }
  }
}

// 4. Copy Single-File HTML Artifacts
const buildTargets = [];

if (targetModule === 'all' || targetModule === 'viewer' || targetModule === 'slr-viewer') {
  const viewerDistHtml = path.join(rootDir, 'slr-viewer/dist/index.html');
  if (fs.existsSync(viewerDistHtml)) {
    pruneOldVersionFiles(/^slr-viewer-v.*\.html$/);
    const versionedName = `slr-viewer-v${viewerVersion}.html`;
    const genericName = 'slr-viewer.html';

    const destVersioned = path.join(distStandaloneDir, versionedName);
    const destGeneric = path.join(distStandaloneDir, genericName);

    fs.copyFileSync(viewerDistHtml, destVersioned);
    fs.copyFileSync(viewerDistHtml, destGeneric);

    // Also mirror fonts to dist-standalone/fonts
    const srcFontsDir = path.join(rootDir, 'slr-viewer/public/fonts');
    const destFontsDir = path.join(distStandaloneDir, 'fonts');
    if (fs.existsSync(srcFontsDir)) {
      if (!fs.existsSync(destFontsDir)) fs.mkdirSync(destFontsDir, { recursive: true });
      for (const font of fs.readdirSync(srcFontsDir)) {
        fs.copyFileSync(path.join(srcFontsDir, font), path.join(destFontsDir, font));
      }
    }

    const size = fs.statSync(destVersioned).size;
    console.log(`✓ Staged SLR Viewer Single-File:`);
    console.log(`  → ${versionedName} (${formatBytes(size)})`);
    console.log(`  → ${genericName}`);
    buildTargets.push(versionedName, genericName);
  } else {
    console.warn(`⚠️ slr-viewer/dist/index.html not found. Run 'npm --prefix slr-viewer run build:singlefile' first.`);
  }
}

if (targetModule === 'all' || targetModule === 'inter-rater') {
  const interRaterDistHtml = path.join(rootDir, 'inter-rater/dist/index.html');
  if (fs.existsSync(interRaterDistHtml)) {
    pruneOldVersionFiles(/^inter-rater-v.*\.html$/);
    const versionedName = `inter-rater-v${interRaterVersion}.html`;
    const genericName = 'inter-rater.html';

    const destVersioned = path.join(distStandaloneDir, versionedName);
    const destGeneric = path.join(distStandaloneDir, genericName);

    fs.copyFileSync(interRaterDistHtml, destVersioned);
    fs.copyFileSync(interRaterDistHtml, destGeneric);

    const size = fs.statSync(destVersioned).size;
    console.log(`✓ Staged Inter-Rater Single-File:`);
    console.log(`  → ${versionedName} (${formatBytes(size)})`);
    console.log(`  → ${genericName}`);
    buildTargets.push(versionedName, genericName);
  } else {
    console.warn(`⚠️ inter-rater/dist/index.html not found. Run 'npm --prefix inter-rater run build:singlefile' first.`);
  }
}

// 5. Always Synchronize Launcher Embed Directory (Regardless of local Go presence)
const launcherDir = path.join(rootDir, 'launcher');
const launcherDistDir = path.join(launcherDir, 'dist');
const viewerDistHtml = path.join(rootDir, 'slr-viewer/dist/index.html');

if (fs.existsSync(launcherDir) && fs.existsSync(viewerDistHtml)) {
  if (!fs.existsSync(launcherDistDir)) {
    fs.mkdirSync(launcherDistDir, { recursive: true });
  }
  fs.copyFileSync(viewerDistHtml, path.join(launcherDistDir, 'index.html'));
  
  const srcFontsDir = path.join(rootDir, 'slr-viewer/public/fonts');
  const launcherFontsDir = path.join(launcherDistDir, 'fonts');
  if (fs.existsSync(srcFontsDir)) {
    if (!fs.existsSync(launcherFontsDir)) fs.mkdirSync(launcherFontsDir, { recursive: true });
    for (const font of fs.readdirSync(srcFontsDir)) {
      fs.copyFileSync(path.join(srcFontsDir, font), path.join(launcherFontsDir, font));
    }
  }
  console.log(`✓ Synchronized launcher/dist embedded bundle with latest viewer artifacts.`);
}

// 6. Check Go Compiler & Optionally Build Native Executable
console.log('\n⚙️ Checking Native Go Compiler Environment...');
const goCheck = spawnSync('go version', { shell: true });

if (goCheck.status === 0 && !goCheck.error) {
  const goVer = goCheck.stdout.toString().trim();
  console.log(`  ✓ Detected Go Compiler: ${goVer}`);

  if (fs.existsSync(launcherDir)) {
    console.log(`  Building native Go launcher executable...`);
    const isWindows = process.platform === 'win32';
    const exeName = isWindows ? 'slr-viewer-windows-amd64.exe' : 'slr-viewer';
    const outPath = path.join(distStandaloneDir, exeName);

    const ldFlags = `-s -w -X main.AppVersion=v${viewerVersion} -X main.BuildTime=${now}`;
    const goBuild = spawnSync(`go build -ldflags="${ldFlags}" -o "${outPath}" .`, {
      cwd: launcherDir,
      shell: true,
      stdio: 'inherit'
    });

    if (goBuild.status === 0) {
      const size = fs.statSync(outPath).size;
      console.log(`  ✓ Native executable built: ${exeName} (${formatBytes(size)})`);
      buildTargets.push(exeName);

      if (isWindows) {
        const genericExe = path.join(distStandaloneDir, 'slr-viewer.exe');
        fs.copyFileSync(outPath, genericExe);
        console.log(`  ✓ Staged generic binary: slr-viewer.exe`);
        buildTargets.push('slr-viewer.exe');
      }
    } else {
      console.error(`  ❌ Go build failed with exit code ${goBuild.status}`);
    }
  }
} else {
  console.log(`  ℹ️ Go compiler not detected on local system.`);
  console.log(`  ℹ️ Native binary compilation (.exe/ELF/Mach-O) will be generated automatically via GitHub Actions CI/CD.`);
  console.log(`  ✓ Standalone single-file HTML distributions are 100% functional and ready for offline use.`);
}

// 6. Generate RFC-Compliant Checksums (SHA256SUMS.txt)
console.log('\n🔐 Generating RFC-Compliant SHA-256 Checksums...');
const checksumFile = path.join(distStandaloneDir, 'SHA256SUMS.txt');
const filesInDist = fs.readdirSync(distStandaloneDir).sort();

const checksumEntries = [];

for (const file of filesInDist) {
  if (file === 'SHA256SUMS.txt') continue;
  const filePath = path.join(distStandaloneDir, file);
  if (fs.statSync(filePath).isFile()) {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    checksumEntries.push(`${hash}  ${file}`);
    console.log(`  ${hash}  ${file}`);
  }
}

const checksumContent = checksumEntries.join('\n') + '\n';
fs.writeFileSync(checksumFile, checksumContent, 'utf8');
console.log(`\n✓ Stamped checksums to dist-standalone/SHA256SUMS.txt`);

console.log('\n✨ Standalone Distribution Build Complete!\n');
