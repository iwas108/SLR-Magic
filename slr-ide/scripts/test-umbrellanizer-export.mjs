import assert from 'assert';
import Database from 'better-sqlite3';

console.log('--- Testing Post-Pipeline Token Umbrellanizer Mapping & Justification Export ---');

// 1. Setup In-Memory SQLite Database
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    questions TEXT
  );

  CREATE TABLE papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT,
    Title TEXT,
    ai_stage INTEGER,
    ai_decision TEXT,
    ai_extracted_data TEXT,
    manual_stage INTEGER,
    manual_decision TEXT,
    manual_extracted_data TEXT
  );

  CREATE TABLE umbrellanizer_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    extracted_data_key TEXT NOT NULL,
    prompt_id TEXT,
    model_id TEXT,
    raw_tokens_input TEXT,
    umbrella_mapping TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    thinking_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    status TEXT DEFAULT 'PENDING',
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, extracted_data_key),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// 2. Seed Projects
db.prepare(`
  INSERT INTO projects (id, name, questions) 
  VALUES ('proj-1', 'IoT Edge Review', 'RQ1: What AI models are deployed?\nRQ5: What communication protocols are adopted?')
`).run();

db.prepare(`
  INSERT INTO projects (id, name, questions) 
  VALUES ('proj-2', 'Autonomous Vehicles Review', 'RQ1: What machine learning algorithms are utilized?')
`).run();

// 3. Seed Umbrellanizer Results
// Project 1: rq1_model
const proj1Rq1Mapping = JSON.stringify({
  "CNN": {
    "umbrella_category": "Deep Learning",
    "justification": "Spatial convolutional neural network architecture."
  },
  "LSTM": {
    "umbrella_category": "Deep Learning",
    "justification": "Recurrent architecture designed for sequential temporal dynamics."
  }
});
db.prepare(`
  INSERT INTO umbrellanizer_results (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
  VALUES ('proj-1', 'rq1_model', 'default-umbrellanizer', 'gemini-2.5-flash', '["CNN", "LSTM"]', ?, 'SUCCESS', datetime('now'), datetime('now'))
`).run(proj1Rq1Mapping);

// Project 1: rq5_protocols
const proj1Rq5Mapping = JSON.stringify({
  "MQTT": {
    "umbrella_category": "Lightweight Protocol",
    "justification": "OASIS pub/sub telemetry transport designed for constrained IoT."
  },
  "HTTP/REST": {
    "umbrella_category": "Standard Web Protocol",
    "justification": "Synchronous request-response stateless web protocol."
  }
});
db.prepare(`
  INSERT INTO umbrellanizer_results (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
  VALUES ('proj-1', 'rq5_protocols', 'default-umbrellanizer', 'gemini-2.5-flash', '["MQTT", "HTTP/REST"]', ?, 'SUCCESS', datetime('now'), datetime('now'))
`).run(proj1Rq5Mapping);

// Project 2: rq1_model (isolated)
const proj2Rq1Mapping = JSON.stringify({
  "RandomForest": {
    "umbrella_category": "Ensemble Learning",
    "justification": "Bagged ensemble of decision trees."
  }
});
db.prepare(`
  INSERT INTO umbrellanizer_results (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
  VALUES ('proj-2', 'rq1_model', 'default-umbrellanizer', 'gemini-2.5-flash', '["RandomForest"]', ?, 'SUCCESS', datetime('now'), datetime('now'))
`).run(proj2Rq1Mapping);

// 4. Seed Miner-Passed Papers in Project 1
// Paper P001: Stage 4 Manual Included
db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, manual_stage, manual_decision, manual_extracted_data, ai_stage, ai_decision)
  VALUES ('P001', 'proj-1', 'Edge Vision with CNNs', 4, 'INCLUDE', ?, 0, NULL)
`).run(JSON.stringify({
  rq1_model: 'CNN',
  rq5_protocols: ['MQTT', 'HTTP/REST']
}));

// Paper P002: Stage 4 AI Included
db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, manual_stage, manual_decision, ai_stage, ai_decision, ai_extracted_data)
  VALUES ('P002', 'proj-1', 'Sequential Edge AI', 0, NULL, 4, 'INCLUDE', ?)
`).run(JSON.stringify({
  rq1_model: ['CNN', 'LSTM']
}));

// Paper P003: Excluded paper (should NOT count towards occurrences)
db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, manual_stage, manual_decision, manual_extracted_data)
  VALUES ('P003', 'proj-1', 'Excluded Paper', 4, 'EXCLUDE', ?)
`).run(JSON.stringify({
  rq1_model: 'CNN'
}));

// Paper P201: In Project 2
db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, manual_stage, manual_decision, manual_extracted_data)
  VALUES ('P201', 'proj-2', 'Autonomous Car ML', 4, 'INCLUDE', ?)
`).run(JSON.stringify({
  rq1_model: 'RandomForest'
}));

// 5. Test Functions mirroring export endpoint logic
function escapeCsvCell(cell) {
  if (cell === null || cell === undefined) return '';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getResearchQuestionLabel(questionsStr, key) {
  if (!questionsStr) return key.replace('rq', 'RQ').replace(/_/g, ' ');
  const lines = questionsStr.split('\n').map(l => l.trim()).filter(Boolean);
  const match = key.match(/^rq(\d+)(?:_?([a-z])(?![a-z]))?/i);
  if (!match) return key.replace('rq', 'RQ').replace(/_/g, ' ');

  const num = match[1] + (match[2] || '');
  const targetPrefix = `rq${num}`.toLowerCase();
  const targetPrefix2 = `rq ${num}`.toLowerCase();


  const found = lines.find(line => {
    const cleanLine = line.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    return cleanLine.startsWith(targetPrefix) || cleanLine.startsWith(targetPrefix2);
  });

  return found || key.replace('rq', 'RQ').replace(/_/g, ' ');
}

function generateExportData(targetProjectId, targetKey = null) {
  // Query project
  const project = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(targetProjectId, targetProjectId);
  assert.ok(project, `Project ${targetProjectId} must exist`);

  // Query Umbrellanizer results
  let query = `
    SELECT * FROM umbrellanizer_results 
    WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
      AND status = 'SUCCESS'
  `;
  const params = [targetProjectId, targetProjectId];
  if (targetKey) {
    query += ' AND extracted_data_key = ?';
    params.push(targetKey);
  }
  query += ' ORDER BY extracted_data_key ASC';
  const umbRows = db.prepare(query).all(...params);

  // Query Miner papers
  const minerPapers = db.prepare(`
    SELECT p.Paper_ID, p.Title, p.manual_extracted_data, p.ai_extracted_data, p.manual_stage, p.ai_stage, p.manual_decision, p.ai_decision
    FROM papers p
    WHERE (p.Project_ID = ? OR CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT))
      AND (MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) >= 4 OR p.ai_extracted_data IS NOT NULL OR p.manual_extracted_data IS NOT NULL)
      AND CASE 
          WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
          WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
          ELSE COALESCE(p.manual_decision, p.ai_decision)
      END LIKE 'INCLUDE%'
  `).all(targetProjectId, targetProjectId);

  // Build occurrences
  const occurrencesByKey = {};
  minerPapers.forEach((paper) => {
    let extData = null;
    const isNonEmpty = (s) => typeof s === 'string' && s.trim() !== '' && s.trim() !== '{}' && s.trim() !== '[]' && s.trim() !== 'null';
    const ms = Number(paper.manual_stage || 0);
    const as = Number(paper.ai_stage || 0);
    const rawExt = (ms >= as && isNonEmpty(paper.manual_extracted_data))
      ? paper.manual_extracted_data
      : (isNonEmpty(paper.ai_extracted_data) ? paper.ai_extracted_data : paper.manual_extracted_data);

    if (rawExt) {
      try {
        const parsed = JSON.parse(rawExt);
        extData = parsed.extracted_data || parsed;
      } catch (_) {}
    }

    if (extData && typeof extData === 'object') {
      Object.entries(extData).forEach(([fieldKey, val]) => {
        if (!fieldKey || fieldKey.startsWith('_')) return;
        const tokens = Array.isArray(val) ? val : [val];
        if (!occurrencesByKey[fieldKey]) {
          occurrencesByKey[fieldKey] = {};
        }
        tokens.forEach((t) => {
          const norm = String(t).trim().toLowerCase();
          if (!norm || norm === 'not_stated') return;
          if (!occurrencesByKey[fieldKey][norm]) {
            occurrencesByKey[fieldKey][norm] = { count: 0, paperIds: new Set() };
          }
          occurrencesByKey[fieldKey][norm].count += 1;
          occurrencesByKey[fieldKey][norm].paperIds.add(paper.Paper_ID);
        });
      });
    }
  });

  const exportItems = [];
  umbRows.forEach((row) => {
    const fieldKey = row.extracted_data_key;
    const rqLabel = getResearchQuestionLabel(project.questions, fieldKey);
    const parsed = JSON.parse(row.umbrella_mapping || '{}');
    Object.entries(parsed).forEach(([rawTok, info]) => {
      const norm = rawTok.trim().toLowerCase();
      const occInfo = occurrencesByKey[fieldKey]?.[norm] || { count: 0, paperIds: new Set() };
      exportItems.push({
        variable_key: fieldKey,
        research_question: rqLabel,
        raw_value: rawTok,
        umbrellanizer_value: info.umbrella_category || rawTok,
        justification: info.justification || '',
        occurrences: occInfo.count,
        paper_ids: Array.from(occInfo.paperIds)
      });
    });
  });

  return { project, exportItems };
}

// ==========================================
// TEST 1: CSV Export Generation & Formatting
// ==========================================
console.log('Test 1: Verifying CSV export generation & headers...');
const { exportItems: proj1AllItems } = generateExportData('proj-1');
assert.strictEqual(proj1AllItems.length, 4, 'Project 1 should have 4 mappings in total (2 for rq1_model, 2 for rq5_protocols)');

const csvHeaders = ['Variable Key', 'Research Question', 'Raw Value', 'Umbrellanizer Value', 'Justification', 'Occurrences', 'Paper IDs'];
const csvRows = [
  csvHeaders.map(escapeCsvCell).join(','),
  ...proj1AllItems.map(item => [
    escapeCsvCell(item.variable_key),
    escapeCsvCell(item.research_question),
    escapeCsvCell(item.raw_value),
    escapeCsvCell(item.umbrellanizer_value),
    escapeCsvCell(item.justification),
    escapeCsvCell(item.occurrences),
    escapeCsvCell(item.paper_ids.join(', '))
  ].join(','))
];
const csvContent = '\uFEFF' + csvRows.join('\r\n');

assert.ok(csvContent.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
assert.ok(csvContent.includes('Variable Key,Research Question,Raw Value,Umbrellanizer Value,Justification,Occurrences,Paper IDs'), 'CSV must contain standard headers');
console.log('✓ CSV generated with valid headers and UTF-8 BOM.');


// ==========================================
// TEST 2: Raw Values, Umbrella Values & Justifications Verification
// ==========================================
console.log('Test 2: Verifying raw terms, umbrella terms, and justifications...');
const cnnItem = proj1AllItems.find(i => i.raw_value === 'CNN');
assert.ok(cnnItem, 'CNN mapping must exist');
assert.strictEqual(cnnItem.umbrellanizer_value, 'Deep Learning', 'CNN must map to Deep Learning');
assert.strictEqual(cnnItem.justification, 'Spatial convolutional neural network architecture.', 'CNN must retain full justification');
assert.strictEqual(cnnItem.research_question, 'RQ1: What AI models are deployed?', 'Research question label must resolve from project questions');

const mqttItem = proj1AllItems.find(i => i.raw_value === 'MQTT');
assert.ok(mqttItem, 'MQTT mapping must exist');
assert.strictEqual(mqttItem.umbrellanizer_value, 'Lightweight Protocol', 'MQTT must map to Lightweight Protocol');
assert.strictEqual(mqttItem.justification, 'OASIS pub/sub telemetry transport designed for constrained IoT.', 'MQTT must retain justification');
assert.strictEqual(mqttItem.research_question, 'RQ5: What communication protocols are adopted?', 'RQ5 label must resolve');
console.log('✓ Raw terms, umbrella categories, and justifications mapped accurately.');

// ==========================================
// TEST 3: Occurrence Counts & Paper IDs Resolution
// ==========================================
console.log('Test 3: Verifying Miner occurrence counts & paper citations...');
// P001 has CNN, P002 has CNN -> count must be 2. P003 is EXCLUDED so not counted.
assert.strictEqual(cnnItem.occurrences, 2, 'CNN must have 2 occurrences among Miner-included papers');
assert.deepStrictEqual(cnnItem.paper_ids.sort(), ['P001', 'P002'], 'CNN paper IDs must be P001 and P002');

// LSTM appears only in P002
const lstmItem = proj1AllItems.find(i => i.raw_value === 'LSTM');
assert.strictEqual(lstmItem.occurrences, 1, 'LSTM must have 1 occurrence');
assert.deepStrictEqual(lstmItem.paper_ids, ['P002'], 'LSTM paper ID must be P002');

// MQTT appears only in P001
assert.strictEqual(mqttItem.occurrences, 1, 'MQTT must have 1 occurrence');
assert.deepStrictEqual(mqttItem.paper_ids, ['P001'], 'MQTT paper ID must be P001');
console.log('✓ Occurrence counts and paper citations computed accurately.');

// ==========================================
// TEST 4: Single Variable Scoping / Filtering
// ==========================================
console.log('Test 4: Verifying single variable scoping...');
const { exportItems: proj1Rq5Only } = generateExportData('proj-1', 'rq5_protocols');
assert.strictEqual(proj1Rq5Only.length, 2, 'Single-key export for rq5_protocols must return exactly 2 items');
assert.ok(proj1Rq5Only.every(i => i.variable_key === 'rq5_protocols'), 'All items must belong to rq5_protocols');
assert.ok(!proj1Rq5Only.some(i => i.raw_value === 'CNN'), 'CNN must not be in rq5_protocols export');
console.log('✓ Single variable scoping correctly filters target key.');

// ==========================================
// TEST 5: JSON Export Structure & Metadata
// ==========================================
console.log('Test 5: Verifying structured JSON export payload...');
const groupedVariables = {};
proj1AllItems.forEach(item => {
  if (!groupedVariables[item.variable_key]) {
    groupedVariables[item.variable_key] = {
      key: item.variable_key,
      research_question: item.research_question,
      mappings: []
    };
  }
  groupedVariables[item.variable_key].mappings.push({
    raw_value: item.raw_value,
    umbrellanizer_value: item.umbrellanizer_value,
    justification: item.justification,
    occurrences: item.occurrences,
    paper_ids: item.paper_ids
  });
});

const jsonPayload = {
  export_type: 'umbrellanizer_taxonomy_mapping',
  export_timestamp: new Date().toISOString(),
  project_id: 'proj-1',
  project_name: 'IoT Edge Review',
  total_mapped_keys: Object.keys(groupedVariables).length,
  total_mappings: proj1AllItems.length,
  variables: groupedVariables,
  all_mappings: proj1AllItems
};

assert.strictEqual(jsonPayload.export_type, 'umbrellanizer_taxonomy_mapping');
assert.strictEqual(jsonPayload.total_mapped_keys, 2);
assert.strictEqual(jsonPayload.total_mappings, 4);
assert.ok(jsonPayload.variables.rq1_model.mappings.length === 2);
assert.ok(jsonPayload.variables.rq5_protocols.mappings.length === 2);
console.log('✓ Structured JSON payload matches specification.');

// ==========================================
// TEST 6: Strict Multi-Project Isolation
// ==========================================
console.log('Test 6: Verifying multi-project database isolation...');
const { exportItems: proj2Items } = generateExportData('proj-2');
assert.strictEqual(proj2Items.length, 1, 'Project 2 must have exactly 1 mapping');
assert.strictEqual(proj2Items[0].raw_value, 'RandomForest', 'Project 2 mapping must be RandomForest');
assert.strictEqual(proj2Items[0].umbrellanizer_value, 'Ensemble Learning');
assert.strictEqual(proj2Items[0].occurrences, 1);
assert.deepStrictEqual(proj2Items[0].paper_ids, ['P201']);

// Verify Project 1 has no cross-project leak from Project 2
assert.ok(!proj1AllItems.some(i => i.raw_value === 'RandomForest'), 'Project 1 must never contain Project 2 mappings');
// Verify Project 2 has no cross-project leak from Project 1
assert.ok(!proj2Items.some(i => i.raw_value === 'CNN' || i.raw_value === 'MQTT'), 'Project 2 must never contain Project 1 mappings');
console.log('✓ Multi-project isolation strictly enforced between Project 1 and Project 2.');

console.log('\n========================================');
console.log('ALL UMBRELLA EXPORT TESTS PASSED (100%)');
console.log('========================================');
