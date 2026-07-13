import db from '@/lib/db';

export const pipelineLock = {
  isLocked: (): boolean => {
    try {
      const row = db.prepare(`SELECT value FROM configs WHERE key = 'PIPELINE_ACTIVE_LOCK'`).get() as any;
      return row && row.value === 'true';
    } catch (e) {
      console.error('Failed to check pipeline lock:', e);
      return false; // Default to unlocked on DB error
    }
  },

  acquire: (): boolean => {
    try {
      db.prepare(`UPDATE configs SET value = 'true' WHERE key = 'PIPELINE_ACTIVE_LOCK'`).run();
      return true;
    } catch (e) {
      console.error('Failed to acquire pipeline lock:', e);
      return false;
    }
  },

  release: (): boolean => {
    try {
      db.prepare(`UPDATE configs SET value = 'false' WHERE key = 'PIPELINE_ACTIVE_LOCK'`).run();
      return true;
    } catch (e) {
      console.error('Failed to release pipeline lock:', e);
      return false;
    }
  }
};
