const Database = require('better-sqlite3');
const path = require('path');

function statusToLevel(statusStr) {
  if (statusStr === '1') return 1;
  if (statusStr === '2') return 2;
  if (statusStr === '3') return 3;
  if (statusStr === '4') return 4;
  return 0;
}

function manualStageToLevel(stageStr) {
  if (stageStr === 'fast_filter') return 1;
  if (stageStr === 'gatekeeper') return 2;
  if (stageStr === 'scientist') return 3;
  if (stageStr === 'miner') return 4;
  return 0;
}

function levelToStatus(level) {
  if (level === 1) return '1';
  if (level === 2) return '2';
  if (level === 3) return '3';
  if (level === 4) return '4';
  return 'PENDING';
}

function run() {
  const dbPath = path.join(__dirname, '../db/slr.db');
  console.log(`Connecting to database at: ${dbPath}`);
  const db = new Database(dbPath);

  // Enable WAL and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Find all papers with a manual stage set
  const papers = db.prepare(`
    SELECT Paper_ID, Status, manual_stage 
    FROM papers 
    WHERE manual_stage IS NOT NULL AND manual_stage != ''
  `).all();

  console.log(`Found ${papers.length} papers with manual stage assigned.`);

  let updatedCount = 0;

  const updateStmt = db.prepare('UPDATE papers SET Status = ? WHERE Paper_ID = ?');

  // Run in a transaction for safety and speed
  const tx = db.transaction(() => {
    for (const paper of papers) {
      const currentLevel = statusToLevel(paper.Status);
      const targetLevel = manualStageToLevel(paper.manual_stage);

      if (targetLevel > currentLevel) {
        const nextStatus = levelToStatus(targetLevel);
        updateStmt.run(nextStatus, paper.Paper_ID);
        console.log(`Updated paper ${paper.Paper_ID}: Status updated from "${paper.Status}" to "${nextStatus}" (manual_stage: "${paper.manual_stage}").`);
        updatedCount++;
      }
    }
  });

  tx();

  console.log(`Migration patch complete. Updated ${updatedCount} papers.`);
  db.close();
}

run();
