import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd().endsWith('slr-ide') ? process.cwd() : path.join(process.cwd(), 'slr-ide');

/**
 * Self-healing database & filesystem migration:
 * Permanently migrates legacy 'default-project' records to 'proj-global-predictive-dt'
 * across all 11 project-tied SQLite tables and renames filesystem PDF storage directories.
 */
export function migrateProjectIds(db: Database.Database): void {
  try {
    // 1. One-time Migration of legacy 'default-project' record
    const legacyProject = db.prepare("SELECT * FROM projects WHERE id = 'default-project'").get() as any;
    
    if (legacyProject) {
      console.log("[DB Migration] Found legacy 'default-project'. Migrating to 'proj-global-predictive-dt'...");
      
      const newProjectId = 'proj-global-predictive-dt';
      const newFolderName = 'global_predictive_dt';

      // Atomic 11-table update respecting Foreign Key constraints
      const migrateTx = db.transaction(() => {
        // Step A: Insert new project entry with new ID & folder_name if not exists
        db.prepare(`
          INSERT OR IGNORE INTO projects (
            id, name, folder_name, manifesto, objective, questions, qa_definition, exclusion_criteria,
            pool_a_size, pool_b_size, pool_c_size, gdrive_dest_path, cloud_provider, rclone_remote_name,
            pool_tags, ec_rules, reasoning_template, pool_b_ec_rules, pool_b_reasoning_template,
            pool_c_qa_rules, pool_c_extraction_rules, project_budget_limit, project_tax,
            scopus_search_string, manual_search_string, llm_config, rolling_batch_size, created_at
          )
          SELECT 
            ?, 'Global Predictive DT', ?, manifesto, objective, questions, qa_definition, exclusion_criteria,
            pool_a_size, pool_b_size, pool_c_size, gdrive_dest_path, cloud_provider, rclone_remote_name,
            pool_tags, ec_rules, reasoning_template, pool_b_ec_rules, pool_b_reasoning_template,
            pool_c_qa_rules, pool_c_extraction_rules, project_budget_limit, project_tax,
            scopus_search_string, manual_search_string, llm_config, rolling_batch_size, created_at
          FROM projects WHERE id = 'default-project'
        `).run(newProjectId, newFolderName);

        // Step B: Update papers & PDF paths
        db.prepare(`
          UPDATE papers 
          SET Project_ID = ?,
              Local_PDF_Path = REPLACE(Local_PDF_Path, 'pdf_library/repo/default_project/', 'pdf_library/repo/global_predictive_dt/')
          WHERE Project_ID = 'default-project'
        `).run(newProjectId);

        // Step C: Update remaining project-tied tables
        db.prepare("UPDATE calibration_papers SET Project_ID = ? WHERE Project_ID = 'default-project'").run(newProjectId);
        
        try { db.prepare("UPDATE reviewer_decisions SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE calibration_commit_ledger SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE manual_audit_log SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE llm_audit_log SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE duplicate_pairs SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE rolling_batches SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE rolling_batch_papers SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE rolling_batch_reviewer_decisions SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE rolling_batch_commit_ledger SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}
        try { db.prepare("UPDATE umbrellanizer_results SET project_id = ? WHERE project_id = 'default-project'").run(newProjectId); } catch (e) {}

        // Step D: Delete legacy 'default-project' from projects table
        db.prepare("DELETE FROM projects WHERE id = 'default-project'").run();

        // Step E: Update ACTIVE_PROJECT_ID config
        const activeProjConfig = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
        if (!activeProjConfig || activeProjConfig.value === 'default-project' || !activeProjConfig.value) {
          db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', ?)").run(newProjectId);
        }
      });

      migrateTx();
      console.log("[DB Migration] Successfully migrated database records to 'proj-global-predictive-dt'.");

      // Rename Filesystem PDF repository folder if present
      const oldPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', 'default_project');
      const newPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', newFolderName);
      
      if (fs.existsSync(oldPdfDir) && !fs.existsSync(newPdfDir)) {
        try {
          fs.renameSync(oldPdfDir, newPdfDir);
          console.log(`[Filesystem Migration] Renamed ${oldPdfDir} -> ${newPdfDir}`);
        } catch (fsErr) {
          console.error(`[Filesystem Migration] Failed to rename PDF directory:`, fsErr);
        }
      }

      // Rename compression manifest if present
      const oldManifest = path.join(PROJECT_ROOT, 'db', 'compression_manifest_default_project.json');
      const newManifest = path.join(PROJECT_ROOT, 'db', `compression_manifest_${newFolderName}.json`);
      if (fs.existsSync(oldManifest) && !fs.existsSync(newManifest)) {
        try {
          fs.renameSync(oldManifest, newManifest);
        } catch (e) {}
      }
    }

    // 2. Validate ACTIVE_PROJECT_ID
    const activeProjectRow = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
    let activeProjectId = activeProjectRow?.value;

    if (activeProjectId === 'default-project') {
      // Clean up stale 'default-project' config
      const firstProject = db.prepare("SELECT id FROM projects ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
      activeProjectId = firstProject?.id || '';
      db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', ?)").run(activeProjectId);
    }

    // 3. Normalize any orphaned paper rows with empty or NULL Project_ID to current active project
    if (activeProjectId) {
      const updatePapers = db.prepare("UPDATE papers SET Project_ID = ? WHERE Project_ID IS NULL OR Project_ID = ''");
      const updateCalPapers = db.prepare("UPDATE calibration_papers SET Project_ID = ? WHERE Project_ID IS NULL OR Project_ID = ''");
      const papersResult = updatePapers.run(activeProjectId);
      const calResult = updateCalPapers.run(activeProjectId);

      if (papersResult.changes > 0 || calResult.changes > 0) {
        console.log(`[DB Migration] Normalized ${papersResult.changes} papers and ${calResult.changes} calibration papers to project: ${activeProjectId}`);
      }
    }
  } catch (err) {
    console.error('[DB Migration] Error during Project_ID normalization:', err);
  }
}
