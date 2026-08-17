import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const slrIdeDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(slrIdeDir, '..');

// Helper to load JSON or env configs
function loadConfig() {
  const candidateJsonFiles = [
    path.join(rootDir, 'slr-magic.config.json'),
    path.join(rootDir, 'slr.config.json'),
    path.join(slrIdeDir, 'slr-magic.config.json'),
    path.join(slrIdeDir, 'slr.config.json'),
  ];

  for (const jsonPath of candidateJsonFiles) {
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        const host = parsed.modules?.slr_ide?.host || parsed.server?.host || parsed.host || '0.0.0.0';
        const port = parsed.modules?.slr_ide?.port || parsed.server?.port || parsed.port || 3000;
        return { host: String(host), port: Number(port), source: jsonPath };
      } catch (e) {
        console.warn(`[Config] Failed to parse ${jsonPath}:`, e.message);
      }
    }
  }

  const candidateEnvFiles = [
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env'),
    path.join(slrIdeDir, '.env.local'),
    path.join(slrIdeDir, '.env'),
  ];

  let envHost = process.env.SLR_IDE_HOST || process.env.HOSTNAME || process.env.HOST;
  let envPort = process.env.SLR_IDE_PORT || process.env.PORT;
  let envSource = 'Environment Variables';

  for (const envPath of candidateEnvFiles) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...v] = trimmed.split('=');
        const key = k?.trim();
        const val = v.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key === 'SLR_IDE_HOST' || (!envHost && (key === 'HOSTNAME' || key === 'HOST'))) {
          envHost = val;
          envSource = envPath;
        }
        if (key === 'SLR_IDE_PORT' || (!envPort && key === 'PORT')) {
          envPort = val;
          envSource = envPath;
        }
      }
    }
  }

  const finalHost = (envHost && envHost.toLowerCase() === 'localhost') ? '127.0.0.1' : (envHost || '0.0.0.0');

  return {
    host: finalHost,
    port: Number(envPort || 3000),
    source: envSource,
  };
}

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

// 1. Check if production build exists; if not, build first
const buildIdPath = path.join(slrIdeDir, '.next', 'BUILD_ID');
if (!fs.existsSync(buildIdPath)) {
  console.log('\x1b[33m%s\x1b[0m', '====================================================================');
  console.log('\x1b[33m%s\x1b[0m', ' [INFO] No production build detected in slr-ide/.next.               ');
  console.log('\x1b[33m%s\x1b[0m', '        Building SLR-IDE production bundle automatically...         ');
  console.log('\x1b[33m%s\x1b[0m', '====================================================================');
  
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const buildResult = spawnSync(npmCmd, ['run', 'build'], {
    cwd: slrIdeDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  
  if (buildResult.status !== 0) {
    console.error('\x1b[31m[ERROR] Failed to compile production build.\x1b[0m');
    process.exit(buildResult.status || 1);
  }
}

const config = loadConfig();
const localIps = getLocalIps();

console.log('\x1b[36m%s\x1b[0m', '====================================================================');
console.log('\x1b[36m%s\x1b[0m', '            SLR Magic - SLR-IDE Production Server Launcher          ');
console.log('\x1b[36m%s\x1b[0m', '====================================================================');
console.log(`\x1b[90mConfiguration Source: \x1b[0m\x1b[33m${config.source}\x1b[0m`);
console.log(`\x1b[90mBinding Interface:    \x1b[0m\x1b[32m${config.host}\x1b[0m (Port: \x1b[32m${config.port}\x1b[0m)`);

if (config.host === '0.0.0.0') {
  console.log('\x1b[90mAccess URLs:\x1b[0m');
  console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mLocal:    \x1b[0m\x1b[36mhttp://localhost:${config.port}\x1b[0m`);
  for (const ip of localIps) {
    console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mNetwork:  \x1b[0m\x1b[36mhttp://${ip.address}:${config.port}\x1b[0m \x1b[90m(${ip.name})\x1b[0m`);
  }
} else {
  console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mLocal:    \x1b[0m\x1b[36mhttp://${config.host}:${config.port}\x1b[0m`);
}
console.log('\x1b[36m%s\x1b[0m\n', '====================================================================');

const cmdStr = `npx next start -H ${config.host} -p ${config.port}`;

const child = spawn(cmdStr, {
  cwd: slrIdeDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: config.host,
    PORT: String(config.port),
  },
  shell: true,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Failed to start Next.js production server:', err);
  process.exit(1);
});
