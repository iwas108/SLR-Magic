import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import db, { getConfig, setConfig, PROJECT_ROOT } from '../db';

declare global {
  var backupIntervalHandle: NodeJS.Timeout | undefined;
  var lastBackupTime: number | undefined;
  var lastCheckedMtime: number | undefined;
  var ignoreMtimeChange: boolean | undefined;
  var isBackupRunning: boolean | undefined;
}

export function startBackupScheduler() {
  if (global.backupIntervalHandle) {
    // Already running (e.g. hot reload in development)
    return;
  }

  const dbDir = path.resolve(PROJECT_ROOT, 'db');
  const dbPath = path.join(dbDir, 'slr.db');

  // Initialize in-memory state on first start
  if (global.lastBackupTime === undefined) {
    const persisted = getConfig('LAST_BACKUP_TIMESTAMP', '');
    global.lastBackupTime = persisted ? parseInt(persisted, 10) : Date.now();
  }

  if (global.lastCheckedMtime === undefined) {
    if (fs.existsSync(dbPath)) {
      global.lastCheckedMtime = fs.statSync(dbPath).mtimeMs;
    } else {
      global.lastCheckedMtime = Date.now();
    }
  }

  console.log('[Backup Service] Starting background scheduler ticker...');

  // Tick every 10 seconds to check if backup is due
  global.backupIntervalHandle = setInterval(async () => {
    try {
      const enabled = getConfig('BACKUP_AUTO_ENABLED', 'false') === 'true';
      const destination = getConfig('BACKUP_DESTINATION', '').trim();

      if (!enabled || !destination) {
        return;
      }

      if (global.isBackupRunning) {
        return;
      }

      const triggerType = getConfig('BACKUP_TRIGGER', 'interval');
      const now = Date.now();

      if (triggerType === 'interval') {
        const intervalMins = Math.max(1, parseInt(getConfig('BACKUP_INTERVAL_MINS', '60'), 10));
        const intervalMs = intervalMins * 60 * 1000;

        if (now - (global.lastBackupTime || 0) >= intervalMs) {
          console.log(`[Backup Service] Triggered by interval (${intervalMins} mins). Last backup: ${new Date(global.lastBackupTime || 0).toLocaleTimeString()}`);
          await runRcloneBackup(destination);
        }
      } else if (triggerType === 'change') {
        if (!fs.existsSync(dbPath)) {
          return;
        }

        const currentMtime = fs.statSync(dbPath).mtimeMs;

        if (global.ignoreMtimeChange) {
          return;
        }

        if (currentMtime > (global.lastCheckedMtime || 0)) {
          // Database changed! Check minimum 1 minute spacing constraint
          const minSpacingMs = 60 * 1000;
          if (now - (global.lastBackupTime || 0) >= minSpacingMs) {
            console.log(`[Backup Service] Triggered by database changes. Last backup: ${new Date(global.lastBackupTime || 0).toLocaleTimeString()}`);
            global.lastCheckedMtime = currentMtime;
            await runRcloneBackup(destination);
          }
        }
      }
    } catch (err) {
      console.error('[Backup Service] Error in scheduler tick:', err);
    }
  }, 10000); // 10-second tick
}

export async function runRcloneBackup(destination: string): Promise<boolean> {
  global.isBackupRunning = true;
  console.log(`[Backup Service] Initiating backup of db/ directory to: ${destination}`);

  try {
    const rclonePath = getConfig('RCLONE_EXECUTABLE_PATH', 'rclone');
    const configPath = getConfig('RCLONE_CONFIG_PATH', '');
    const sourceDir = path.resolve(PROJECT_ROOT, 'db');

    const syncArgs = ['copy', sourceDir, destination];
    if (configPath) {
      syncArgs.push('--config', configPath);
    }

    // Add filters to avoid backing up lock/temporary files
    syncArgs.push('--exclude', 'slr.db-journal');
    syncArgs.push('--exclude', 'slr.db-shm');

    const exitCode = await new Promise<number>((resolve) => {
      const child = spawn(rclonePath, syncArgs);
      
      child.stdout?.on('data', (data) => {
        console.log(`[Backup Rclone stdout]: ${data.toString().trim()}`);
      });
      
      child.stderr?.on('data', (data) => {
        console.warn(`[Backup Rclone stderr]: ${data.toString().trim()}`);
      });

      child.on('close', resolve);
    });

    if (exitCode === 0) {
      const now = Date.now();
      global.lastBackupTime = now;
      
      // Update database persisted timestamp safely
      global.ignoreMtimeChange = true;
      setConfig('LAST_BACKUP_TIMESTAMP', String(now));
      
      const dbPath = path.resolve(PROJECT_ROOT, 'db', 'slr.db');
      if (fs.existsSync(dbPath)) {
        global.lastCheckedMtime = fs.statSync(dbPath).mtimeMs;
      }
      global.ignoreMtimeChange = false;

      console.log('[Backup Service] Database backup completed successfully.');
      return true;
    } else {
      console.error(`[Backup Service] Backup failed with exit code: ${exitCode}`);
      return false;
    }
  } catch (err) {
    console.error('[Backup Service] Failed to run backup process:', err);
    return false;
  } finally {
    global.isBackupRunning = false;
  }
}
