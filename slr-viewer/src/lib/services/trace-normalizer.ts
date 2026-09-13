/**
 * Centralized Trace Normalizer Utility
 * 
 * Provides unified, exhaustive logic trace mapping & reasoning resolution across all
 * Research Questions (RQs) and Quality Assessment (QA) variables.
 */

export interface TraceResolutionResult {
  mapping: string;
  evidence: string;
}

/**
 * Normalizes a key by stripping RQ prefixes, locate_ prefixes, and non-alphanumeric separators
 */
export function normalizeKeyToken(key: string): string {
  if (!key || typeof key !== 'string') return '';
  return key
    .replace(/^locate_/i, '')
    .replace(/^rq\d+[a-z]?_/i, '')
    .replace(/^locate_/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts Mapping Rules / Reasoning string for a given extracted field key
 * 
 * @param key The extracted variable key (e.g. 'rq1a_resource_constraint_def', 'rq3b_execution_footprint')
 * @param locateMapping The logic_trace.extraction_mapping object from LLM output
 * @param valObj Optional extracted value object or raw value
 * @returns Clean mapping reasoning string or empty string fallback
 */
export function extractMappingReasoning(
  key: string,
  locateMapping: Record<string, any> = {},
  valObj?: any
): string {
  if (!key) return '';

  const cleanKey = key.replace(/^rq\d+[a-z]?_/, '');
  const normKeyToken = normalizeKeyToken(key);

  // Candidate exact lookup keys
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

function extractTextValue(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') {
    return val.trim() === '[object Object]' ? '' : val.trim();
  }
  if (typeof val === 'object' && !Array.isArray(val)) {
    if ('reasoning' in val && val.reasoning) return extractTextValue(val.reasoning);
    if ('justification' in val && val.justification) return extractTextValue(val.justification);
    if ('mapping' in val && val.mapping) return extractTextValue(val.mapping);
    if ('rationale' in val && val.rationale) return extractTextValue(val.rationale);
    if ('explanation' in val && val.explanation) return extractTextValue(val.explanation);
    if ('locate' in val && val.locate) return extractTextValue(val.locate);
    if ('evidence' in val && val.evidence) return extractTextValue(val.evidence);
    if ('quote' in val && val.quote) return extractTextValue(val.quote);
    if ('exact_quote' in val && val.exact_quote) return extractTextValue(val.exact_quote);
    if ('text' in val && val.text) return extractTextValue(val.text);
    return '';
  }
  return String(val).trim();
}

  let traceVal = '';

  const actualMapping = (locateMapping && typeof locateMapping === 'object' && locateMapping.extraction_mapping && typeof locateMapping.extraction_mapping === 'object')
    ? locateMapping.extraction_mapping
    : ((locateMapping && typeof locateMapping === 'object' && locateMapping.appraisal_reasoning && typeof locateMapping.appraisal_reasoning === 'object')
      ? locateMapping.appraisal_reasoning
      : locateMapping);

  // 1. Direct candidate key matching
  if (actualMapping && typeof actualMapping === 'object') {
    for (const cKey of candidateKeys) {
      if (actualMapping[cKey] !== undefined && actualMapping[cKey] !== null && actualMapping[cKey] !== '') {
        traceVal = extractTextValue(actualMapping[cKey]);
        if (traceVal) break;
      }
    }

    // 2. Normalized token matching across all keys in actualMapping
    if (!traceVal && normKeyToken) {
      const matchedKey = Object.keys(actualMapping).find(k => {
        const token = normalizeKeyToken(k);
        return token && (token === normKeyToken || token.includes(normKeyToken) || normKeyToken.includes(token));
      });
      if (matchedKey && actualMapping[matchedKey]) {
        traceVal = extractTextValue(actualMapping[matchedKey]);
      }
    }
  }

  // 3. Fallback to nested properties inside valObj if present
  if (!traceVal && valObj && typeof valObj === 'object' && !Array.isArray(valObj)) {
    traceVal = extractTextValue(valObj);
    if (!traceVal && 'logic_trace' in valObj && valObj.logic_trace && typeof valObj.logic_trace === 'object') {
      traceVal = extractTextValue(valObj.logic_trace);
    }
  }

  return String(traceVal || '').trim();
}

/**
 * Extracts evidence quote string for a given extracted field key or QA item
 */
export function extractEvidenceQuote(
  key: string,
  valObj: any,
  locateMapping?: any
): string {
  // 1. Direct check on valObj
  if (valObj && typeof valObj === 'object' && !Array.isArray(valObj)) {
    if ('evidence' in valObj && valObj.evidence) return String(valObj.evidence).trim();
    if ('exact_quote' in valObj && valObj.exact_quote) return String(valObj.exact_quote).trim();
    if ('quote' in valObj && valObj.quote) return String(valObj.quote).trim();
    if ('text' in valObj && valObj.text) return String(valObj.text).trim();
    if ('logic_trace' in valObj && valObj.logic_trace && typeof valObj.logic_trace === 'object') {
      const lt = valObj.logic_trace;
      if (lt.evidence) return String(lt.evidence).trim();
      if (lt.exact_quote) return String(lt.exact_quote).trim();
      if (lt.quote) return String(lt.quote).trim();
    }
  }

  // 2. Check locateMapping if available
  if (locateMapping && typeof locateMapping === 'object') {
    const actualMap = locateMapping.extraction_mapping || locateMapping.appraisal_reasoning || locateMapping;
    const cleanKey = key ? key.replace(/^rq\d+[a-z]?_/, '') : '';
    const candidates = [
      key,
      `locate_${key}`,
      `evidence_${key}`,
      `quote_${key}`,
      cleanKey,
      `locate_${cleanKey}`,
      `evidence_${cleanKey}`
    ].filter(Boolean);

    for (const cKey of candidates) {
      const entry = actualMap[cKey];
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        if ('evidence' in entry && entry.evidence) return String(entry.evidence).trim();
        if ('exact_quote' in entry && entry.exact_quote) return String(entry.exact_quote).trim();
        if ('quote' in entry && entry.quote) return String(entry.quote).trim();
        if ('text' in entry && entry.text) return String(entry.text).trim();
      }
    }
  }

  return '';
}

/**
 * Normalizes a QA key token (e.g. 'QA-1' -> 'qa1', 'qa1_aims' -> 'qa1aims', 'qa_1' -> 'qa1')
 */
export function normalizeQaKey(key: string): string {
  if (!key || typeof key !== 'string') return '';
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds the matching key in candidateKeys for a given QA rule code
 * 
 * Supports exact match, alphanumeric normalized match, prefix match, and optional index fallback.
 */
export function matchQaRuleKey(
  ruleCode: string,
  candidateKeys: string[],
  ruleIndex?: number
): string | undefined {
  if (!ruleCode && ruleIndex === undefined) return undefined;
  const cleanCode = normalizeQaKey(ruleCode);

  // 1. Direct or normalized match (e.g. "qa1" matches "QA-1", "QA1", "qa1_aims", "qa1")
  const match = candidateKeys.find(k => {
    const cleanK = normalizeQaKey(k);
    return cleanK === cleanCode || cleanK.startsWith(cleanCode) || cleanCode.startsWith(cleanK);
  });
  if (match) return match;

  // 2. Direct key inclusion fallback
  if (candidateKeys.includes(ruleCode)) return ruleCode;

  // 3. Positional fallback by index if available
  if (ruleIndex !== undefined && candidateKeys[ruleIndex]) {
    return candidateKeys[ruleIndex];
  }

  return undefined;
}

/**
 * Finds the matching key in candidateKeys for a given extraction rule json_key
 */
export function matchExtractionKey(
  jsonKey: string,
  candidateKeys: string[],
  ruleIndex?: number
): string | undefined {
  if (!jsonKey && ruleIndex === undefined) return undefined;
  const cleanKey = normalizeKeyToken(jsonKey);
  const normRaw = jsonKey.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Direct or normalized token match
  const match = candidateKeys.find(k => {
    const cleanK = normalizeKeyToken(k);
    const rawK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return rawK === normRaw || (cleanK && (cleanK === cleanKey || cleanK.startsWith(cleanKey) || cleanKey.startsWith(cleanK)));
  });
  if (match) return match;

  // 2. Direct key inclusion fallback
  if (candidateKeys.includes(jsonKey)) return jsonKey;

  // 3. Positional fallback by index
  if (ruleIndex !== undefined && candidateKeys[ruleIndex]) {
    return candidateKeys[ruleIndex];
  }

  return undefined;
}

/**
 * Safely extracts a numeric QA score from any item representation (object or primitive)
 */
export function extractScoreValue(item: any): number | null {
  if (item === undefined || item === null) return null;
  if (typeof item === 'object') {
    const raw = item.score ?? item.value ?? item.val ?? item.numeric_score ?? null;
    if (raw === null || raw === undefined) return null;
    const parsed = parseFloat(String(raw));
    return isNaN(parsed) ? null : parsed;
  }
  const parsed = parseFloat(String(item));
  return isNaN(parsed) ? null : parsed;
}

