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

  let traceVal = '';

  // 1. Direct candidate key matching
  if (locateMapping && typeof locateMapping === 'object') {
    for (const cKey of candidateKeys) {
      if (locateMapping[cKey] !== undefined && locateMapping[cKey] !== null && locateMapping[cKey] !== '') {
        traceVal = String(locateMapping[cKey]);
        break;
      }
    }

    // 2. Normalized token matching across all keys in locateMapping
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

  // 3. Fallback to nested properties inside valObj if present
  if (!traceVal && valObj && typeof valObj === 'object' && !Array.isArray(valObj)) {
    if ('reasoning' in valObj && valObj.reasoning) {
      traceVal = String(valObj.reasoning);
    } else if ('justification' in valObj && valObj.justification) {
      traceVal = String(valObj.justification);
    } else if ('mapping' in valObj && valObj.mapping) {
      traceVal = String(valObj.mapping);
    } else if ('rationale' in valObj && valObj.rationale) {
      traceVal = String(valObj.rationale);
    } else if ('explanation' in valObj && valObj.explanation) {
      traceVal = String(valObj.explanation);
    } else if ('locate' in valObj && valObj.locate) {
      traceVal = String(valObj.locate);
    } else if ('logic_trace' in valObj && valObj.logic_trace && typeof valObj.logic_trace === 'object') {
      const lt = valObj.logic_trace;
      traceVal = String(lt.mapping || lt.reasoning || lt.justification || lt.rationale || lt.locate || '');
    }
  }

  return String(traceVal || '').trim();
}

/**
 * Extracts evidence quote string for a given extracted field key or QA item
 */
export function extractEvidenceQuote(
  key: string,
  valObj: any
): string {
  if (!valObj) return '';

  if (typeof valObj === 'object' && !Array.isArray(valObj)) {
    if ('evidence' in valObj && valObj.evidence) {
      return String(valObj.evidence).trim();
    }
    if ('exact_quote' in valObj && valObj.exact_quote) {
      return String(valObj.exact_quote).trim();
    }
    if ('quote' in valObj && valObj.quote) {
      return String(valObj.quote).trim();
    }
    if ('text' in valObj && valObj.text) {
      return String(valObj.text).trim();
    }
    if ('rationale' in valObj && valObj.rationale) {
      return String(valObj.rationale).trim();
    }
    if ('reasoning' in valObj && valObj.reasoning) {
      return String(valObj.reasoning).trim();
    }
    if ('logic_trace' in valObj && valObj.logic_trace && typeof valObj.logic_trace === 'object') {
      const lt = valObj.logic_trace;
      if (lt.evidence) return String(lt.evidence).trim();
      if (lt.exact_quote) return String(lt.exact_quote).trim();
      if (lt.quote) return String(lt.quote).trim();
      if (lt.rationale) return String(lt.rationale).trim();
      if (lt.reasoning) return String(lt.reasoning).trim();
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

