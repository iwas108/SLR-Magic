import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const script = isWindows 
  ? { command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(rootDir, 'install.ps1')] }
  : { command: 'bash', args: [path.join(rootDir, 'install.sh')] };

console.log(`[SLR Magic] Launching ${isWindows ? 'PowerShell' : 'Bash'} setup installer on ${process.platform}...`);

const child = spawn(script.command, script.args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('[SLR Magic Setup Error]:', err);
  process.exit(1);
});
