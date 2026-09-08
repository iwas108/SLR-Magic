import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const slrIdeDir = path.resolve(__dirname, '..');

console.log('=== END-TO-END TEST: Reference Syncer Resolution & Scanning ===');

// We can test reading references.bib and applying our resolution algorithm directly
const bibPath = path.resolve(slrIdeDir, 'db', 'references.bib');
const bibContent = fs.readFileSync(bibPath, 'utf-8');

const entries = new Map();
const byDoi = new Map();
const byNormalizedTitle = new Map();
const byAuthorYear = new Map();

function normalizeText(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const rawEntries = bibContent.split(/\n@/);
for (const raw of rawEntries) {
  if (!raw.trim()) continue;
  const matchKey = raw.match(/^[a-zA-Z]+\s*\{\s*([^,]+),/);
  if (!matchKey) continue;
  const key = matchKey[1].trim();

  const titleM = raw.match(/title\s*=\s*[\{"]([\s\S]+?)[\}"]/i);
  const doiM = raw.match(/doi\s*=\s*[\{"](.+?)[\}"]/i);
  const yearM = raw.match(/year\s*=\s*[\{"]?(\d{4})[\}"]?/i);
  const authorM = raw.match(/author\s*=\s*[\{"]([\s\S]+?)[\}"]/i);

  const title = titleM ? titleM[1].replace(/[\{\}\n]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const doi = doiM ? doiM[1].trim().toLowerCase() : '';
  const year = yearM ? yearM[1].trim() : '';
  const author = authorM ? authorM[1].replace(/[\{\}\n]/g, ' ').replace(/\s+/g, ' ').trim() : '';

  entries.set(key, { key, title, doi, year, author });
  if (doi) byDoi.set(doi, key);
  if (title) byNormalizedTitle.set(normalizeText(title), key);

  if (year) {
    const firstAuthor = author.split(/\band\b|,/i)[0].trim();
    const lastNameMatch = firstAuthor.match(/^[A-Za-z\-]+/);
    if (lastNameMatch) {
      const authorPrefix = lastNameMatch[0].toLowerCase();
      const ayKey = `${authorPrefix}${year}`;
      const existing = byAuthorYear.get(ayKey) || [];
      existing.push(key);
      byAuthorYear.set(ayKey, existing);
    }
    const keyParts = key.split('_');
    if (keyParts.length >= 2) {
      const kAuthor = keyParts[0].toLowerCase();
      const ayKey = `${kAuthor}${year}`;
      const existing = byAuthorYear.get(ayKey) || [];
      if (!existing.includes(key)) {
        existing.push(key);
        byAuthorYear.set(ayKey, existing);
      }
    }
  }
}

console.log(`✓ Parsed ${entries.size} BibTeX entries from references.bib`);
console.log(`✓ Indexed ${byDoi.size} DOIs, ${byNormalizedTitle.size} normalized titles, ${byAuthorYear.size} AuthorYear keys`);

// Test cases:
// 1. AuthorYear resolution
const ayTest = byAuthorYear.get('aghaabbasi2026');
assert.ok(ayTest && ayTest.includes('aghaabbasi_prospects_2026'), 'Aghaabbasi2026 must map to aghaabbasi_prospects_2026');
console.log(`✓ AuthorYear test passed: Aghaabbasi2026 -> ${ayTest}`);

// 2. Ambiguous detection
const maCandidates = byAuthorYear.get('ma2025');
assert.ok(maCandidates && maCandidates.length > 1, 'Ma2025 must have multiple candidates');
console.log(`✓ Ambiguous test passed: Ma2025 -> ${maCandidates.length} candidates (${maCandidates.slice(0, 3).join(', ')}...)`);

// 3. Exact match
assert.ok(entries.has('mizik_how_2023'), 'mizik_how_2023 must exist directly in bib');
console.log('✓ Exact match test passed: mizik_how_2023 found in bib');

// 4. DOI resolution for Paper_ID
const doiTest = byDoi.get('10.32604/cmc.2025.070161');
assert.strictEqual(doiTest, 'alourani_hybrid_2026', 'DOI 10.32604/cmc.2025.070161 must resolve to alourani_hybrid_2026');
console.log(`✓ DOI test passed: 10.32604/cmc.2025.070161 -> ${doiTest}`);

// 5. Rich Candidate Details with Title and Author
const maCandidateDetails = maCandidates.map(k => entries.get(k));
for (const cand of maCandidateDetails) {
  assert.ok(cand.title, `Candidate ${cand.key} must have title`);
  assert.ok(cand.author, `Candidate ${cand.key} must have author`);
  assert.ok(cand.year, `Candidate ${cand.key} must have year`);
}
console.log(`✓ Candidate metadata test passed: all ${maCandidates.length} Ma2025 candidates include full title and author`);

console.log('\n======================================================');
console.log(' ALL END-TO-END RESOLUTION TESTS PASSED (5/5)');
console.log('======================================================\n');
