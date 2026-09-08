/**
 * SLR IDE: Reference Syncer Types & Pure Utilities
 * Pure TypeScript domain definitions and client-safe helpers with zero Node.js/DB dependencies.
 */

export interface BibEntry {
  key: string;
  type: string;
  title: string;
  doi: string;
  year: string;
  author: string;
  journal?: string;
  file?: string;
}

export interface BibDatabaseStatus {
  exists: boolean;
  filePath: string;
  totalEntries: number;
  mtimeMs: number;
  mtimeIso: string;
  sizeBytes: number;
  sizeFormatted: string;
  loadedAtIso: string;
}

export type CitationStatus = 'EXACT_MATCH' | 'RESOLVED' | 'AMBIGUOUS' | 'MISSING' | 'SUSPICIOUS';

export interface CitationCandidate {
  key: string;
  title: string;
  author: string;
  year: string;
  doi?: string;
  journal?: string;
}

export interface CitationOccurrence {
  id: string;
  file: string;
  command: string; // e.g., 'citep', 'citet', 'cite'
  optArgs?: string; // e.g., '[e.g.,][]', '[see][p. 15]'
  originalKey: string;
  replacementKey: string | null;
  status: CitationStatus;
  formatType: 'EXACT_BIB' | 'SLR_PAPER_ID' | 'AUTHOR_YEAR' | 'TITLE_FORMAT' | 'UNKNOWN';
  matchReason: string;
  confidence: number;
  candidates?: string[];
  candidateDetails?: CitationCandidate[];
  targetMetadata?: CitationCandidate;
  lineNumber: number;
  contextSnippet: string;
  suspiciousFlags?: string[];
  userOverride?: string | null;
  isIgnored?: boolean;
}

export interface SuspiciousInTextFinding {
  id: string;
  file: string;
  lineNumber: number;
  snippet: string;
  patternType: 'PARENTHETICAL_AUTHOR_YEAR' | 'BRACKET_AUTHOR_YEAR' | 'NUMERIC_CITATION' | 'EMPTY_CITE' | 'MALFORMED_KEY';
  description: string;
  suggestedFix?: string;
}

export interface ScannedFileResult {
  fileName: string;
  originalSize: number;
  totalCitations: number;
  citations: CitationOccurrence[];
  suspiciousFindings: SuspiciousInTextFinding[];
  stats: {
    total: number;
    exact: number;
    replaced: number;
    ambiguous: number;
    missing: number;
    suspicious: number;
  };
  processedContent: string;
}

export interface GlobalScanSummary {
  totalFiles: number;
  totalCitations: number;
  exactMatches: number;
  resolvedReplacements: number;
  ambiguousCitations: number;
  missingFromBib: number;
  suspiciousFindingsCount: number;
  files: ScannedFileResult[];
}

export interface ResolutionResult {
  replacementKey: string | null;
  status: CitationStatus;
  formatType: CitationOccurrence['formatType'];
  matchReason: string;
  confidence: number;
  candidates?: string[];
  candidateDetails?: CitationCandidate[];
  targetMetadata?: CitationCandidate;
  suspiciousFlags?: string[];
}

/**
 * Normalizes text for case- and punctuation-insensitive matching
 */
export function normalizeText(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Strips LaTeX capitalization braces and excessive whitespace
 */
export function cleanBibText(s: string): string {
  return (s || '').replace(/[\{\}]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Formats a BibTeX author string into standard short citation form (e.g. "Ma et al.")
 */
export function formatAuthorEtAl(authorStr: string): string {
  if (!authorStr) return '';
  const cleaned = cleanBibText(authorStr);
  const authors = cleaned.split(/\s+and\s+/i);
  if (authors.length === 1) {
    const parts = authors[0].split(',');
    return parts[0].trim();
  }
  const first = authors[0].split(',')[0].trim();
  return `${first} et al.`;
}

/**
 * Extracts clean CitationCandidate metadata from a BibEntry
 */
export function getCandidateDetail(entry: BibEntry): CitationCandidate {
  return {
    key: entry.key,
    title: cleanBibText(entry.title),
    author: cleanBibText(entry.author),
    year: entry.year || '',
    doi: entry.doi || '',
    journal: cleanBibText(entry.journal || '')
  };
}
