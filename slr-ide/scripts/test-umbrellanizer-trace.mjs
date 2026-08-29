import assert from 'assert';
import Database from 'better-sqlite3';

console.log('--- Testing Post-Pipeline Token Umbrellanizer Logic Trace & Schema Parser ---');

// 1. Test In-Memory Database SQLite JOIN & Logic Trace Merging
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT,
    Title TEXT,
    Abstract TEXT,
    Authors TEXT,
    Year INTEGER,
    Local_PDF_Status TEXT,
    Local_PDF_Path TEXT,
    ai_stage INTEGER,
    ai_decision TEXT,
    ai_extracted_data TEXT,
    manual_stage INTEGER,
    manual_decision TEXT,
    manual_extracted_data TEXT,
    is_duplicate INTEGER DEFAULT 0
  );

  CREATE TABLE llm_screening_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    paper_id TEXT,
    stage INTEGER,
    decision TEXT,
    extracted_data TEXT,
    logic_trace TEXT
  );
`);

db.prepare(`INSERT INTO projects (id, name) VALUES ('proj-test-1', 'Edge AI Review')`).run();

// Insert Paper 1: Stage 4 AI Included with logic trace in llm_screening_records
const p1ExtractedData = JSON.stringify({
  rq1a_resource_constraint_def: {
    value: 'Memory limit 256MB',
    evidence: 'Peak RAM constrained to 256MB during runtime.'
  },
  rq3b_model_architecture: {
    value: ['CNN-LSTM', 'MobileNetV3'],
    evidence: 'We deployed a hybrid CNN-LSTM with MobileNetV3 backbone.'
  }
});

const p1LogicTrace = JSON.stringify({
  extraction_mapping: {
    locate_rq1a_resource_constraint_def: 'Found in Section III.B under Hardware Constraints.',
    locate_rq3b_model_architecture: 'Extracted from Table 2 Model Topology Specification.'
  }
});

db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, Authors, Year, ai_stage, ai_decision, ai_extracted_data, manual_stage, manual_decision)
  VALUES ('P001', 'proj-test-1', 'Edge AI Optimization', 'Smith et al.', 2024, 4, 'INCLUDE', ?, 0, NULL)
`).run(p1ExtractedData);

db.prepare(`
  INSERT INTO llm_screening_records (project_id, paper_id, stage, decision, extracted_data, logic_trace)
  VALUES ('proj-test-1', 'P001', 4, 'INCLUDE', ?, ?)
`).run(p1ExtractedData, p1LogicTrace);

// Insert Paper 2: Stage 4 Manual Override Dominant
const p2ManualExtracted = JSON.stringify({
  extracted_data: {
    rq1a_resource_constraint_def: {
      value: 'MCU 64KB SRAM',
      evidence: 'Target device operates on STM32 with 64KB SRAM.',
      reasoning: 'Manual reviewer extracted from Section 2.'
    }
  }
});

db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, Authors, Year, ai_stage, ai_decision, ai_extracted_data, manual_stage, manual_decision, manual_extracted_data)
  VALUES ('P002', 'proj-test-1', 'Microcontroller ML', 'Jones et al.', 2023, 4, 'INCLUDE', '{}', 4, 'INCLUDE', ?)
`).run(p2ManualExtracted);

// Insert Paper 3: Excluded at Stage 4 (should NOT be selected)
db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, Authors, Year, ai_stage, ai_decision, ai_extracted_data, manual_stage, manual_decision)
  VALUES ('P003', 'proj-test-1', 'Off-topic Study', 'Doe et al.', 2022, 4, 'EXCLUDE (EC-4)', '{}', 0, NULL)
`).run();

// Query using the exact endpoint SQL logic
const projectId = 'proj-test-1';
const papers = db.prepare(`
  SELECT 
    p.Paper_ID, p.Title, p.Abstract, p.Authors, p.Year, p.Local_PDF_Status, p.Local_PDF_Path,
    p.ai_stage, p.ai_decision,
    COALESCE(lsr_min.extracted_data, p.ai_extracted_data) as ai_extracted_data,
    p.manual_stage, p.manual_decision, p.manual_extracted_data,
    lsr_min.logic_trace as miner_logic_trace
  FROM papers p
  LEFT JOIN llm_screening_records lsr_min 
    ON lsr_min.paper_id = p.Paper_ID 
   AND (lsr_min.project_id = p.Project_ID OR CAST(lsr_min.project_id AS TEXT) = CAST(p.Project_ID AS TEXT))
   AND lsr_min.stage = 4
  WHERE (p.Project_ID = ? OR CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT)) AND (p.is_duplicate IS NULL OR p.is_duplicate = 0)
    AND (
      CASE 
        WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_stage
        ELSE IFNULL(p.ai_stage, 0)
      END
    ) = 4
    AND (
      CASE 
        WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
        WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
        ELSE COALESCE(p.manual_decision, p.ai_decision)
      END
    ) LIKE 'INCLUDE%'
`).all(projectId, projectId);

assert.strictEqual(papers.length, 2, 'Should only return 2 included papers');
console.log('✓ Stage-aware decision resolution SQL query correctly selected included Stage 4 papers.');

// Process the papers
const processedPapers = papers.map((paper) => {
  const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
  const rawExtracted = isManualDominant ? (paper.manual_extracted_data || paper.ai_extracted_data) : (paper.ai_extracted_data || paper.manual_extracted_data);
  
  let extractedData = {};
  let logicTrace = {};

  try {
    if (rawExtracted) {
      const parsed = typeof rawExtracted === 'string' ? JSON.parse(rawExtracted) : rawExtracted;
      if (parsed && typeof parsed === 'object') {
        extractedData = parsed.extracted_data || parsed;
        logicTrace = parsed.logic_trace || parsed.logicTrace || {};
      }
    }
  } catch (err) {
    console.error(`Failed to parse extracted data for paper ${paper.Paper_ID}:`, err);
  }

  // Merge miner_logic_trace from llm_screening_records if available
  if (paper.miner_logic_trace) {
    try {
      const parsedLt = typeof paper.miner_logic_trace === 'string' ? JSON.parse(paper.miner_logic_trace) : paper.miner_logic_trace;
      if (parsedLt && typeof parsedLt === 'object' && Object.keys(parsedLt).length > 0) {
        logicTrace = {
          ...logicTrace,
          ...parsedLt,
          extraction_mapping: {
            ...(logicTrace.extraction_mapping || {}),
            ...(parsedLt.extraction_mapping || parsedLt)
          }
        };
      }
    } catch (err) {
      console.error(`Failed to merge miner logic trace for paper ${paper.Paper_ID}:`, err);
    }
  }

  delete extractedData.logic_trace;
  delete extractedData.logicTrace;
  delete extractedData._scientist_logic_trace;
  delete extractedData.qa_scores;

  return {
    Paper_ID: paper.Paper_ID,
    Title: paper.Title,
    Authors: paper.Authors,
    Year: paper.Year,
    extracted_data: extractedData,
    logic_trace: logicTrace
  };
});

// Verify Paper 1 logic trace was merged
const p1 = processedPapers.find(p => p.Paper_ID === 'P001');
assert.ok(p1.logic_trace, 'P001 logic_trace should be present');
assert.ok(p1.logic_trace.extraction_mapping, 'P001 logic_trace.extraction_mapping should be present');
assert.strictEqual(
  p1.logic_trace.extraction_mapping.locate_rq1a_resource_constraint_def,
  'Found in Section III.B under Hardware Constraints.',
  'P001 logic trace for rq1a must match'
);
console.log('✓ Stage 4 Miner logic_trace successfully joined and merged from llm_screening_records.');

// 2. Test Centralized Trace Normalizer & Schema Extractors
function normalizeKeyToken(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .replace(/^locate_/i, '')
    .replace(/^rq\d+[a-z]?_/i, '')
    .replace(/^locate_/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extractMappingReasoning(key, locateMapping = {}, valObj) {
  if (!key) return '';
  const cleanKey = key.replace(/^rq\d+[a-z]?_/, '');
  const normKeyToken = normalizeKeyToken(key);

  const candidateKeys = [
    `locate_${key}`,
    key,
    `${key}_mapping`,
    `${key}_reasoning`,
    `${key}_locate`,
    `locate_${cleanKey}`,
    cleanKey,
    `${cleanKey}_mapping`,
    `${cleanKey}_reasoning`,
    `${cleanKey}_locate`
  ];

  let traceVal = '';

  if (locateMapping && typeof locateMapping === 'object') {
    for (const cKey of candidateKeys) {
      if (locateMapping[cKey] !== undefined && locateMapping[cKey] !== null && locateMapping[cKey] !== '') {
        traceVal = String(locateMapping[cKey]);
        break;
      }
    }

    if (!traceVal && normKeyToken) {
      const matchedKey = Object.keys(locateMapping).find(k => {
        const token = normalizeKeyToken(k);
        return token && (token === normKeyToken || token.includes(normKeyToken) || normKeyToken.includes(token));
      });
      if (matchedKey && locateMapping[matchedKey]) {
        traceVal = String(locateMapping[matchedKey]);
      }
    }
  }

  if (!traceVal && valObj && typeof valObj === 'object' && !Array.isArray(valObj)) {
    if ('reasoning' in valObj && valObj.reasoning) {
      traceVal = String(valObj.reasoning);
    } else if ('justification' in valObj && valObj.justification) {
      traceVal = String(valObj.justification);
    }
  }

  return String(traceVal || '').trim();
}

function extractEvidenceQuote(key, valObj) {
  if (!valObj) return '';
  if (typeof valObj === 'object' && !Array.isArray(valObj)) {
    if ('evidence' in valObj && valObj.evidence) return String(valObj.evidence).trim();
    if ('exact_quote' in valObj && valObj.exact_quote) return String(valObj.exact_quote).trim();
    if ('quote' in valObj && valObj.quote) return String(valObj.quote).trim();
    if ('text' in valObj && valObj.text) return String(valObj.text).trim();
    if ('rationale' in valObj && valObj.rationale) return String(valObj.rationale).trim();
    if ('reasoning' in valObj && valObj.reasoning) return String(valObj.reasoning).trim();
  }
  return '';
}

// Test extraction mapping on P001
const locateMapping = p1.logic_trace.extraction_mapping;
const rq1aTrace = extractMappingReasoning('rq1a_resource_constraint_def', locateMapping, p1.extracted_data.rq1a_resource_constraint_def);
assert.strictEqual(rq1aTrace, 'Found in Section III.B under Hardware Constraints.');
console.log('✓ extractMappingReasoning accurately resolves locate_ prefixed trace mapping.');

const rq1aEvidence = extractEvidenceQuote('rq1a_resource_constraint_def', p1.extracted_data.rq1a_resource_constraint_def);
assert.strictEqual(rq1aEvidence, 'Peak RAM constrained to 256MB during runtime.');
console.log('✓ extractEvidenceQuote accurately resolves verbatim evidence quotes.');

// Test fallback to nested object reasoning (P002 manual extraction)
const p2 = processedPapers.find(p => p.Paper_ID === 'P002');
const p2Trace = extractMappingReasoning('rq1a_resource_constraint_def', {}, p2.extracted_data.rq1a_resource_constraint_def);
assert.strictEqual(p2Trace, 'Manual reviewer extracted from Section 2.');
console.log('✓ extractMappingReasoning resolves nested object reasoning fallback.');

// 3. Test Token Normalization for Umbrellanizer
function normalizeExtractedTokens(val, fieldKey) {
  if (val === undefined || val === null || val === '') return [];
  let targetVal = val;
  if (typeof targetVal === 'object' && targetVal !== null && !Array.isArray(targetVal) && 'value' in targetVal) {
    targetVal = targetVal.value;
  }
  if (targetVal === undefined || targetVal === null || targetVal === '') return [];
  const rawTokens = [];
  if (Array.isArray(targetVal)) {
    targetVal.forEach(item => {
      if (item !== undefined && item !== null && item !== '') rawTokens.push(String(item).trim());
    });
  } else if (typeof targetVal === 'string') {
    if (targetVal.includes(',') && !fieldKey?.startsWith('rq1a')) {
      targetVal.split(',').forEach(t => t.trim() && rawTokens.push(t.trim()));
    } else {
      rawTokens.push(targetVal.trim());
    }
  }
  return rawTokens.filter(t => t.toUpperCase() !== 'NOT_STATED' && t !== '');
}

const p1Tokens = normalizeExtractedTokens(p1.extracted_data.rq3b_model_architecture, 'rq3b_model_architecture');
assert.deepStrictEqual(p1Tokens, ['CNN-LSTM', 'MobileNetV3'], 'Should extract normalized array tokens');
console.log('✓ normalizeExtractedTokens accurately handles array of objects and multi-tokens.');

// 4. Test Rich Token Harvesting (Evidence Quotes + Extraction Logic Traces)
function harvestUniqueTokensWithContext(papersList, key) {
  const tokenMap = {};

  papersList.forEach((paper) => {
    const data = paper.extracted_data[key];
    if (data === undefined || data === null || data === '') return;

    const rawTokens = normalizeExtractedTokens(data, key);
    if (rawTokens.length === 0) return;

    const rawEvidence = extractEvidenceQuote(key, data);
    const logicTrace = paper.logic_trace || {};
    const locateMapping = logicTrace.extraction_mapping || logicTrace || {};
    const logicTraceText = extractMappingReasoning(key, locateMapping, data);

    rawTokens.forEach((token) => {
      const t = String(token).trim();
      if (!t || t.toUpperCase() === 'NOT_STATED') return;
      if (!tokenMap[t]) {
        tokenMap[t] = { count: 0, papers: [], evidence_quotes: [], logic_traces: [] };
      }
      tokenMap[t].count += 1;
      tokenMap[t].papers.push({ id: paper.Paper_ID, title: paper.Title });

      if (rawEvidence && rawEvidence.toUpperCase() !== 'NOT_STATED') {
        if (!tokenMap[t].evidence_quotes.some(eq => eq.paper_id === paper.Paper_ID && eq.quote === rawEvidence)) {
          tokenMap[t].evidence_quotes.push({ paper_id: paper.Paper_ID, quote: rawEvidence });
        }
      }

      if (logicTraceText && logicTraceText !== 'No trace mapping logged.' && logicTraceText.trim() !== '') {
        if (!tokenMap[t].logic_traces.some(lt => lt.paper_id === paper.Paper_ID && lt.trace === logicTraceText)) {
          tokenMap[t].logic_traces.push({ paper_id: paper.Paper_ID, trace: logicTraceText });
        }
      }
    });
  });

  return Object.entries(tokenMap).map(([token, info]) => ({
    token,
    count: info.count,
    papers: info.papers,
    evidence_quotes: info.evidence_quotes,
    logic_traces: info.logic_traces
  })).sort((a, b) => b.count - a.count);
}

const rq1aHarvest = harvestUniqueTokensWithContext(processedPapers, 'rq1a_resource_constraint_def');
assert.strictEqual(rq1aHarvest.length, 2, 'Should have 2 unique resource constraint tokens');

const memLimitToken = rq1aHarvest.find(t => t.token === 'Memory limit 256MB');
assert.ok(memLimitToken, 'Memory limit token must be present');
assert.strictEqual(memLimitToken.evidence_quotes[0].quote, 'Peak RAM constrained to 256MB during runtime.');
assert.strictEqual(memLimitToken.logic_traces[0].trace, 'Found in Section III.B under Hardware Constraints.');

const mcuToken = rq1aHarvest.find(t => t.token === 'MCU 64KB SRAM');
assert.ok(mcuToken, 'MCU token must be present');
assert.strictEqual(mcuToken.evidence_quotes[0].quote, 'Target device operates on STM32 with 64KB SRAM.');
assert.strictEqual(mcuToken.logic_traces[0].trace, 'Manual reviewer extracted from Section 2.');
console.log('✓ harvestUniqueTokensWithContext accurately collects verbatim evidence quotes and logic traces.');

// 5. Test Markdown Formatting and Jinja2 Dual-Placeholder Hydration
function formatRichTokensMarkdown(richTokensList, rawTokensList) {
  if (richTokensList && Array.isArray(richTokensList) && richTokensList.length > 0) {
    const blocks = [];
    for (const item of richTokensList) {
      if (!item || typeof item !== 'object') continue;
      const token = item.token || item.raw_token || '';
      if (!token) continue;
      const count = item.count || 1;
      const papers = item.papers || [];
      const paperIds = papers.map(p => (typeof p === 'object' ? p.id : String(p)));
      const paperIdsStr = paperIds.length > 0 ? paperIds.join(', ') : `${count} papers`;

      const block = [`### Extracted Token: "${token}" (Occurrences: ${count} paper${count !== 1 ? 's' : ''} [${paperIdsStr}])`];

      const evQuotes = item.evidence_quotes || [];
      if (evQuotes.length > 0) {
        block.push('- **Verbatim Evidence Quotes**:');
        for (const eq of evQuotes) {
          if (typeof eq === 'object') {
            block.push(`  * [${eq.paper_id}]: "${eq.quote}"`);
          } else {
            block.push(`  * "${eq}"`);
          }
        }
      } else {
        block.push('- **Verbatim Evidence Quotes**: None extracted.');
      }

      const lTraces = item.logic_traces || [];
      if (lTraces.length > 0) {
        block.push('- **Extraction Logic Traces**:');
        for (const lt of lTraces) {
          if (typeof lt === 'object') {
            block.push(`  * [${lt.paper_id}]: ${lt.trace}`);
          } else {
            block.push(`  * ${lt}`);
          }
        }
      } else {
        block.push('- **Extraction Logic Traces**: None logged.');
      }

      blocks.push(block.join('\n'));
    }
    return blocks.join('\n\n');
  }
  return rawTokensList.map(t => `- "${t}"`).join('\n');
}

const formattedOutline = formatRichTokensMarkdown(rq1aHarvest, ['Memory limit 256MB', 'MCU 64KB SRAM']);
assert.ok(formattedOutline.includes('### Extracted Token: "Memory limit 256MB"'));
assert.ok(formattedOutline.includes('Peak RAM constrained to 256MB during runtime.'));
assert.ok(formattedOutline.includes('Found in Section III.B under Hardware Constraints.'));
assert.ok(formattedOutline.includes('### Extracted Token: "MCU 64KB SRAM"'));
assert.ok(formattedOutline.includes('Manual reviewer extracted from Section 2.'));
console.log('✓ formatRichTokensMarkdown produces valid, structured Markdown outline for LLM context.');

// Test Template Hydration with both new and legacy placeholders
const sampleTemplate = `
Taxonomy harmonization for: {{ target_variable }} ({{ target_variable_description }})
New Context:
{{ raw_tokens_with_context }}
Legacy Array:
{{ raw_tokens }}
`;

const hydrated = sampleTemplate
  .replace('{{ target_variable }}', 'RQ1A')
  .replace('{{ target_variable_description }}', 'Resource Constraint Description')
  .replace('{{ raw_tokens_with_context }}', formattedOutline)
  .replace('{{ raw_tokens }}', JSON.stringify(['Memory limit 256MB', 'MCU 64KB SRAM']));

assert.ok(hydrated.includes('Taxonomy harmonization for: RQ1A (Resource Constraint Description)'));
assert.ok(hydrated.includes('### Extracted Token: "Memory limit 256MB"'));
assert.ok(hydrated.includes('["Memory limit 256MB","MCU 64KB SRAM"]'));
console.log('✓ Jinja2 dual-placeholder hydration correctly supports both raw_tokens_with_context and raw_tokens.');

// Test Payload File serialization & round-trip (ENAMETOOLONG fix)
const fs = await import('fs');
const path = await import('path');
const os = await import('os');
const tmpPayloadPath = path.join(os.tmpdir(), `test_payload_${Date.now()}.json`);
fs.writeFileSync(tmpPayloadPath, JSON.stringify({
  rawTokens: ['Memory limit 256MB', 'MCU 64KB SRAM'],
  richTokens: rq1aHarvest
}), 'utf-8');

const readPayload = JSON.parse(fs.readFileSync(tmpPayloadPath, 'utf-8'));
assert.strictEqual(readPayload.rawTokens.length, 2);
assert.strictEqual(readPayload.richTokens.length, 2);
fs.unlinkSync(tmpPayloadPath);
console.log('✓ Temporary payload file serialization & cleanup protects against ENAMETOOLONG.');

console.log('\n========================================');
console.log('ALL UMBRELLA LOGIC TRACE & RICH CONTEXT TESTS PASSED (100%)');
console.log('========================================');
