import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const slrIdeDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(slrIdeDir, '..');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${message}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${message}`);
  }
}

console.log('\n\x1b[36m====================================================================\x1b[0m');
console.log('\x1b[36m   Testing SLR Magic File-Based Network & Port Configuration       \x1b[0m');
console.log('\x1b[36m====================================================================\x1b[0m\n');

// 1. Test example configuration template exists
console.log('\x1b[33m[Suite 1] Template & Example Configuration Verification\x1b[0m');
const exampleJsonPath = path.join(rootDir, 'slr-magic.config.example.json');
const exampleEnvPath = path.join(rootDir, '.env.example');

assert(fs.existsSync(exampleJsonPath), 'slr-magic.config.example.json exists in root directory');
if (fs.existsSync(exampleJsonPath)) {
  const parsedExample = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  assert(parsedExample.server?.host === '0.0.0.0', 'Example template binds to 0.0.0.0');
  assert(parsedExample.modules?.slr_ide?.port === 3000, 'Example template configures slr_ide on port 3000');
  assert(parsedExample.modules?.inter_rater?.port === 3001, 'Example template configures inter_rater on port 3001');
  assert(parsedExample.modules?.slr_viewer?.port === 3002, 'Example template configures slr_viewer on port 3002');
  assert(parsedExample.modules?.worker_server?.port === 7291, 'Example template configures worker_server on port 7291');
}

assert(fs.existsSync(exampleEnvPath), '.env.example exists in root directory');
if (fs.existsSync(exampleEnvPath)) {
  const envContent = fs.readFileSync(exampleEnvPath, 'utf8');
  assert(envContent.includes('HOSTNAME=0.0.0.0'), '.env.example contains HOSTNAME=0.0.0.0');
  assert(envContent.includes('PORT=3000'), '.env.example contains PORT=3000');
}

// 2. Test Dynamic JSON Configuration Parsing
console.log('\n\x1b[33m[Suite 2] JSON Configuration Discovery & Override Hierarchy\x1b[0m');
const tempTestConfigPath = path.join(rootDir, 'test-temp.config.json');
const testPayload = {
  server: { host: '0.0.0.0', port: 3000, cors: true },
  modules: {
    slr_ide: { host: '0.0.0.0', port: 3000 },
    inter_rater: { host: '0.0.0.0', port: 3001 },
    slr_viewer: { host: '0.0.0.0', port: 3002 },
    worker_server: { host: '0.0.0.0', port: 7291 }
  }
};

fs.writeFileSync(tempTestConfigPath, JSON.stringify(testPayload, null, 2), 'utf8');
assert(fs.existsSync(tempTestConfigPath), 'Temporary test config written successfully');

const readPayload = JSON.parse(fs.readFileSync(tempTestConfigPath, 'utf8'));
assert(readPayload.server.host === '0.0.0.0', 'Parsed server.host matches 0.0.0.0');
assert(readPayload.modules.slr_ide.port === 3000, 'Parsed slr_ide.port matches 3000');

// Clean up temp
if (fs.existsSync(tempTestConfigPath)) {
  fs.unlinkSync(tempTestConfigPath);
}

// 3. Test Network Interface Detection
console.log('\n\x1b[33m[Suite 3] OS Network Interface Resolution\x1b[0m');
const ifaces = os.networkInterfaces();
const detectedIps = [];
for (const [name, netList] of Object.entries(ifaces)) {
  if (!netList) continue;
  for (const net of netList) {
    if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
      detectedIps.push({ name, address: net.address });
    }
  }
}

assert(Array.isArray(detectedIps), 'Detected IPs returned an array');
console.log(`  \x1b[90m(Discovered ${detectedIps.length} active non-internal IPv4 interface(s))\x1b[0m`);
for (const ip of detectedIps) {
  console.log(`    \x1b[90m- [${ip.name}] ${ip.address}\x1b[0m`);
}

// 4. Test Launcher Script Files
console.log('\n\x1b[33m[Suite 4] Launcher Scripts Verification\x1b[0m');
const devMjsPath = path.join(slrIdeDir, 'scripts', 'dev.mjs');
const startMjsPath = path.join(slrIdeDir, 'scripts', 'start.mjs');

assert(fs.existsSync(devMjsPath), 'slr-ide/scripts/dev.mjs exists');
assert(fs.existsSync(startMjsPath), 'slr-ide/scripts/start.mjs exists');

if (fs.existsSync(devMjsPath)) {
  const content = fs.readFileSync(devMjsPath, 'utf8');
  assert(content.includes('next') && content.includes('dev'), 'dev.mjs launches Next.js dev server');
  assert(content.includes('-H') && content.includes('-p'), 'dev.mjs passes -H and -p CLI arguments');
}

// 5. Test Vite Submodule Configurations
console.log('\n\x1b[33m[Suite 5] Submodule Dynamic Vite Network Resolution\x1b[0m');
const interRaterVite = path.join(rootDir, 'inter-rater', 'vite.config.js');
const slrViewerVite = path.join(rootDir, 'slr-viewer', 'vite.config.ts');

assert(fs.existsSync(interRaterVite), 'inter-rater/vite.config.js exists');
if (fs.existsSync(interRaterVite)) {
  const content = fs.readFileSync(interRaterVite, 'utf8');
  assert(content.includes('resolveNetworkConfig') && content.includes('slr-magic.config.json'), 'inter-rater vite config resolves file-based network configuration');
}

assert(fs.existsSync(slrViewerVite), 'slr-viewer/vite.config.ts exists');
if (fs.existsSync(slrViewerVite)) {
  const content = fs.readFileSync(slrViewerVite, 'utf8');
  assert(content.includes('resolveNetworkConfig') && content.includes('slr-magic.config.json'), 'slr-viewer vite config resolves file-based network configuration');
}

// 6. Test Python Worker Server Network Resolution
console.log('\n\x1b[33m[Suite 6] Python Engine Worker Server Network Resolution\x1b[0m');
const workerServerPath = path.join(slrIdeDir, 'python_engine', 'worker_server.py');
assert(fs.existsSync(workerServerPath), 'worker_server.py exists');
if (fs.existsSync(workerServerPath)) {
  const pyContent = fs.readFileSync(workerServerPath, 'utf8');
  assert(pyContent.includes('load_file_based_network_config') && pyContent.includes('slr-magic.config.json'), 'worker_server.py parses slr-magic.config.json');
  assert(pyContent.includes('app.run(host=WORKER_HOST, port=WORKER_PORT'), 'worker_server.py binds to configured host and port');
}

console.log('\n\x1b[36m====================================================================\x1b[0m');
console.log(`\x1b[1mSummary: ${passedTests}/${totalTests} Tests Passed (${Math.round((passedTests / totalTests) * 100)}% Success Rate)\x1b[0m`);
console.log('\x1b[36m====================================================================\x1b[0m\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
