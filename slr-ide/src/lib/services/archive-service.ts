import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import db, { PROJECT_ROOT, getConfig, setConfig } from '@/lib/db';

export interface ArchiveManifest {
  format: 'SLR_PROJECT_ARCHIVE';
  schema_version: string;
  app_version: string;
  exported_at: string;
  project_id: string;
  project_name: string;
  folder_name: string;
  checksum: string;
  record_counts: Record<string, number>;
}

export interface ProjectArchivePayload {
  format?: 'SLR_PROJECT_ARCHIVE';
  manifest: ArchiveManifest;
  tables: {
    projects: any[];
    papers: any[];
    calibration_papers: any[];
    reviewer_decisions: any[];
    calibration_commit_ledger: any[];
    manual_audit_log: any[];
    llm_audit_log: any[];
    duplicate_pairs: any[];
    rolling_batches: any[];
    rolling_batch_papers: any[];
    rolling_batch_reviewer_decisions: any[];
    rolling_batch_commit_ledger: any[];
    umbrellanizer_results: any[];
    llm_jobs: any[];
    prompt_templates: any[];
  };
}

/**
 * Exports all project-tied records across all 15 relational tables into a single versioned archive structure.
 */
export function exportProjectArchive(projectId: string): {
  payload: ProjectArchivePayload;
  jsonString: string;
  filename: string;
  checksum: string;
} {
  if (!projectId) {
    throw new Error('Project ID is required for archiving');
  }

  const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
  if (!project) {
    throw new Error(`Project with ID '${projectId}' not found`);
  }

  // Query all 15 project-tied database tables
  const tables = {
    projects: [project],
    papers: db.prepare('SELECT * FROM papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    calibration_papers: db.prepare('SELECT * FROM calibration_papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    reviewer_decisions: db.prepare('SELECT * FROM reviewer_decisions WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    calibration_commit_ledger: db.prepare('SELECT * FROM calibration_commit_ledger WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    manual_audit_log: db.prepare('SELECT * FROM manual_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    llm_audit_log: db.prepare('SELECT * FROM llm_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    duplicate_pairs: db.prepare('SELECT * FROM duplicate_pairs WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    rolling_batches: db.prepare('SELECT * FROM rolling_batches WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    rolling_batch_papers: db.prepare('SELECT * FROM rolling_batch_papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    rolling_batch_reviewer_decisions: db.prepare('SELECT * FROM rolling_batch_reviewer_decisions WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    rolling_batch_commit_ledger: db.prepare('SELECT * FROM rolling_batch_commit_ledger WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    umbrellanizer_results: db.prepare('SELECT * FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    llm_jobs: db.prepare('SELECT * FROM llm_jobs WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
    prompt_templates: db.prepare('SELECT * FROM prompt_templates WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(projectId) as any[],
  };

  const recordCounts: Record<string, number> = {};
  for (const [key, rows] of Object.entries(tables)) {
    recordCounts[key] = rows.length;
  }

  // Calculate SHA-256 integrity hash of tables data
  const tablesString = JSON.stringify(tables);
  const checksum = crypto.createHash('sha256').update(tablesString).digest('hex');

  const manifest: ArchiveManifest = {
    format: 'SLR_PROJECT_ARCHIVE',
    schema_version: '1.0.0',
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.2',
    exported_at: new Date().toISOString(),
    project_id: project.id,
    project_name: project.name,
    folder_name: project.folder_name,
    checksum,
    record_counts: recordCounts
  };

  const payload: ProjectArchivePayload = {
    format: 'SLR_PROJECT_ARCHIVE',
    manifest,
    tables
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const sanitizedName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const filename = `${sanitizedName}_archive_${Date.now()}.slr`;

  return {
    payload,
    jsonString,
    filename,
    checksum
  };
}

/**
 * Creates a zip archive of the project's synced PDF repository folder (`pdf_library/repo/<folder_name>/`).
 */
export function createProjectPdfZipBuffer(projectId: string): { buffer: Buffer; filename: string; fileCount: number } | null {
  const project = db.prepare('SELECT folder_name, name FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as { folder_name: string; name: string } | undefined;
  if (!project || !project.folder_name) {
    return null;
  }

  const repoDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', project.folder_name);
  if (!fs.existsSync(repoDir)) {
    return null;
  }

  const files = fs.readdirSync(repoDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    return null;
  }

  const tempZipPath = path.join(PROJECT_ROOT, 'pdf_library', `temp_${project.folder_name}_${Date.now()}.zip`);
  
  // Locate python executable
  const venvPython = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
  const pythonExe = fs.existsSync(venvPython) ? venvPython : 'python';

  const pythonScript = `
import zipfile, sys, os
src_dir = sys.argv[1]
out_zip = sys.argv[2]
with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, src_dir)
                zipf.write(file_path, arcname)
`;

  try {
    const res = spawnSync(pythonExe, ['-c', pythonScript, repoDir, tempZipPath], {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    });

    if (res.error || !fs.existsSync(tempZipPath)) {
      console.error('Failed to create PDF zip:', res.error || res.stderr);
      return null;
    }

    const buffer = fs.readFileSync(tempZipPath);
    try {
      fs.unlinkSync(tempZipPath);
    } catch (_) {}

    const sanitizedName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return {
      buffer,
      filename: `${sanitizedName}_pdfs_${Date.now()}.zip`,
      fileCount: files.length
    };
  } catch (err) {
    console.error('Error creating PDF zip buffer:', err);
    return null;
  }
}

/**
 * Executes a zero-trace database wipe and SQLite VACUUM optimization for an archived project.
 * Handles project PDF retention according to user choice:
 * If keepPdfZip is false, project repo folder is deleted without copying to raw storage.
 * Pre-existing files in pdf_library/raw/ and pdf_library/cached/ remain intact as eternal storage.
 */
export function purgeProjectZeroTrace(projectId: string, keepPdfZip: boolean = false): {
  success: boolean;
  deletedTablesCount: number;
  vacuumCompleted: boolean;
  activeProjectSwitched: boolean;
  newActiveProjectId: string;
} {
  if (!projectId) {
    throw new Error('Project ID is required for purge');
  }

  const project = db.prepare('SELECT folder_name FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as { folder_name: string } | undefined;
  
  // Handle project repo folder cleanup
  if (project?.folder_name) {
    const repoDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', project.folder_name);
    if (fs.existsSync(repoDir)) {
      try {
        fs.rmSync(repoDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to delete repo folder ${repoDir}:`, err);
      }
    }
  }

  let activeProjectSwitched = false;
  let newActiveProjectId = '';

  const deleteTransaction = db.transaction(() => {
    // 1. Clear all 15 relational tables
    db.prepare('DELETE FROM reviewer_decisions WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM calibration_commit_ledger WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM calibration_papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM manual_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM llm_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM duplicate_pairs WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM rolling_batch_commit_ledger WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM rolling_batch_reviewer_decisions WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM rolling_batch_papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM rolling_batches WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM semantic_search_cache WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM llm_jobs WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM prompt_templates WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').run(projectId);
    db.prepare('DELETE FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').run(projectId);

    // 2. Manage active project reset
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    if (activeProjectId === projectId) {
      const nextProject = db.prepare('SELECT id FROM projects WHERE CAST(id AS TEXT) != CAST(? AS TEXT) LIMIT 1').get(projectId) as { id: string } | undefined;
      newActiveProjectId = nextProject ? nextProject.id : '';
      setConfig('ACTIVE_PROJECT_ID', newActiveProjectId);
      activeProjectSwitched = true;
    } else {
      newActiveProjectId = activeProjectId;
    }
  });

  deleteTransaction();

  // 3. SQLite Storage Reclamation & Performance Optimization
  let vacuumCompleted = false;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.exec('VACUUM');
    db.pragma('optimize');
    vacuumCompleted = true;
  } catch (optErr) {
    console.warn('SQLite optimization/VACUUM notice:', optErr);
  }

  return {
    success: true,
    deletedTablesCount: 15,
    vacuumCompleted,
    activeProjectSwitched,
    newActiveProjectId
  };
}

/**
 * Inspects live SQLite table definitions to get existing columns.
 */
function getTableColumns(tableName: string): Set<string> {
  try {
    const info = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
    return new Set(info.map(c => c.name));
  } catch (_) {
    return new Set();
  }
}

/**
 * Imports an archived project (.slr package) with:
 * - Dynamic schema adaptation (filtering obsolete columns, populating defaults)
 * - Project ID & Folder Name collision avoidance (auto-suffixing)
 * - Paper_ID conflict detection & cascading foreign key remapping across all 11+ relational tables
 * - Atomic transaction execution with 100% rollback protection
 */
export function importProjectArchive(archiveData: any): {
  success: boolean;
  project: { id: string; name: string; folder_name: string };
  recordCounts: Record<string, number>;
  remappedPapersCount: number;
  projectRenamed: boolean;
} {
  if (typeof archiveData === 'string') {
    try {
      archiveData = JSON.parse(archiveData);
    } catch (e: any) {
      throw new Error(`Failed to parse JSON archive string: ${e.message}`);
    }
  }

  // Unwrap nested wrapper keys if present
  if (archiveData.archiveData && typeof archiveData.archiveData === 'object') {
    archiveData = archiveData.archiveData;
  } else if (archiveData.data && typeof archiveData.data === 'object' && (archiveData.data.tables || archiveData.data.manifest || archiveData.data.project)) {
    archiveData = archiveData.data;
  }

  // Handle format normalization
  let rawTables: any = {};
  let originalProject: any = null;

  if (archiveData.tables && typeof archiveData.tables === 'object') {
    rawTables = archiveData.tables;
    originalProject = rawTables.projects?.[0] || archiveData.manifest || archiveData.project || {};
  } else if (archiveData.manifest && (archiveData.manifest.format === 'SLR_PROJECT_ARCHIVE' || archiveData.format === 'SLR_PROJECT_ARCHIVE')) {
    rawTables = archiveData.tables || {};
    originalProject = rawTables.projects?.[0] || archiveData.manifest || {};
  } else if (archiveData.format === 'SLR_PROJECT_ARCHIVE') {
    rawTables = archiveData.tables || {};
    originalProject = rawTables.projects?.[0] || archiveData.manifest || {};
  } else if (archiveData.project || archiveData.papers || archiveData.projects) {
    // Legacy / FAIR export fallback
    originalProject = archiveData.project || archiveData.projects?.[0] || {};
    rawTables = {
      projects: archiveData.project ? [archiveData.project] : (archiveData.projects || []),
      papers: archiveData.papers || [],
      calibration_papers: archiveData.calibration_papers || [],
      reviewer_decisions: archiveData.reviewer_decisions || [],
      calibration_commit_ledger: archiveData.calibration_commit_ledger || [],
      manual_audit_log: archiveData.manual_audit_log || [],
      llm_audit_log: archiveData.llm_audit_log || [],
      duplicate_pairs: archiveData.duplicate_pairs || [],
      rolling_batches: archiveData.rolling_batches || [],
      rolling_batch_papers: archiveData.rolling_batch_papers || [],
      rolling_batch_reviewer_decisions: archiveData.rolling_batch_reviewer_decisions || [],
      rolling_batch_commit_ledger: archiveData.rolling_batch_commit_ledger || [],
      umbrellanizer_results: archiveData.umbrellanizer_results || [],
      llm_jobs: archiveData.llm_jobs || [],
      prompt_templates: archiveData.prompt_templates || []
    };
  } else if (archiveData.session || archiveData.metadata) {
    const sessionObj = archiveData.session || archiveData.metadata || {};
    originalProject = {
      id: sessionObj.id || sessionObj.project_id || `proj-${Date.now()}`,
      name: sessionObj.name || sessionObj.project_name || 'Restored Session Project',
      folder_name: sessionObj.folder_name,
      objective: sessionObj.objective,
      questions: sessionObj.questions
    };
    rawTables = {
      projects: [originalProject],
      papers: archiveData.papers || [],
      calibration_papers: archiveData.calibration_papers || [],
      reviewer_decisions: archiveData.reviewer_decisions || [],
      calibration_commit_ledger: archiveData.calibration_commit_ledger || [],
      manual_audit_log: archiveData.manual_audit_log || [],
      llm_audit_log: archiveData.llm_audit_log || [],
      duplicate_pairs: archiveData.duplicate_pairs || [],
      rolling_batches: archiveData.rolling_batches || [],
      rolling_batch_papers: archiveData.rolling_batch_papers || [],
      rolling_batch_reviewer_decisions: archiveData.rolling_batch_reviewer_decisions || [],
      rolling_batch_commit_ledger: archiveData.rolling_batch_commit_ledger || [],
      umbrellanizer_results: archiveData.umbrellanizer_results || [],
      llm_jobs: archiveData.llm_jobs || [],
      prompt_templates: archiveData.prompt_templates || []
    };
  } else {
    throw new Error('Unrecognized archive format. Expected a valid .slr project archive.');
  }

  // Ensure originalProject has required metadata
  if (!originalProject) {
    originalProject = {};
  }
  if (!originalProject.name && !originalProject.project_name) {
    if (archiveData.manifest?.project_name) {
      originalProject.name = archiveData.manifest.project_name;
    } else if (rawTables.projects?.[0]?.name) {
      originalProject.name = rawTables.projects[0].name;
    } else {
      originalProject.name = 'Restored Project';
    }
  }

  const origProjId = originalProject.id || originalProject.project_id || `proj-${Date.now()}`;
  const origProjName = originalProject.name || originalProject.project_name || 'Restored Project';
  const origFolderName = originalProject.folder_name || origProjName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

  // 1. Resolve Project ID & Folder Name collisions
  let targetProjectId = origProjId;
  let targetFolderName = origFolderName;
  let projectRenamed = false;

  const existingProject = db.prepare('SELECT id FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(targetProjectId);
  if (existingProject) {
    targetProjectId = `proj-${Date.now()}`;
    projectRenamed = true;
  }

  const existingFolder = db.prepare('SELECT id FROM projects WHERE folder_name = ?').get(targetFolderName);
  if (existingFolder) {
    targetFolderName = `${origFolderName}_restored_${Date.now().toString().slice(-4)}`;
    projectRenamed = true;
  }

  // 2. Resolve Paper_ID collisions
  const existingPaperIds = new Set<string>(
    (db.prepare('SELECT Paper_ID FROM papers UNION SELECT Paper_ID FROM calibration_papers').all() as { Paper_ID: string }[]).map(r => r.Paper_ID)
  );

  const paperIdMap = new Map<string, string>();
  const incomingPapers: any[] = rawTables.papers || [];

  for (const p of incomingPapers) {
    const rawId = p.Paper_ID;
    if (!rawId) continue;

    if (existingPaperIds.has(rawId)) {
      // Generate deconflicted unique Paper_ID
      let suffix = 1;
      let newCandidateId = `${rawId}__imp${Date.now().toString().slice(-4)}_${suffix}`;
      while (existingPaperIds.has(newCandidateId) || Array.from(paperIdMap.values()).includes(newCandidateId)) {
        suffix++;
        newCandidateId = `${rawId}__imp${Date.now().toString().slice(-4)}_${suffix}`;
      }
      paperIdMap.set(rawId, newCandidateId);
    }
  }

  const remapPaperId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    return paperIdMap.get(id) || id;
  };

  // Helper to dynamically insert row with table schema alignment
  const insertAdaptiveRow = (tableName: string, rowData: any, validCols: Set<string>, omitId: boolean = false) => {
    const filteredEntries = Object.entries(rowData).filter(([k]) => {
      if (!validCols.has(k)) return false;
      if (omitId && k.toLowerCase() === 'id') return false;
      return true;
    });
    if (filteredEntries.length === 0) return;

    const colNames = filteredEntries.map(([k]) => k).join(', ');
    const placeholders = filteredEntries.map(() => '?').join(', ');
    const values = filteredEntries.map(([, v]) => {
      if (v === undefined) return null;
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return v;
    });

    const stmt = db.prepare(`INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`);
    stmt.run(...values);
  };

  const insertedCounts: Record<string, number> = {};

  // 3. Run entire import inside an atomic SQLite transaction with deferred FK enforcement
  db.pragma('foreign_keys = OFF');

  try {
    const importTransaction = db.transaction(() => {
      // A. Insert Project
      const projCols = getTableColumns('projects');
      const adaptedProject = {
        ...originalProject,
        id: targetProjectId,
        name: projectRenamed ? `${origProjName} (Restored)` : origProjName,
        folder_name: targetFolderName,
        created_at: originalProject.created_at || new Date().toISOString()
      };
      delete adaptedProject.stats; // strip transient stats if present

      const projEntries = Object.entries(adaptedProject).filter(([k]) => projCols.has(k));
      const projColNames = projEntries.map(([k]) => k).join(', ');
      const projPlaceholders = projEntries.map(() => '?').join(', ');
      const projValues = projEntries.map(([, v]) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v ?? null));
      db.prepare(`INSERT INTO projects (${projColNames}) VALUES (${projPlaceholders})`).run(...projValues);
      insertedCounts.projects = 1;

      // B. Insert Papers
      const paperCols = getTableColumns('papers');
      let papersCount = 0;
      for (const paper of incomingPapers) {
        const adaptedPaper = {
          ...paper,
          Paper_ID: remapPaperId(paper.Paper_ID),
          Project_ID: targetProjectId,
          Parent_Paper_ID: remapPaperId(paper.Parent_Paper_ID),
          merged_into_id: remapPaperId(paper.merged_into_id)
        };
        insertAdaptiveRow('papers', adaptedPaper, paperCols, false);
        papersCount++;
      }
      insertedCounts.papers = papersCount;

      // C. Insert Calibration Papers
      const calPaperCols = getTableColumns('calibration_papers');
      let calPapersCount = 0;
      for (const cp of (rawTables.calibration_papers || [])) {
        const adaptedCalPaper = {
          ...cp,
          Paper_ID: remapPaperId(cp.Paper_ID),
          Project_ID: targetProjectId,
          Parent_Paper_ID: remapPaperId(cp.Parent_Paper_ID),
          merged_into_id: remapPaperId(cp.merged_into_id)
        };
        insertAdaptiveRow('calibration_papers', adaptedCalPaper, calPaperCols, false);
        calPapersCount++;
      }
      insertedCounts.calibration_papers = calPapersCount;

      // D. Insert Reviewer Decisions (auto-increment ID omitted)
      const rdCols = getTableColumns('reviewer_decisions');
      let rdCount = 0;
      for (const rd of (rawTables.reviewer_decisions || [])) {
        const adaptedRd = {
          ...rd,
          paper_id: remapPaperId(rd.paper_id),
          project_id: targetProjectId
        };
        insertAdaptiveRow('reviewer_decisions', adaptedRd, rdCols, true);
        rdCount++;
      }
      insertedCounts.reviewer_decisions = rdCount;

      // E. Insert Calibration Commit Ledger (auto-increment ID omitted)
      const cclCols = getTableColumns('calibration_commit_ledger');
      let cclCount = 0;
      for (const ccl of (rawTables.calibration_commit_ledger || [])) {
        const adaptedCcl = {
          ...ccl,
          paper_id: remapPaperId(ccl.paper_id),
          project_id: targetProjectId
        };
        insertAdaptiveRow('calibration_commit_ledger', adaptedCcl, cclCols, true);
        cclCount++;
      }
      insertedCounts.calibration_commit_ledger = cclCount;

      // F. Insert Manual Audit Log (auto-increment ID omitted)
      const malCols = getTableColumns('manual_audit_log');
      let malCount = 0;
      for (const mal of (rawTables.manual_audit_log || [])) {
        const adaptedMal = {
          ...mal,
          paper_id: remapPaperId(mal.paper_id),
          project_id: targetProjectId
        };
        insertAdaptiveRow('manual_audit_log', adaptedMal, malCols, true);
        malCount++;
      }
      insertedCounts.manual_audit_log = malCount;

      // G. Insert LLM Audit Log (auto-increment ID omitted)
      const lalCols = getTableColumns('llm_audit_log');
      let lalCount = 0;
      for (const lal of (rawTables.llm_audit_log || [])) {
        const adaptedLal = {
          ...lal,
          paper_id: remapPaperId(lal.paper_id),
          project_id: targetProjectId
        };
        insertAdaptiveRow('llm_audit_log', adaptedLal, lalCols, true);
        lalCount++;
      }
      insertedCounts.llm_audit_log = lalCount;

      // H. Insert Duplicate Pairs (auto-increment ID omitted)
      const dpCols = getTableColumns('duplicate_pairs');
      let dpCount = 0;
      for (const dp of (rawTables.duplicate_pairs || [])) {
        const adaptedDp = {
          ...dp,
          paper1_id: remapPaperId(dp.paper1_id),
          paper2_id: remapPaperId(dp.paper2_id),
          keep_paper_id: remapPaperId(dp.keep_paper_id),
          exclude_paper_id: remapPaperId(dp.exclude_paper_id),
          project_id: targetProjectId
        };
        insertAdaptiveRow('duplicate_pairs', adaptedDp, dpCols, true);
        dpCount++;
      }
      insertedCounts.duplicate_pairs = dpCount;

      // I. Insert Rolling Batches & Rolling Batch Papers / Decisions / Ledger
      const rbCols = getTableColumns('rolling_batches');
      const rbpCols = getTableColumns('rolling_batch_papers');
      const rbrdCols = getTableColumns('rolling_batch_reviewer_decisions');
      const rbclCols = getTableColumns('rolling_batch_commit_ledger');

      for (const rb of (rawTables.rolling_batches || [])) {
        insertAdaptiveRow('rolling_batches', { ...rb, id: rb.id || `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, project_id: targetProjectId }, rbCols, false);
      }
      for (const rbp of (rawTables.rolling_batch_papers || [])) {
        insertAdaptiveRow('rolling_batch_papers', { ...rbp, Paper_ID: remapPaperId(rbp.Paper_ID), Project_ID: targetProjectId }, rbpCols, false);
      }
      for (const rbrd of (rawTables.rolling_batch_reviewer_decisions || [])) {
        insertAdaptiveRow('rolling_batch_reviewer_decisions', { ...rbrd, paper_id: remapPaperId(rbrd.paper_id), project_id: targetProjectId }, rbrdCols, true);
      }
      for (const rbcl of (rawTables.rolling_batch_commit_ledger || [])) {
        insertAdaptiveRow('rolling_batch_commit_ledger', { ...rbcl, paper_id: remapPaperId(rbcl.paper_id), project_id: targetProjectId }, rbclCols, true);
      }

      // J. Insert Umbrellanizer Results
      const umbCols = getTableColumns('umbrellanizer_results');
      for (const umb of (rawTables.umbrellanizer_results || [])) {
        insertAdaptiveRow('umbrellanizer_results', { ...umb, project_id: targetProjectId }, umbCols, false);
      }

      // K. Insert Scoped Prompt Templates & LLM Jobs
      const ptCols = getTableColumns('prompt_templates');
      for (const pt of (rawTables.prompt_templates || [])) {
        insertAdaptiveRow('prompt_templates', { ...pt, id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, project_id: targetProjectId }, ptCols, false);
      }

      const ljCols = getTableColumns('llm_jobs');
      for (const lj of (rawTables.llm_jobs || [])) {
        insertAdaptiveRow('llm_jobs', { ...lj, id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, project_id: targetProjectId }, ljCols, false);
      }
    });

    importTransaction();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  // If active project is not set, set it to the newly imported project
  const currentActive = getConfig('ACTIVE_PROJECT_ID', '');
  if (!currentActive) {
    setConfig('ACTIVE_PROJECT_ID', targetProjectId);
  }

  return {
    success: true,
    project: {
      id: targetProjectId,
      name: projectRenamed ? `${origProjName} (Restored)` : origProjName,
      folder_name: targetFolderName
    },
    recordCounts: insertedCounts,
    remappedPapersCount: paperIdMap.size,
    projectRenamed
  };
}
