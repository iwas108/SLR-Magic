import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../db';
import { globalEventManager } from './global-event-manager';
import Database from 'better-sqlite3';

export * from './reference-syncer-types';
import {
  BibEntry,
  BibDatabaseStatus,
  CitationCandidate,
  CitationOccurrence,
  CitationStatus,
  GlobalScanSummary,
  ResolutionResult,
  ScannedFileResult,
  SuspiciousInTextFinding,
  cleanBibText,
  formatAuthorEtAl,
  getCandidateDetail,
  normalizeText
} from './reference-syncer-types';

export interface BibCache {
  mtimeMs: number;
  sizeBytes: number;
  loadedAt: number;
  totalEntries: number;
  entries: Map<string, BibEntry>;
  byDoi: Map<string, string>;
  byNormalizedTitle: Map<string, string>;
  byAuthorYear: Map<string, string[]>;
}

let cachedBib: BibCache | null = null;
let bibWatcherInitialized = false;
let bibDebounceTimer: NodeJS.Timeout | null = null;

/**
 * Initializes autonomous file watcher on the db/ directory
 * Captures external file replacements (Zotero/Mendeley/Explorer overwrites)
 */
export function ensureBibWatcher(): void {
  if (bibWatcherInitialized) return;
  bibWatcherInitialized = true;

  const dbDir = path.resolve(PROJECT_ROOT, 'db');
  const bibPath = path.resolve(dbDir, 'references.bib');

  try {
    if (!fs.existsSync(dbDir)) return;

    const watcher = fs.watch(dbDir, (eventType, filename) => {
      if (!filename || filename.toLowerCase().includes('references.bib')) {
        if (bibDebounceTimer) clearTimeout(bibDebounceTimer);
        bibDebounceTimer = setTimeout(() => {
          try {
            if (fs.existsSync(bibPath)) {
              const stat = fs.statSync(bibPath);
              if (!cachedBib || cachedBib.mtimeMs !== stat.mtimeMs || cachedBib.sizeBytes !== stat.size) {
                console.log(`[ReferenceSyncer] Detected db/references.bib change (${eventType}). Auto-reloading...`);
                const fresh = loadBibDatabase(true);
                globalEventManager.broadcast({
                  type: 'BIB_DATABASE_UPDATED',
                  totalEntries: fresh.entries.size,
                  sizeBytes: stat.size,
                  mtimeMs: stat.mtimeMs,
                  timestamp: Date.now()
                });
              }
            }
          } catch (err) {
            console.error('[ReferenceSyncer] Error in file watcher auto-reloading references.bib:', err);
          }
        }, 300);
      }
    });

    watcher.unref();
  } catch (err) {
    console.error('[ReferenceSyncer] Failed to initialize db/ directory watcher:', err);
  }
}

/**
 * Parses references.bib from slr-ide/db/references.bib with multi-attribute caching
 */
export function loadBibDatabase(force = false): BibCache {
  ensureBibWatcher();

  const bibPath = path.resolve(PROJECT_ROOT, 'db', 'references.bib');
  if (!fs.existsSync(bibPath)) {
    return {
      mtimeMs: 0,
      sizeBytes: 0,
      loadedAt: Date.now(),
      totalEntries: 0,
      entries: new Map(),
      byDoi: new Map(),
      byNormalizedTitle: new Map(),
      byAuthorYear: new Map()
    };
  }

  const stat = fs.statSync(bibPath);
  if (!force && cachedBib && cachedBib.mtimeMs === stat.mtimeMs && cachedBib.sizeBytes === stat.size) {
    return cachedBib;
  }

  const bibContent = fs.readFileSync(bibPath, 'utf-8');
  const entries = new Map<string, BibEntry>();
  const byDoi = new Map<string, string>();
  const byNormalizedTitle = new Map<string, string>();
  const byAuthorYear = new Map<string, string[]>();

  // Split entries by @type{
  const rawEntries = bibContent.split(/\n@/);
  for (const raw of rawEntries) {
    const cleanRaw = raw.trim().replace(/^@/, '');
    const matchKey = cleanRaw.match(/^[a-zA-Z]+\s*\{\s*([^,]+),/);
    if (!matchKey) continue;
    const key = matchKey[1].trim();

    const typeMatch = cleanRaw.match(/^([a-zA-Z]+)/);
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'article';

    const titleM = raw.match(/title\s*=\s*[\{"]([\s\S]+?)[\}"]/i);
    const doiM = raw.match(/doi\s*=\s*[\{"](.+?)[\}"]/i);
    const yearM = raw.match(/year\s*=\s*[\{"]?(\d{4})[\}"]?/i);
    const authorM = raw.match(/author\s*=\s*[\{"]([\s\S]+?)[\}"]/i);
    const journalM = raw.match(/(?:journal|booktitle)\s*=\s*[\{"]([\s\S]+?)[\}"]/i);
    const fileM = raw.match(/file\s*=\s*[\{"]([\s\S]+?)[\}"]/i);

    const title = titleM ? titleM[1].replace(/[\{\}\n]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const doi = doiM ? doiM[1].trim().toLowerCase() : '';
    const year = yearM ? yearM[1].trim() : '';
    const author = authorM ? authorM[1].replace(/[\{\}\n]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const journal = journalM ? journalM[1].replace(/[\{\}\n]/g, ' ').trim() : undefined;
    const file = fileM ? fileM[1].trim() : undefined;

    const entry: BibEntry = { key, type, title, doi, year, author, journal, file };
    entries.set(key, entry);

    if (doi) {
      byDoi.set(doi, key);
    }

    const normTitle = normalizeText(title);
    if (normTitle) {
      byNormalizedTitle.set(normTitle, key);
    }

    // Author-Year indexing
    if (year) {
      // First author's last name
      const firstAuthor = author.split(/\band\b|,/i)[0].trim();
      const lastNameMatch = firstAuthor.match(/^[A-Za-z\-]+/);
      if (lastNameMatch) {
        const authorPrefix = lastNameMatch[0].toLowerCase();
        const ayKey = `${authorPrefix}${year}`;
        const existing = byAuthorYear.get(ayKey) || [];
        existing.push(key);
        byAuthorYear.set(ayKey, existing);
      }

      // Also index key's own author prefix if formatted like author_title_year
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

  cachedBib = {
    mtimeMs: stat.mtimeMs,
    sizeBytes: stat.size,
    loadedAt: Date.now(),
    totalEntries: entries.size,
    entries,
    byDoi,
    byNormalizedTitle,
    byAuthorYear
  };

  return cachedBib;
}

/**
 * Returns comprehensive status of references.bib on disk and in memory
 */
export function getBibDatabaseStatus(): BibDatabaseStatus {
  const bibPath = path.resolve(PROJECT_ROOT, 'db', 'references.bib');
  if (!fs.existsSync(bibPath)) {
    return {
      exists: false,
      filePath: bibPath,
      totalEntries: 0,
      mtimeMs: 0,
      mtimeIso: '',
      sizeBytes: 0,
      sizeFormatted: '0 KB',
      loadedAtIso: ''
    };
  }

  const stat = fs.statSync(bibPath);
  const bib = loadBibDatabase();

  return {
    exists: true,
    filePath: bibPath,
    totalEntries: bib.entries.size,
    mtimeMs: stat.mtimeMs,
    mtimeIso: new Date(stat.mtimeMs).toISOString(),
    sizeBytes: stat.size,
    sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
    loadedAtIso: new Date(bib.loadedAt).toISOString()
  };
}

/**
 * Safely replaces db/references.bib with new content, creating an automatic backup
 */
export function replaceBibDatabase(newContent: string): { success: boolean; totalEntries: number; backupPath?: string; error?: string } {
  const dbDir = path.resolve(PROJECT_ROOT, 'db');
  const bibPath = path.resolve(dbDir, 'references.bib');
  const backupPath = path.resolve(dbDir, 'references.bib.bak');

  if (!newContent || typeof newContent !== 'string') {
    return { success: false, totalEntries: 0, error: 'Empty or invalid BibTeX content provided' };
  }

  // Preflight check: Must contain at least one valid BibTeX entry e.g. @article{ or @misc{
  if (!/@\s*[a-zA-Z]+\s*\{/i.test(newContent)) {
    return { success: false, totalEntries: 0, error: 'Content does not contain any valid BibTeX entry (@entry{...})' };
  }

  try {
    // 1. Create safety backup of existing file
    if (fs.existsSync(bibPath)) {
      try {
        fs.copyFileSync(bibPath, backupPath);
      } catch (backupErr) {
        console.warn('[ReferenceSyncer] Could not create backup references.bib.bak:', backupErr);
      }
    }

    // 2. Write new content
    fs.writeFileSync(bibPath, newContent, 'utf-8');

    // 3. Force reload in memory
    const freshBib = loadBibDatabase(true);

    // 4. Broadcast event
    globalEventManager.broadcast({
      type: 'BIB_DATABASE_UPDATED',
      totalEntries: freshBib.entries.size,
      sizeBytes: Buffer.byteLength(newContent, 'utf-8'),
      timestamp: Date.now()
    });

    return {
      success: true,
      totalEntries: freshBib.entries.size,
      backupPath: fs.existsSync(backupPath) ? backupPath : undefined
    };
  } catch (err: any) {
    console.error('[ReferenceSyncer] Failed to replace references.bib:', err);
    return { success: false, totalEntries: 0, error: err?.message || 'Failed to write references.bib' };
  }
}

/**
 * Calculates string similarity between two strings
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return minLen / maxLen;
  }

  const pairs1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    pairs1.add(s1.slice(i, i + 2));
  }
  const pairs2 = new Set<string>();
  for (let i = 0; i < s2.length - 1; i++) {
    pairs2.add(s2.slice(i, i + 2));
  }

  let intersection = 0;
  for (const pair of pairs1) {
    if (pairs2.has(pair)) intersection++;
  }

  return (2.0 * intersection) / (pairs1.size + pairs2.size);
}

/**
 * Look up paper in slr.db
 */
export function getDbPaperMetadata(paperId: string, projectId?: string): { title: string; authors: string; year: string; doi: string } | null {
  try {
    const dbPath = path.resolve(PROJECT_ROOT, 'db', 'slr.db');
    if (!fs.existsSync(dbPath)) return null;

    const db = new Database(dbPath, { readonly: true });
    let row: any = null;

    if (projectId) {
      row = db.prepare(`
        SELECT Title, Authors, Year, DOI 
        FROM papers 
        WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
        LIMIT 1
      `).get(paperId, projectId, projectId);
    }

    if (!row) {
      row = db.prepare(`
        SELECT Title, Authors, Year, DOI 
        FROM papers 
        WHERE Paper_ID = ?
        LIMIT 1
      `).get(paperId);
    }

    db.close();

    if (row) {
      return {
        title: row.Title || '',
        authors: row.Authors || '',
        year: row.Year ? String(row.Year) : '',
        doi: (row.DOI || '').trim().toLowerCase()
      };
    }
    return null;
  } catch (err) {
    console.error('Error fetching paper metadata from slr.db:', err);
    return null;
  }
}

/**
 * Resolves a single citation key against references.bib and slr.db
 */
export function resolveCitationKey(
  originalKey: string,
  bibData: BibCache,
  projectId?: string
): ResolutionResult {
  const flags: string[] = [];

  const makeResult = (res: ResolutionResult): ResolutionResult => {
    if (res.replacementKey && !res.targetMetadata) {
      const entry = bibData.entries.get(res.replacementKey);
      if (entry) res.targetMetadata = getCandidateDetail(entry);
    }
    if (res.candidates && res.candidates.length > 0 && !res.candidateDetails) {
      res.candidateDetails = res.candidates.map(k => {
        const entry = bibData.entries.get(k);
        return entry ? getCandidateDetail(entry) : { key: k, title: '', author: '', year: '' };
      });
    }
    return res;
  };

  // Empty or invalid check
  if (!originalKey || !originalKey.trim()) {
    return makeResult({
      replacementKey: null,
      status: 'SUSPICIOUS',
      formatType: 'UNKNOWN',
      matchReason: 'Empty citation key',
      confidence: 0,
      suspiciousFlags: ['Empty citation key inside macro']
    });
  }

  const trimmedKey = originalKey.trim();

  // 1. EXACT MATCH in references.bib
  if (bibData.entries.has(trimmedKey)) {
    return makeResult({
      replacementKey: trimmedKey,
      status: 'EXACT_MATCH',
      formatType: 'EXACT_BIB',
      matchReason: 'Authoritative exact key match in references.bib',
      confidence: 1.0
    });
  }

  // 2. CHECK IF KEY IS AN SLR MAGIC Paper_ID (Format: Author_Year_TitleSlug_Hash1_Hash2)
  const isPaperIdFormat = /_[0-9a-f]{5}_[0-9a-f]{4}$/i.test(trimmedKey) || /^[A-Za-z]+_\d{4}_/i.test(trimmedKey);
  if (isPaperIdFormat) {
    const dbPaper = getDbPaperMetadata(trimmedKey, projectId);
    flags.push('SLR Magic Paper_ID format detected');

    if (dbPaper) {
      // 2a. Match via DOI
      if (dbPaper.doi && bibData.byDoi.has(dbPaper.doi)) {
        const targetBibKey = bibData.byDoi.get(dbPaper.doi)!;
        return makeResult({
          replacementKey: targetBibKey,
          status: 'RESOLVED',
          formatType: 'SLR_PAPER_ID',
          matchReason: `Matched via Paper DOI (${dbPaper.doi}) in references.bib`,
          confidence: 0.99,
          suspiciousFlags: flags
        });
      }

      // 2b. Match via Normalized Title
      const normDbTitle = normalizeText(dbPaper.title);
      if (normDbTitle && bibData.byNormalizedTitle.has(normDbTitle)) {
        const targetBibKey = bibData.byNormalizedTitle.get(normDbTitle)!;
        return makeResult({
          replacementKey: targetBibKey,
          status: 'RESOLVED',
          formatType: 'SLR_PAPER_ID',
          matchReason: 'Exact normalized title match in references.bib',
          confidence: 0.95,
          suspiciousFlags: flags
        });
      }

      // 2c. Match via Fuzzy Title
      if (dbPaper.title) {
        let bestKey: string | null = null;
        let bestSim = 0.0;

        for (const [bKey, bEntry] of bibData.entries.entries()) {
          const sim = stringSimilarity(dbPaper.title, bEntry.title);
          if (sim > bestSim) {
            bestSim = sim;
            bestKey = bKey;
          }
        }

        if (bestKey && bestSim >= 0.75) {
          return makeResult({
            replacementKey: bestKey,
            status: 'RESOLVED',
            formatType: 'SLR_PAPER_ID',
            matchReason: `High-confidence title similarity (${(bestSim * 100).toFixed(0)}%) in references.bib`,
            confidence: bestSim,
            suspiciousFlags: flags
          });
        }
      }

      // Paper is in SLR DB, but missing from references.bib!
      flags.push('Paper exists in slr.db but is absent from references.bib');
      return makeResult({
        replacementKey: null,
        status: 'MISSING',
        formatType: 'SLR_PAPER_ID',
        matchReason: `Found in SLR database ("${dbPaper.title.slice(0, 45)}..."), but missing from references.bib`,
        confidence: 0,
        suspiciousFlags: flags
      });
    }

    // Try extracting title slug from Paper_ID (e.g. AbdullahAlourani_2025_HybridAIIoTFram_2a49b_2ef3 -> HybridAIIoTFram)
    const parts = trimmedKey.split('_');
    if (parts.length >= 3) {
      const slug = parts[2];
      // Convert CamelCase to words
      const slugWords = slug.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
      let bestSlugKey: string | null = null;
      let bestSlugSim = 0.0;

      for (const [bKey, bEntry] of bibData.entries.entries()) {
        const sim = stringSimilarity(slugWords, bEntry.title);
        if (sim > bestSlugSim) {
          bestSlugSim = sim;
          bestSlugKey = bKey;
        }
      }

      if (bestSlugKey && bestSlugSim >= 0.70) {
        return makeResult({
          replacementKey: bestSlugKey,
          status: 'RESOLVED',
          formatType: 'SLR_PAPER_ID',
          matchReason: `Title slug matched "${bibData.entries.get(bestSlugKey)?.title.slice(0, 40)}..." (${(bestSlugSim * 100).toFixed(0)}%)`,
          confidence: bestSlugSim,
          suspiciousFlags: flags
        });
      }
    }
  }

  // 3. AUTHOR-YEAR PATTERN (e.g., Aghaabbasi2026, Kafi2025, Ma2025)
  const ayMatch = trimmedKey.match(/^([A-Za-z\-]+)(\d{4})$/);
  if (ayMatch) {
    const authorPrefix = ayMatch[1].toLowerCase();
    const yearStr = ayMatch[2];
    flags.push('Unformatted AuthorYear citation style');

    const ayKey = `${authorPrefix}${yearStr}`;
    let candidates = bibData.byAuthorYear.get(ayKey) || [];

    // If none found in index, search authors containing prefix and year
    if (candidates.length === 0) {
      candidates = Array.from(bibData.entries.values())
        .filter(e => e.year === yearStr && e.author.toLowerCase().includes(authorPrefix))
        .map(e => e.key);
    }

    if (candidates.length === 1) {
      return makeResult({
        replacementKey: candidates[0],
        status: 'RESOLVED',
        formatType: 'AUTHOR_YEAR',
        matchReason: `Unique Author-Year resolution: ${candidates[0]}`,
        confidence: 0.95,
        suspiciousFlags: flags
      });
    } else if (candidates.length > 1) {
      return makeResult({
        replacementKey: candidates[0], // default suggestion
        status: 'AMBIGUOUS',
        formatType: 'AUTHOR_YEAR',
        matchReason: `Ambiguous: ${candidates.length} matching candidate papers found for ${trimmedKey}`,
        confidence: 0.50,
        candidates,
        suspiciousFlags: [...flags, `Multiple candidates (${candidates.length})`]
      });
    } else {
      return makeResult({
        replacementKey: null,
        status: 'MISSING',
        formatType: 'AUTHOR_YEAR',
        matchReason: `No publication by author "${authorPrefix}" in ${yearStr} found in references.bib`,
        confidence: 0,
        suspiciousFlags: [...flags, 'No author-year match found']
      });
    }
  }

  // 4. CITATION IN PAPER TITLE FORMAT (e.g. spaces, multi-words, or unslugified title)
  const hasSpaces = /\s+/.test(trimmedKey);
  const isTitleFormat = hasSpaces || trimmedKey.includes('-') || trimmedKey.length > 30;
  if (isTitleFormat) {
    flags.push('Citation key in paper title format');
    const normKey = normalizeText(trimmedKey);

    if (bibData.byNormalizedTitle.has(normKey)) {
      const targetBibKey = bibData.byNormalizedTitle.get(normKey)!;
      return makeResult({
        replacementKey: targetBibKey,
        status: 'RESOLVED',
        formatType: 'TITLE_FORMAT',
        matchReason: 'Matched directly to paper title in references.bib',
        confidence: 0.95,
        suspiciousFlags: flags
      });
    }

    // Fuzzy title search
    let bestKey: string | null = null;
    let bestSim = 0.0;
    for (const [bKey, bEntry] of bibData.entries.entries()) {
      const sim = stringSimilarity(trimmedKey, bEntry.title);
      if (sim > bestSim) {
        bestSim = sim;
        bestKey = bKey;
      }
    }

    if (bestKey && bestSim >= 0.70) {
      return makeResult({
        replacementKey: bestKey,
        status: 'RESOLVED',
        formatType: 'TITLE_FORMAT',
        matchReason: `Fuzzy title match (${(bestSim * 100).toFixed(0)}%) to "${bibData.entries.get(bestKey)?.title.slice(0, 40)}..."`,
        confidence: bestSim,
        suspiciousFlags: flags
      });
    }
  }

  // 5. UNKNOWN / BROKEN CITATION
  return makeResult({
    replacementKey: null,
    status: 'MISSING',
    formatType: 'UNKNOWN',
    matchReason: 'Unrecognized citation key not found in references.bib or slr.db',
    confidence: 0,
    suspiciousFlags: ['Unknown broken citation']
  });
}

/**
 * Scans LaTeX content for citations and suspicious unformatted in-text patterns
 */
export function scanLatexFile(
  fileName: string,
  content: string,
  bibData?: BibCache,
  projectId?: string
): ScannedFileResult {
  const activeBib = bibData || loadBibDatabase();
  const citations: CitationOccurrence[] = [];
  const suspiciousFindings: SuspiciousInTextFinding[] = [];
  const lines = content.split(/\r?\n/);

  // 1. Scan for all LaTeX citation commands: \cite, \citep, \citet, \parencite, etc., including optional bracket arguments like [e.g.,][]
  const citeRegex = /\\([a-zA-Z*]*cite[a-zA-Z*]*)((?:\s*\[[^\]]*\])*)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  let citIdx = 0;
  while ((match = citeRegex.exec(content)) !== null) {
    const command = match[1];
    const optArgs = match[2] || '';
    const rawKeys = match[3];
    const matchIndex = match.index;

    // Determine line number
    const textBefore = content.substring(0, matchIndex);
    const lineNum = (textBefore.match(/\n/g) || []).length + 1;
    const currentLine = lines[lineNum - 1] || '';

    // Check if line is commented out (% at line start before \cite)
    const isCommented = currentLine.trim().startsWith('%');
    if (isCommented) continue;

    // Split multiple keys in single \cite{k1, k2}
    const splitKeys = rawKeys.split(',');
    for (const rawKey of splitKeys) {
      const k = rawKey.trim();
      citIdx++;
      const id = `cite-${fileName}-${lineNum}-${citIdx}`;

      if (!k) {
        suspiciousFindings.push({
          id: `susp-empty-${citIdx}`,
          file: fileName,
          lineNumber: lineNum,
          snippet: currentLine.trim(),
          patternType: 'EMPTY_CITE',
          description: `Empty or whitespace key inside \\${command}${optArgs}{...}`,
          suggestedFix: 'Remove extra commas or supply a valid BibTeX key'
        });
        continue;
      }

      const resolution = resolveCitationKey(k, activeBib, projectId);

      // Extract context snippet: ~60 chars before and after
      const snippetStart = Math.max(0, currentLine.indexOf(k) - 40);
      const snippetEnd = Math.min(currentLine.length, currentLine.indexOf(k) + k.length + 40);
      const contextSnippet = currentLine.substring(snippetStart, snippetEnd).trim();

      citations.push({
        id,
        file: fileName,
        command,
        optArgs,
        originalKey: k,
        replacementKey: resolution.replacementKey,
        status: resolution.status,
        formatType: resolution.formatType,
        matchReason: resolution.matchReason,
        confidence: resolution.confidence,
        candidates: resolution.candidates,
        candidateDetails: resolution.candidateDetails,
        targetMetadata: resolution.targetMetadata,
        lineNumber: lineNum,
        contextSnippet: contextSnippet || currentLine.trim(),
        suspiciousFlags: resolution.suspiciousFlags,
        userOverride: null,
        isIgnored: false
      });
    }
  }

  // 2. Scan for suspicious unformatted citations in plain text:
  // E.g. [Author et al., 2024], [Author, 2024], (Author, 2024), (Author et al., 2024)
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('%')) return; // ignore comments
    if (trimmed.startsWith('\\') && (trimmed.includes('\\item[') || trimmed.includes('\\begin') || trimmed.includes('\\section'))) return;

    // Pattern 1: Parenthetical e.g. (Smith et al., 2024) or (Smith 2024) outside \cite
    const parenRegex = /\(([A-Z][a-zA-Z\-]+(?:\s+et\s+al\.?)?,?\s+(?:19|20)\d{2})\)/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = parenRegex.exec(line)) !== null) {
      suspiciousFindings.push({
        id: `susp-paren-${lineNum}-${pMatch.index}`,
        file: fileName,
        lineNumber: lineNum,
        snippet: line.trim(),
        patternType: 'PARENTHETICAL_AUTHOR_YEAR',
        description: `Unformatted parenthetical citation detected: "${pMatch[1]}"`,
        suggestedFix: `Convert to \\citep{...} macro using the appropriate BibTeX key`
      });
    }

    // Pattern 2: Bracketed Author Year e.g. [Smith et al., 2024]
    const bracketRegex = /\[([A-Z][a-zA-Z\-]+(?:\s+et\s+al\.?)?,?\s+(?:19|20)\d{2})\]/g;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = bracketRegex.exec(line)) !== null) {
      suspiciousFindings.push({
        id: `susp-bracket-${lineNum}-${bMatch.index}`,
        file: fileName,
        lineNumber: lineNum,
        snippet: line.trim(),
        patternType: 'BRACKET_AUTHOR_YEAR',
        description: `Unformatted bracketed citation detected: "${bMatch[1]}"`,
        suggestedFix: `Convert to \\citep{...} macro`
      });
    }
  });

  // Calculate statistics
  const stats = {
    total: citations.length,
    exact: citations.filter(c => c.status === 'EXACT_MATCH').length,
    replaced: citations.filter(c => c.status === 'RESOLVED').length,
    ambiguous: citations.filter(c => c.status === 'AMBIGUOUS').length,
    missing: citations.filter(c => c.status === 'MISSING').length,
    suspicious: citations.filter(c => c.status === 'SUSPICIOUS').length
  };

  // Generate initial replaced content using resolved replacements
  const replacementMap: Record<string, string> = {};
  for (const c of citations) {
    if (c.status === 'RESOLVED' && c.replacementKey && c.replacementKey !== c.originalKey) {
      replacementMap[c.originalKey] = c.replacementKey;
    }
  }

  const processedContent = generateSynchronizedLatex(content, replacementMap);

  return {
    fileName,
    originalSize: Buffer.byteLength(content, 'utf-8'),
    totalCitations: citations.length,
    citations,
    suspiciousFindings,
    stats,
    processedContent
  };
}

/**
 * Safely replaces citation keys inside LaTeX \cite* commands
 */
export function generateSynchronizedLatex(
  originalContent: string,
  replacements: Record<string, string>
): string {
  if (Object.keys(replacements).length === 0) {
    return originalContent;
  }

  return originalContent.replace(
    /\\([a-zA-Z*]*cite[a-zA-Z*]*)((?:\s*\[[^\]]*\])*)\s*\{([^}]+)\}/g,
    (fullMatch, cmd, optArgs, rawKeys) => {
      const keys = rawKeys.split(',');
      let hasChanges = false;

      const newKeys = keys.map((rawK: string) => {
        const k = rawK.trim();
        if (replacements[k]) {
          hasChanges = true;
          // preserve leading/trailing whitespace if any
          return rawK.replace(k, replacements[k]);
        }
        return rawK;
      });

      if (hasChanges) {
        return `\\${cmd}${optArgs}{${newKeys.join(',')}}`;
      }
      return fullMatch;
    }
  );
}
