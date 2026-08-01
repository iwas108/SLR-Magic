import Database from 'better-sqlite3';

/**
 * Normalizes all legacy paper and calibration paper records in slr.db
 * where Project_ID is NULL, '', or 'default-project' to match the active project ID.
 */
export function migrateProjectIds(db: Database.Database): void {
  try {
    // 1. Get or establish ACTIVE_PROJECT_ID
    const activeProjectRow = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
    let activeProjectId = activeProjectRow?.value;

    if (!activeProjectId || activeProjectId === 'default-project') {
      // Find the first available project in projects table
      const firstProject = db.prepare("SELECT id FROM projects ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
      if (firstProject?.id) {
        activeProjectId = firstProject.id;
        db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', ?)").run(activeProjectId);
      } else {
        // Create default project row if none exists
        activeProjectId = 'proj-default-1';
        db.prepare(`
          INSERT OR IGNORE INTO projects (id, name, folder_name, created_at)
          VALUES (?, 'Default Literature Review', 'default_repo', ?)
        `).run(activeProjectId, new Date().toISOString());
        db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', ?)").run(activeProjectId);
      }
    }

    // 2. Migrate legacy papers table rows (only where Project_ID is NULL or empty)
    const updatePapers = db.prepare(`
      UPDATE papers 
      SET Project_ID = ? 
      WHERE Project_ID IS NULL OR Project_ID = ''
    `);
    const papersResult = updatePapers.run(activeProjectId);

    // 3. Migrate legacy calibration_papers table rows (only where Project_ID is NULL or empty)
    const updateCalPapers = db.prepare(`
      UPDATE calibration_papers 
      SET Project_ID = ? 
      WHERE Project_ID IS NULL OR Project_ID = ''
    `);
    const calResult = updateCalPapers.run(activeProjectId);

    if (papersResult.changes > 0 || calResult.changes > 0) {
      console.log(`[DB Migration] Normalized ${papersResult.changes} papers and ${calResult.changes} calibration papers to active project ID: ${activeProjectId}`);
    }
  } catch (err) {
    console.error('[DB Migration] Failed to normalize Project_ID records:', err);
  }
}
