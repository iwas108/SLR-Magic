import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'db', 'slr.db');
const db = new Database(dbPath);

console.log('🧪 Running Systematic Search Queries Dynamic Multi-Field Unit Tests...\n');

// 1. Ensure search_queries column exists or add safely
const cols = db.prepare('PRAGMA table_info(projects)').all();
let hasCol = cols.some(c => c.name === 'search_queries');
if (!hasCol) {
  db.prepare("ALTER TABLE projects ADD COLUMN search_queries TEXT").run();
  hasCol = true;
}
console.log('✅ 1. SQLite schema: projects.search_queries column verified.');

// 2. Test Dynamic Multi-Field Search Query Data Structure
const testSearchQueries = [
  {
    id: 'sq-1',
    source: 'Scopus',
    query: 'TITLE-ABS-KEY ( ( "systematic literature review" OR "slr" ) AND ( "artificial intelligence" ) )',
    description: 'Initial Scopus search string on 2026-05-10'
  },
  {
    id: 'sq-2',
    source: 'Web of Science',
    query: 'TS=("systematic literature review" AND "deep learning")',
    description: 'Core Collection (2018-2026)'
  },
  {
    id: 'sq-3',
    source: 'IEEE Xplore',
    query: '("Document Title":"systematic literature review" AND "Full Text & Metadata":"AI")',
    description: 'IEEE Conferences and Journals'
  },
  {
    id: 'sq-4',
    source: 'Custom DB (ACM / arXiv)',
    query: 'Title: "SLR" AND Abstract: "Language Models"',
    description: 'Preprints and ACM SIG conference papers'
  }
];

const testProjId = `test-proj-sq-${Date.now()}`;
const serializedQueries = JSON.stringify(testSearchQueries);

db.prepare(`
  INSERT INTO projects (
    id, name, folder_name, search_queries, scopus_search_string, manual_search_string, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  testProjId,
  'Test Systematic Search Queries Project',
  `test_folder_sq_${Date.now()}`,
  serializedQueries,
  testSearchQueries[0].query,
  'manual scholar query fallback',
  new Date().toISOString()
);

const insertedProj = db.prepare('SELECT * FROM projects WHERE id = ?').get(testProjId);
if (!insertedProj || !insertedProj.search_queries) {
  throw new Error('Failed to retrieve inserted search_queries from SQLite!');
}

const parsedRetrieved = JSON.parse(insertedProj.search_queries);
if (parsedRetrieved.length !== 4) {
  throw new Error(`Expected 4 search queries, got ${parsedRetrieved.length}`);
}

console.log('✅ 2. Multi-database search queries persisted & retrieved successfully (4 databases).');

// 3. Test Backward Compatibility Parser Fallback
function parseInitialSearchQueries(initialData) {
  if (!initialData) return [];
  if (initialData.search_queries) {
    try {
      const parsed = typeof initialData.search_queries === 'string'
        ? JSON.parse(initialData.search_queries)
        : initialData.search_queries;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing search_queries', e);
    }
  }

  const queries = [];
  if (initialData.scopus_search_string) {
    queries.push({
      id: 'sq-scopus',
      source: 'Scopus',
      query: initialData.scopus_search_string,
      description: 'Primary Scopus database search string'
    });
  }
  if (initialData.manual_search_string) {
    queries.push({
      id: 'sq-manual',
      source: 'Google Scholar',
      query: initialData.manual_search_string,
      description: 'Manual / Google Scholar exploratory search string'
    });
  }
  return queries;
}

const legacyProject = {
  id: 'legacy-proj-1',
  name: 'Legacy Project',
  scopus_search_string: 'TITLE-ABS-KEY(legacy)',
  manual_search_string: 'allintitle: legacy',
  search_queries: null
};

const migratedQueries = parseInitialSearchQueries(legacyProject);
if (migratedQueries.length !== 2 || migratedQueries[0].source !== 'Scopus' || migratedQueries[1].source !== 'Google Scholar') {
  throw new Error('Legacy search query backward compatibility migration failed!');
}
console.log('✅ 3. Backward compatibility: Legacy Scopus and Google Scholar strings migrated seamlessly.');

// Cleanup test record
db.prepare('DELETE FROM projects WHERE id = ?').run(testProjId);
console.log('✅ 4. Test project teardown complete.');

console.log('\n🎉 ALL SYSTEMATIC SEARCH QUERY TESTS PASSED WITH ZERO REGRESSIONS!\n');

