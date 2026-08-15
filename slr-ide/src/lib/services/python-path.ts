import path from 'path';
import fs from 'fs';
import { PROJECT_ROOT } from '@/lib/db';

/**
 * Returns the expected location of Python inside the local virtual environment
 * according to the host platform.
 * - Windows: python_engine/venv/Scripts/python.exe
 * - Linux / macOS: python_engine/venv/bin/python
 */
export function getVenvPythonPath(root: string = PROJECT_ROOT): string {
  const isWindows = process.platform === 'win32';
  const primaryPath = isWindows
    ? path.join(root, 'python_engine', 'venv', 'Scripts', 'python.exe')
    : path.join(root, 'python_engine', 'venv', 'bin', 'python');

  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  // Alternate path fallback (for hybrid / WSL / cross-mounted directory structures)
  const alternatePath = isWindows
    ? path.join(root, 'python_engine', 'venv', 'bin', 'python')
    : path.join(root, 'python_engine', 'venv', 'Scripts', 'python.exe');

  if (fs.existsSync(alternatePath)) {
    return alternatePath;
  }

  return primaryPath;
}

/**
 * Returns true if the virtual environment Python binary exists on disk.
 */
export function isPythonVenvPresent(root: string = PROJECT_ROOT): boolean {
  return fs.existsSync(getVenvPythonPath(root));
}

/**
 * Resolves the executable path to Python.
 * Prioritizes the virtual environment if present; otherwise returns system python.
 */
export function getPythonExecutablePath(root: string = PROJECT_ROOT): string {
  const venvPath = getVenvPythonPath(root);
  if (fs.existsSync(venvPath)) {
    return venvPath;
  }
  return process.platform === 'win32' ? 'python.exe' : 'python3';
}
