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

  try {
    const rclonePath = getConfig('RCLONE_EXECUTABLE_PATH', 'rclone');
    const configPath = getConfig('RCLONE_CONFIG_PATH', '');
    const sourceDir = path.resolve(PROJECT_ROOT, 'db');

    // Collect all unique destinations to add redundancy
    const dests: string[] = [];

    if (destination.includes(':')) {
      // If it already has a remote name (e.g. "gdrive:path"), use it as is
      dests.push(destination);
    } else {
      // Resolve all unique remotes configured in projects or global configurations
      const remotesSet = new Set<string>();

      // 1. Remote from the active project
      const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
      try {
        const activeProject = db.prepare("SELECT rclone_remote_name FROM projects WHERE id = ?").get(activeProjectId) as any;
        if (activeProject?.rclone_remote_name) {
          remotesSet.add(activeProject.rclone_remote_name.trim());
        }
      } catch (e) {
        console.error('[Backup Service] Failed to get active project remote:', e);
      }

      // 2. Remotes from all projects in the database to build redundancy
      try {
        const projects = db.prepare("SELECT DISTINCT rclone_remote_name FROM projects WHERE rclone_remote_name IS NOT NULL AND rclone_remote_name != ''").all() as any[];
        projects.forEach(p => {
          if (p.rclone_remote_name) {
            remotesSet.add(p.rclone_remote_name.trim());
          }
        });
      } catch (e) {
        console.error('[Backup Service] Failed to get projects remotes:', e);
      }

      // 3. Global default remote setting
      const globalRemote = getConfig('RCLONE_REMOTE_NAME', 'gdrive').trim();
      if (globalRemote) {
        remotesSet.add(globalRemote);
      }

      // Fallback to gdrive if none are configured
      if (remotesSet.size === 0) {
        remotesSet.add('gdrive');
      }

      // Prefix the relative BACKUP_DESTINATION path with each remote prefix
      remotesSet.forEach(remote => {
        dests.push(`${remote}:${destination}`);
      });
    }

    console.log(`[Backup Service] Initiating backup of db/ directory to cloud destinations:`, dests);

    let successCount = 0;

    for (const targetDest of dests) {
      console.log(`[Backup Service] Copying db/ directory to: ${targetDest}`);
      const syncArgs = ['copy', sourceDir, targetDest];
      if (configPath) {
        syncArgs.push('--config', configPath);
      }

      // Add filters to avoid backing up lock/temporary files
      syncArgs.push('--exclude', 'slr.db-journal');
      syncArgs.push('--exclude', 'slr.db-shm');

      try {
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
          console.log(`[Backup Service] Backup to ${targetDest} completed successfully.`);
          successCount++;
        } else {
          console.error(`[Backup Service] Backup to ${targetDest} failed with exit code: ${exitCode}`);
        }
      } catch (err) {
        console.error(`[Backup Service] Failed to execute backup to ${targetDest}:`, err);
      }
    }

    if (successCount > 0) {
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

      console.log(`[Backup Service] Database backup process complete. Successes: ${successCount}/${dests.length}`);
      return true;
    } else {
      console.error('[Backup Service] Database backup failed for all destinations.');
      return false;
    }
  } catch (err) {
    console.error('[Backup Service] Failed to run backup process:', err);
    return false;
  } finally {
    global.isBackupRunning = false;
  }
}
