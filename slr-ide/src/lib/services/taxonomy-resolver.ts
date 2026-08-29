/**
 * Taxonomy Resolver Service
 * Centralized source of truth for Umbrellanizer taxonomy resolution, canonical string normalization,
 * and extracted token parsing across all SLR IDE modules, visualizer components, and export endpoints.
 */

export interface TaxonomyOptions {
  useUmbrellanizer?: boolean;
  umbrellanizerMap?: Record<string, any>;
  splitMultiValues?: boolean;
  excludeEmpty?: boolean;
}

/**
 * Normalizes unicode dashes (en-dash, em-dash, minus, replacement character) and non-breaking spaces,
 * trims and collapses multiple whitespaces to single spaces.
 */
export function canonicalizeString(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  return str
    .replace(/[\u2013\u2014\u2212\uFFFD]/g, '-')
    .replace(/[\u00A0\u200B\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a string specifically for dictionary key lookup (lowercase + canonicalized).
 */
export function normalizeForLookup(val: any): string {
  return canonicalizeString(val).toLowerCase();
}

/**
 * Safely converts any data type (including nested object structures with value/name/title/umbrella_category)
 * into a clean, human-readable string without returning '[object Object]'.
 */
export function safeString(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') {
    const trimmed = canonicalizeString(val);
    return trimmed === '[object Object]' ? '' : trimmed;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(safeString).filter(Boolean).join(', ');
    }
    const str = val.umbrella_category ?? val.value ?? val.canonical ?? val.name ?? val.title ?? val.answer ?? val.score ?? '';
    if (typeof str === 'object') return safeString(str);
    const res = canonicalizeString(str);
    return res === '[object Object]' ? '' : res;
  }
  return canonicalizeString(String(val));
}

/**
 * Identifies whether a given extraction research question key represents a single-valued descriptive entity
 * where natural commas should NOT be split into separate multi-tokens (e.g. autonomy levels, constraint definitions).
 */
export function isSingleValueField(fieldKey: string): boolean {
  const cleanKey = fieldKey.startsWith('ext:') ? fieldKey.substring(4) : fieldKey;
  const singleValuePrefixes = [
    'rq1a',
    'rq2',
    'rq4',
    'rq6',
    'rq8a',
    'rq8_a',
    'rq8b',
    'rq8_b'
  ];
  return singleValuePrefixes.some(p => cleanKey.toLowerCase().startsWith(p));
}

/**
 * Normalizes raw extracted data tokens from any format (array, string, or wrapped object)
 * into a clean array of string tokens.
 */
export function normalizeExtractedTokens(val: any, fieldKey?: string): string[] {
  if (val === undefined || val === null || val === '') return [];

  let targetVal = val;
  if (typeof targetVal === 'object' && targetVal !== null && !Array.isArray(targetVal)) {
    if ('value' in targetVal) {
      targetVal = (targetVal as any).value;
    }
  }

  if (targetVal === undefined || targetVal === null || targetVal === '') return [];

  const rawTokens: string[] = [];
  const isSingle = fieldKey ? isSingleValueField(fieldKey) : false;

  if (Array.isArray(targetVal)) {
    targetVal.forEach(item => {
      if (typeof item === 'string' && item.includes(',') && !isSingle) {
        item.split(',').forEach(t => {
          const clean = canonicalizeString(t);
          if (clean) rawTokens.push(clean);
        });
      } else if (item !== undefined && item !== null && item !== '') {
        const clean = safeString(item);
        if (clean) rawTokens.push(clean);
      }
    });
  } else if (typeof targetVal === 'string') {
    if (targetVal.includes(',') && !isSingle) {
      targetVal.split(',').forEach(t => {
        const clean = canonicalizeString(t);
        if (clean) rawTokens.push(clean);
      });
    } else {
      const clean = canonicalizeString(targetVal);
      if (clean) rawTokens.push(clean);
    }
  } else {
    const clean = safeString(targetVal);
    if (clean) rawTokens.push(clean);
  }

  return rawTokens.filter(t => t.toUpperCase() !== 'NOT_STATED' && t !== '');
}

/**
 * Resolves the raw field value through the project's Umbrellanizer taxonomy map using strict,
 * exact case-insensitive and canonicalized key matching. Eliminates substring collisions.
 */
export function resolveUmbrellanizerValue(
  val: any,
  fieldKey: string,
  useUmbrellanizer: boolean = true,
  umbrellanizerMap: Record<string, any> = {}
): string {
  if (val === undefined || val === null || val === '') return '';
  const rawVal = safeString(val).trim();
  if (!rawVal || rawVal === '[object Object]') return '';
  if (!useUmbrellanizer) return rawVal;

  const rawNorm = normalizeForLookup(rawVal);
  const realKey = fieldKey.startsWith('ext:') ? fieldKey.substring(4) : fieldKey;
  const dict = umbrellanizerMap[fieldKey] || umbrellanizerMap[realKey] || umbrellanizerMap[`ext:${realKey}`];

  if (!dict) return rawVal;

  // Handle Array format: [ { raw_token: "...", umbrella_category: "..." } ]
  if (Array.isArray(dict)) {
    const matchedItem = dict.find((item: any) => {
      if (!item || !item.raw_token) return false;
      return normalizeForLookup(item.raw_token) === rawNorm;
    });
    if (matchedItem) {
      const cat = safeString(matchedItem.umbrella_category || matchedItem.raw_token);
      return cat || rawVal;
    }
    return rawVal;
  }

  // Handle Object dictionary format: { "raw_token": { umbrella_category: "..." } } or { "raw_token": "category" }
  if (typeof dict === 'object' && dict !== null) {
    const matchedKey = Object.keys(dict).find(k => normalizeForLookup(k) === rawNorm);
    if (matchedKey) {
      const mappedVal = dict[matchedKey];
      if (mappedVal !== undefined && mappedVal !== null) {
        if (typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
          const cat = safeString(mappedVal.umbrella_category || matchedKey);
          return cat || rawVal;
        }
        if (Array.isArray(mappedVal)) {
          const cat = safeString(mappedVal[0] || matchedKey);
          return cat || rawVal;
        }
        const cat = safeString(mappedVal);
        return cat || rawVal;
      }
    }
  }

  return rawVal;
}

/**
 * Resolves the taxonomy normalization justification for an extracted entity.
 */
export function getUmbrellanizerJustification(
  val: any,
  fieldKey: string,
  paper?: any,
  umbrellanizerMap: Record<string, any> = {}
): string {
  const realKey = fieldKey.startsWith('ext:') ? fieldKey.substring(4) : fieldKey;
  const dict = umbrellanizerMap[fieldKey] || umbrellanizerMap[realKey] || umbrellanizerMap[`ext:${realKey}`];

  let rawVal = val;
  if (paper && (rawVal === undefined || rawVal === null || rawVal === '')) {
    const extStr = getStageDominantExtractedDataStr(paper);
    if (extStr) {
      try {
        const parsed = JSON.parse(extStr);
        const extObj = parsed.extracted_data || parsed;
        rawVal = extObj[realKey];
        if (rawVal && typeof rawVal === 'object' && 'value' in rawVal) {
          rawVal = (rawVal as any).value;
        }
      } catch (e) {}
    }
  }

  if (rawVal === undefined || rawVal === null || rawVal === '' || !dict) return '';

  const resolveSingle = (singleRaw: any): string => {
    const rNorm = normalizeForLookup(singleRaw);
    if (!rNorm) return '';

    if (Array.isArray(dict)) {
      const matched = dict.find((item: any) => normalizeForLookup(item.raw_token) === rNorm || normalizeForLookup(item.umbrella_category) === rNorm);
      return matched?.justification ? canonicalizeString(matched.justification) : '';
    }

    if (typeof dict === 'object' && dict !== null) {
      let matchedKey = Object.keys(dict).find(k => normalizeForLookup(k) === rNorm);
      if (!matchedKey) {
        matchedKey = Object.keys(dict).find(k => {
          const m = dict[k];
          if (m && typeof m === 'object' && !Array.isArray(m)) {
            return normalizeForLookup(m.umbrella_category) === rNorm;
          }
          return false;
        });
      }
      if (matchedKey) {
        const mapped = dict[matchedKey];
        if (mapped && typeof mapped === 'object' && !Array.isArray(mapped)) {
          return mapped.justification ? canonicalizeString(mapped.justification) : '';
        }
      }
    }
    return '';
  };

  if (Array.isArray(rawVal)) {
    return rawVal.map(resolveSingle).filter(Boolean).join(' || ');
  }
  return resolveSingle(rawVal);
}

/**
 * Resolves the stage-dominant extracted_data JSON string from a paper record.
 */
export function getStageDominantExtractedDataStr(paper: any): string {
  if (!paper) return '';
  const isNonEmpty = (str: any) => typeof str === 'string' && str.trim() !== '' && str.trim() !== '{}' && str.trim() !== '[]' && str.trim() !== 'null';
  const hasManual = isNonEmpty(paper.manual_extracted_data);
  const hasAi = isNonEmpty(paper.ai_extracted_data);

  if (hasManual && hasAi) {
    const ms = Number(paper.manual_stage || 0);
    const as = Number(paper.ai_stage || 0);
    return ms >= as ? paper.manual_extracted_data : paper.ai_extracted_data;
  }
  if (hasManual) return paper.manual_extracted_data;
  if (hasAi) return paper.ai_extracted_data;
  return '';
}

/**
 * Strips the parent group prefix (e.g. "Parent: Child" -> "Child") when the prefix matches the parent name.
 */
export function stripParentPrefix(val: string, parentName?: string): string {
  if (!parentName || !val) return val;
  const pNorm = canonicalizeString(parentName).toLowerCase();
  if (val.includes(':')) {
    const parts = val.split(':').map(s => s.trim());
    for (let i = 0; i < parts.length - 1; i++) {
      const candidatePrefix = parts.slice(0, i + 1).join(':').toLowerCase();
      const singlePart = parts[i].toLowerCase();
      if (candidatePrefix === pNorm || singlePart === pNorm) {
        const rest = parts.slice(i + 1).join(': ').trim();
        return rest || val;
      }
    }
  }
  return val;
}

/**
 * Extracts normalized, taxonomy-mapped field values for any paper record.
 */
export function extractPaperFieldValues(
  paper: any,
  fieldKey: string,
  options: TaxonomyOptions = {}
): string[] {
  const {
    useUmbrellanizer = true,
    umbrellanizerMap = {},
    splitMultiValues = true,
    excludeEmpty = true
  } = options;

  if (!paper) return excludeEmpty ? [] : ['Unspecified'];

  const isMacro = fieldKey.startsWith('ext:macro:') || fieldKey.startsWith('macro:ext:');
  const isSub = fieldKey.startsWith('ext:sub:') || fieldKey.startsWith('sub:ext:');
  const isLeafRaw = fieldKey.startsWith('raw:leaf:ext:') || fieldKey.startsWith('raw:tail:ext:');
  const isExplicitRaw = isLeafRaw || fieldKey.startsWith('raw:ext:') || fieldKey.startsWith('raw:');
  
  let realKey = '';
  if (isMacro) {
    realKey = fieldKey.startsWith('ext:macro:') ? fieldKey.substring(10) : fieldKey.substring(10);
  } else if (isSub) {
    realKey = fieldKey.startsWith('ext:sub:') ? fieldKey.substring(8) : fieldKey.substring(8);
  } else if (isLeafRaw) {
    realKey = fieldKey.startsWith('raw:leaf:ext:') ? fieldKey.substring(13) : fieldKey.substring(13);
  } else if (isExplicitRaw) {
    realKey = fieldKey.startsWith('raw:ext:') ? fieldKey.substring(8) : fieldKey.substring(4);
  } else if (fieldKey.startsWith('ext:')) {
    realKey = fieldKey.substring(4);
  }

  if (realKey) {
    const extStr = getStageDominantExtractedDataStr(paper);
    if (!extStr) return excludeEmpty ? [] : ['Unspecified'];

    try {
      const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
      const extObj = parsed.extracted_data || parsed;
      let rawVal = extObj[realKey];

      if (rawVal === undefined || rawVal === null || rawVal === '') {
        return excludeEmpty ? [] : ['Unspecified'];
      }

      if (typeof rawVal === 'object' && rawVal !== null && !Array.isArray(rawVal) && 'value' in rawVal) {
        rawVal = rawVal.value;
      }

      const tokens = normalizeExtractedTokens(rawVal, realKey);
      if (tokens.length === 0) {
        return excludeEmpty ? [] : ['Unspecified'];
      }

      const transformToken = (t: string): string => {
        if (isExplicitRaw) {
          if (isLeafRaw) {
            const lastColonIdx = t.lastIndexOf(':');
            return lastColonIdx !== -1 ? t.substring(lastColonIdx + 1).trim() : t;
          }
          return t;
        }
        const resolved = resolveUmbrellanizerValue(t, realKey, useUmbrellanizer, umbrellanizerMap);
        if (!resolved) return t;
        if (isMacro) {
          const colonIdx = resolved.indexOf(':');
          return colonIdx !== -1 ? resolved.substring(0, colonIdx).trim() : resolved;
        }
        if (isSub) {
          const parts = resolved.split(':').map(s => s.trim()).filter(Boolean);
          return parts.length >= 2 ? parts[1] : (parts[0] || resolved);
        }
        return resolved;
      };

      if (splitMultiValues) {
        const mappedList = tokens
          .map(transformToken)
          .filter(v => Boolean(v) && v !== '[object Object]');
        return mappedList.length > 0 ? mappedList : (excludeEmpty ? [] : ['Unspecified']);
      } else {
        const mappedJoined = tokens
          .map(transformToken)
          .filter(v => Boolean(v) && v !== '[object Object]')
          .join(', ');
        return mappedJoined ? [mappedJoined] : (excludeEmpty ? [] : ['Unspecified']);
      }
    } catch (e) {
      return excludeEmpty ? [] : ['Unspecified'];
    }
  } else if (fieldKey === 'Publisher') {
    const pub = safeString(paper.Publisher || paper.Original_Publisher || '');
    return pub ? [pub] : (excludeEmpty ? [] : ['Unspecified']);
  } else if (fieldKey === 'Overall_QA') {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const qaStr = isManualDominant 
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');
    if (!qaStr) return excludeEmpty ? [] : ['Unspecified'];
    try {
      const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
      const qaObj = parsed.qa_scores || parsed;
      let score = 0;
      Object.values(qaObj).forEach((v: any) => {
        const val = safeString(v);
        const num = parseFloat(val);
        if (!isNaN(num)) score += num;
        else if (['YES', 'PASS', 'TRUE'].includes(val.toUpperCase())) score += 1;
      });
      return [String(score)];
    } catch (e) {
      return [safeString(qaStr)];
    }
  } else {
    const strVal = safeString(paper[fieldKey]).trim();
    if (!strVal || strVal === '[object Object]') return excludeEmpty ? [] : ['Unspecified'];
    return [strVal];
  }
}
