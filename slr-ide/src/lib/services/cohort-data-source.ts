/**
 * Centralized Cohort Data Source Service
 * Single authoritative source of truth for cohort variable discovery, universal data resolution,
 * and strict scientific data integrity validation across all SLR IDE charts, visualizer panels, and export engines.
 */

import {
  safeString,
  canonicalizeString,
  normalizeForLookup,
  resolveUmbrellanizerValue,
  normalizeExtractedTokens,
  getStageDominantExtractedDataStr,
  stripParentPrefix,
  TaxonomyOptions
} from './taxonomy-resolver';

export type VariableCategory = 'extracted' | 'taxonomy' | 'taxonomy_category' | 'qa' | 'metadata' | 'custom_group';
export type VariableDataType = 'categorical' | 'multi_label' | 'numeric' | 'boolean' | 'unknown';

export interface DiscoveredVariable {
  key: string;               // Exact lookup key, e.g. 'ext:macro:execution_latency' or 'Year'
  rawKey: string;            // Clean base key without prefixes, e.g. 'execution_latency'
  rqCode?: string;           // Extracted Research Question code, e.g. 'RQ1', 'RQ1A', 'RQ3B'
  displayName: string;       // Human-readable title, e.g. '[RQ1] Execution Latency [Level 1: Macro Domain]'
  category: VariableCategory;
  dataType: VariableDataType;
  taxonomyLevel?: 1 | 2 | 3;
  positivePaperCount: number;// Number of papers with non-empty, valid data
  totalCohortCount: number;  // Total cohort count N
  prevalencePct: number;     // (positivePaperCount / totalCohortCount) * 100
  sampleValues: string[];    // First 3-5 distinct sample values
}

export interface DiscoveredVariablesResult {
  variables: DiscoveredVariable[];
  variablesByKey: Map<string, DiscoveredVariable>;
  totalCohortCount: number;
  extractedKeys: string[];
}

export interface ResolveFieldOptions extends TaxonomyOptions {
  subFieldKey?: string;
  levelIdx?: number;
  parentName?: string;
  customCategoryMap?: Record<string, Record<string, string>>;
  levelCustomGroups?: Record<number, string[]>;
  levelCustomGroupLinks?: Record<number, Record<string, string>>;
  levelTargetFields?: Record<number, string>;
  scopeFilter?: string;
  unpackMacroToChildren?: boolean;
  sankeyFields?: string[];
  primaryField?: string;
  excludeUnassigned?: boolean;
}

export interface DataIntegrityReport {
  isValid: boolean;
  key: string;
  positivePaperCount: number;
  totalCohortCount: number;
  prevalencePct: number;
  hasZeroHits: boolean;
  suggestedKeys: Array<{ key: string; displayName: string; prevalencePct: number }>;
  warningMessage?: string;
}

export const CUSTOM_GROUPING_KEY = '__custom_grouping__';
export const CUSTOM_GROUPING_LABEL = '✨ Custom Grouping Layer';

const METADATA_FIELDS_CONFIG: Array<{ key: string; name: string; type: VariableDataType }> = [
  { key: 'Year', name: 'Publication Year', type: 'numeric' },
  { key: 'Publisher', name: 'Publisher / Journal', type: 'categorical' },
  { key: 'Authors', name: 'Authors', type: 'multi_label' },
  { key: 'Import_Source', name: 'Database Source (Scopus/IEEE/WoS)', type: 'categorical' },
  { key: 'Local_PDF_Status', name: 'Local PDF Availability Status', type: 'categorical' },
  { key: 'DOI', name: 'DOI Identifier', type: 'categorical' },
  { key: 'citation_count', name: 'Citation Count', type: 'numeric' },
  { key: 'Paper_ID', name: 'Paper ID', type: 'categorical' },
  { key: 'Title', name: 'Paper Title', type: 'categorical' },
  { key: 'Overall_QA', name: 'Overall Quality Appraisal Score', type: 'numeric' }
];

/**
 * Extracts RQ code (e.g. 'RQ1', 'RQ1A', 'RQ8B') from a variable key
 */
export function extractRqCode(key: string): string | undefined {
  const clean = key
    .replace(/^ext:(macro:|sub:|leaf:|tail:)?/, '')
    .replace(/^raw:(leaf:|tail:)?ext:/, '')
    .replace(/^ext:/, '');
  const match = clean.match(/^(rq\d+[a-z]?)[_:]?/i);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Format clean, title-cased display alias from raw variable keys, preserving [RQ] codes
 */
export function formatVariableDisplayName(key: string): string {
  if (key === CUSTOM_GROUPING_KEY) return CUSTOM_GROUPING_LABEL;

  let base = key;
  let suffix = '';

  if (base.startsWith('cat:')) {
    const rawContent = base.substring(4);
    let targetVar = '';
    let targetCat = '';
    
    if (rawContent.startsWith('ext:macro:') || rawContent.startsWith('ext:sub:') || rawContent.startsWith('ext:leaf:')) {
      const colonIdx = rawContent.indexOf(':', 10);
      if (colonIdx !== -1) {
        targetVar = rawContent.substring(0, colonIdx);
        targetCat = rawContent.substring(colonIdx + 1).trim();
      } else {
        targetCat = rawContent;
      }
    } else {
      const colonIdx = rawContent.indexOf(':');
      if (colonIdx !== -1) {
        targetVar = rawContent.substring(0, colonIdx);
        targetCat = rawContent.substring(colonIdx + 1).trim();
      } else {
        targetCat = rawContent.trim();
      }
    }
    const rq = extractRqCode(targetVar || targetCat);
    const rqPfx = rq ? `[${rq}] ` : '';
    return `${rqPfx}${targetCat} [Specific Category]`;
  }

  if (base.startsWith('ext:macro:')) {
    base = base.substring(10);
    suffix = ' [Level 1: Macro Domain]';
  } else if (base.startsWith('ext:sub:')) {
    base = base.substring(8);
    suffix = ' [Level 2: Sub-Category]';
  } else if (base.startsWith('ext:leaf:') || base.startsWith('ext:tail:')) {
    base = base.substring(9);
    suffix = ' [Level 3: Taxonomy Leaf / Tail]';
  } else if (base.startsWith('raw:leaf:ext:') || base.startsWith('raw:tail:ext:')) {
    base = base.substring(13);
    suffix = ' [Raw Leaf Token]';
  } else if (base.startsWith('raw:ext:')) {
    base = base.substring(8);
    suffix = ' [Raw Extracted Token]';
  } else if (base.startsWith('ext:')) {
    base = base.substring(4);
    suffix = ' [Full Taxonomy String]';
  } else if (base.startsWith('qa:')) {
    base = base.substring(3);
    suffix = ' [QA Appraisal Criterion]';
  }

  const rqMatch = base.match(/^(rq\d+[a-z]?)[_:]?/i);
  const rqPrefix = rqMatch ? `[${rqMatch[1].toUpperCase()}] ` : '';

  const cleanTitle = base
    .replace(/^rq\d+[a-z]?[_:]?/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();

  return `${rqPrefix}${cleanTitle || base}${suffix}`;
}

/**
 * Comprehensive introspection of all available variables across the cohort.
 * Resolves stage dominance (MAX(manual_stage, ai_stage)) and extracts metadata, QA, and taxonomy tokens.
 */
export function discoverCohortVariables(
  papers: any[],
  options: ResolveFieldOptions = {}
): DiscoveredVariablesResult {
  const totalCohortCount = papers ? papers.length : 0;
  const variables: DiscoveredVariable[] = [];
  const variablesByKey = new Map<string, DiscoveredVariable>();
  const extractedKeysSet = new Set<string>();
  const qaKeysSet = new Set<string>();

  if (!papers || papers.length === 0) {
    return { variables, variablesByKey, totalCohortCount: 0, extractedKeys: [] };
  }

  // 1. Scan papers for extracted keys and QA rules
  papers.forEach(p => {
    // Extracted Data Scan
    const extStr = getStageDominantExtractedDataStr(p);
    if (extStr) {
      try {
        const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
        const extObj = parsed.extracted_data || parsed;
        if (typeof extObj === 'object' && extObj !== null) {
          Object.keys(extObj).forEach(k => {
            if (!k.startsWith('_') && k !== 'logic_trace' && k !== '_scientist_logic_trace') {
              extractedKeysSet.add(k);
            }
          });
        }
      } catch (e) {}
    }

    // QA Data Scan
    const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
    const qaStr = isManualDominant
      ? (p.manual_quality_assessment || p.ai_quality_assessment || '')
      : (p.ai_quality_assessment || p.manual_quality_assessment || '');
    if (qaStr) {
      try {
        const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
        const qaObj = parsed.qa_scores || parsed;
        if (typeof qaObj === 'object' && qaObj !== null) {
          Object.keys(qaObj).forEach(k => {
            if (!k.startsWith('_') && k !== 'logic_trace') {
              qaKeysSet.add(k);
            }
          });
        }
      } catch (e) {}
    }
  });

  const extractedKeysList = Array.from(extractedKeysSet).sort();

  // Helper to register discovered variable with calculated stats
  const registerVar = (
    key: string,
    rawKey: string,
    category: VariableCategory,
    dataType: VariableDataType,
    taxonomyLevel?: 1 | 2 | 3
  ) => {
    if (variablesByKey.has(key)) return;

    let positivePaperCount = 0;
    const samplesSet = new Set<string>();

    papers.forEach(p => {
      const vals = resolveCohortFieldValue(p, key, options);
      const validVals = vals.filter(v => {
        const s = String(v || '').trim().toUpperCase();
        return Boolean(s) && s !== 'NOT_STATED' && s !== 'FALSE' && s !== '0' && s !== 'NONE' && s !== 'UNSPECIFIED' && s !== '[OBJECT OBJECT]';
      });

      if (validVals.length > 0) {
        positivePaperCount++;
        validVals.forEach(v => {
          if (samplesSet.size < 5 && v && v !== 'Unspecified') {
            samplesSet.add(v);
          }
        });
      }
    });

    const prevalencePct = totalCohortCount > 0 ? Math.round((positivePaperCount / totalCohortCount) * 100) : 0;
    const displayName = formatVariableDisplayName(key);
    const rqCode = extractRqCode(rawKey);

    const discovered: DiscoveredVariable = {
      key,
      rawKey,
      rqCode,
      displayName,
      category,
      dataType,
      taxonomyLevel,
      positivePaperCount,
      totalCohortCount,
      prevalencePct,
      sampleValues: Array.from(samplesSet)
    };

    variables.push(discovered);
    variablesByKey.set(key, discovered);
    // Also index under rawKey if not conflicting
    if (!variablesByKey.has(rawKey)) {
      variablesByKey.set(rawKey, discovered);
    }
  };

  // 2. Register Custom Grouping
  registerVar(CUSTOM_GROUPING_KEY, CUSTOM_GROUPING_KEY, 'custom_group', 'categorical');

  // 3. Register Extracted Variables (3-Tier Taxonomy + Full + Raw)
  extractedKeysList.forEach(rawK => {
    // 3-Tier Taxonomy
    registerVar(`ext:macro:${rawK}`, rawK, 'taxonomy', 'categorical', 1);
    registerVar(`ext:sub:${rawK}`, rawK, 'taxonomy', 'categorical', 2);
    registerVar(`ext:leaf:${rawK}`, rawK, 'taxonomy', 'categorical', 3);
    // Full Taxonomy String & Raw Tokens
    registerVar(`ext:${rawK}`, rawK, 'extracted', 'multi_label');
    registerVar(`raw:ext:${rawK}`, rawK, 'extracted', 'multi_label');
    registerVar(`raw:leaf:ext:${rawK}`, rawK, 'extracted', 'categorical');

    // Register Specific Category Dimensions (Macro & Sub Categories)
    ['ext:macro:', 'ext:sub:'].forEach((pfx, pfxIdx) => {
      const parentVarKey = `${pfx}${rawK}`;
      const catCountMap = new Map<string, number>();

      papers.forEach(p => {
        const vals = resolveCohortFieldValue(p, parentVarKey, options);
        const uniqueCatsForPaper = new Set<string>();
        vals.forEach(v => {
          const s = String(v || '').trim();
          const sUpper = s.toUpperCase();
          if (s && sUpper !== 'NOT_STATED' && sUpper !== 'NONE' && sUpper !== 'UNSPECIFIED' && sUpper !== '[OBJECT OBJECT]' && s !== 'Unspecified') {
            uniqueCatsForPaper.add(s);
          }
        });
        uniqueCatsForPaper.forEach(catName => {
          catCountMap.set(catName, (catCountMap.get(catName) || 0) + 1);
        });
      });

      catCountMap.forEach((count, catName) => {
        const catKey = `cat:${parentVarKey}:${catName}`;
        if (variablesByKey.has(catKey)) return;
        const prevPct = totalCohortCount > 0 ? Math.round((count / totalCohortCount) * 100) : 0;
        const rq = extractRqCode(rawK);
        const rqPfx = rq ? `[${rq}] ` : '';
        const levelTag = pfxIdx === 0 ? 'Macro' : 'Sub';

        const catVar: DiscoveredVariable = {
          key: catKey,
          rawKey: `${rawK}:${catName}`,
          rqCode: rq,
          displayName: `${rqPfx}${catName} [${levelTag} Category]`,
          category: 'taxonomy_category',
          dataType: 'boolean',
          positivePaperCount: count,
          totalCohortCount,
          prevalencePct: prevPct,
          sampleValues: [catName]
        };
        variables.push(catVar);
        variablesByKey.set(catKey, catVar);
        if (!variablesByKey.has(`cat:${catName}`)) {
          variablesByKey.set(`cat:${catName}`, catVar);
        }
      });
    });
  });

  // 4. Register QA Appraisal Criteria
  qaKeysSet.forEach(qaK => {
    registerVar(`qa:${qaK}`, qaK, 'qa', 'numeric');
    if (!variablesByKey.has(qaK)) {
      registerVar(qaK, qaK, 'qa', 'numeric');
    }
  });

  // 5. Register Standard Metadata Fields
  METADATA_FIELDS_CONFIG.forEach(meta => {
    registerVar(meta.key, meta.key, meta.key === 'Overall_QA' ? 'qa' : 'metadata', meta.type);
  });

  return {
    variables,
    variablesByKey,
    totalCohortCount,
    extractedKeys: extractedKeysList
  };
}

/**
 * Universal Zero-Failure Field Value Resolver.
 * Resolves exact prefixes, top-level metadata, stage-dominant extracted JSON, QA scores, and custom groups.
 */
export function resolveCohortFieldValue(
  paper: any,
  fieldKey: string,
  options: ResolveFieldOptions = {}
): string[] {
  const {
    subFieldKey,
    levelIdx = 0,
    parentName,
    useUmbrellanizer = true,
    umbrellanizerMap = {},
    splitMultiValues = true,
    excludeEmpty = true,
    customCategoryMap = {},
    levelCustomGroupLinks = {},
    sankeyFields = ['Year', 'Import_Source', 'Local_PDF_Status'],
    primaryField = 'Year'
  } = options;

  if (!paper || !fieldKey) return excludeEmpty ? [] : ['Unspecified'];

  const extractOpts = { useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty };
  // 1. Custom Grouping Layer
  if (fieldKey === CUSTOM_GROUPING_KEY) {
    const configuredTarget = options.levelTargetFields?.[levelIdx];
    const targetSubKey = subFieldKey || configuredTarget || options.levelTargetFields?.[0] || (sankeyFields.find((f, idx) => f !== CUSTOM_GROUPING_KEY && idx >= levelIdx) || sankeyFields.find(f => f !== CUSTOM_GROUPING_KEY) || (levelIdx === 0 ? 'Year' : primaryField));
    const safeTarget = targetSubKey === CUSTOM_GROUPING_KEY ? 'Year' : targetSubKey;
    const subVals = resolveCohortFieldValue(paper, safeTarget, extractOpts).map(safeString).filter(v => Boolean(v) && v !== '[object Object]' && v !== 'Unspecified');
    if (subVals.length === 0) return excludeEmpty ? [] : ['Unassigned / Other'];
    
    const linksMap = levelCustomGroupLinks[levelIdx] ?? (levelIdx === 0 ? levelCustomGroupLinks[0] : {}) ?? {};
    const normLinksMap = new Map<string, string>();
    Object.entries(linksMap).forEach(([k, g]) => {
      normLinksMap.set(k, g);
      normLinksMap.set(normalizeForLookup(k), g);
    });

    const mapped = subVals.map(v => {
      // 1. Direct key match
      if (linksMap[v]) return safeString(linksMap[v]).replace(/\\n/g, '\n');
      // 2. Normalized key match
      const normVal = normalizeForLookup(v);
      if (normLinksMap.has(normVal)) return safeString(normLinksMap.get(normVal)!).replace(/\\n/g, '\n');
      // 3. Colon prefix-stripped match (e.g. "Physical/Link: Wi-Fi & WLAN" vs "Wi-Fi & WLAN")
      const colonIdx = v.lastIndexOf(':');
      if (colonIdx !== -1) {
        const leaf = v.substring(colonIdx + 1).trim();
        if (linksMap[leaf]) return safeString(linksMap[leaf]).replace(/\\n/g, '\n');
        const normLeaf = normalizeForLookup(leaf);
        if (normLinksMap.has(normLeaf)) return safeString(normLinksMap.get(normLeaf)!).replace(/\\n/g, '\n');
      }
      return 'Unassigned / Other';
    });

    const uniqueMapped = Array.from(new Set(mapped));
    if (excludeEmpty || options.excludeUnassigned) {
      return uniqueMapped.filter(m => m !== 'Unassigned / Other' && m !== 'Unassigned');
    }
    return uniqueMapped;
  }

  // 1.5. Specific Taxonomy Category Filter (e.g. 'cat:ext:macro:rq3b_execution_footprint:Memory & Storage Metrics' or 'cat:Memory & Storage Metrics')
  if (fieldKey.startsWith('cat:')) {
    const rawContent = fieldKey.substring(4);
    let targetVar = '';
    let targetCat = '';

    if (rawContent.startsWith('ext:macro:') || rawContent.startsWith('ext:sub:') || rawContent.startsWith('ext:leaf:')) {
      const colonIdx = rawContent.indexOf(':', 10);
      if (colonIdx !== -1) {
        targetVar = rawContent.substring(0, colonIdx);
        targetCat = rawContent.substring(colonIdx + 1).trim();
      } else {
        targetCat = rawContent;
      }
    } else {
      const colonIdx = rawContent.indexOf(':');
      if (colonIdx !== -1) {
        targetVar = rawContent.substring(0, colonIdx);
        targetCat = rawContent.substring(colonIdx + 1).trim();
      } else {
        targetCat = rawContent.trim();
      }
    }

    if (targetVar) {
      if (options.unpackMacroToChildren && targetVar.startsWith('ext:macro:')) {
        const subVarKey = 'ext:sub:' + targetVar.substring(10);
        const childVals = resolveCohortFieldValue(paper, subVarKey, {
          ...extractOpts,
          scopeFilter: targetCat,
          unpackMacroToChildren: false
        });
        if (childVals.length > 0) return childVals;
      }
      const parentVals = resolveCohortFieldValue(paper, targetVar, extractOpts);
      const normCat = normalizeForLookup(targetCat);
      const isPresent = parentVals.some(v => normalizeForLookup(v) === normCat);
      return isPresent ? [targetCat] : (excludeEmpty ? [] : ['Absent']);
    } else {
      const extStr = getStageDominantExtractedDataStr(paper);
      if (extStr) {
        try {
          const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
          const extObj = parsed.extracted_data || parsed;
          const normCat = normalizeForLookup(targetCat);
          for (const k of Object.keys(extObj)) {
            const vals = resolveCohortFieldValue(paper, `ext:macro:${k}`, extractOpts);
            if (vals.some(val => normalizeForLookup(val) === normCat)) {
              return [targetCat];
            }
          }
        } catch (e) {}
      }
      return excludeEmpty ? [] : ['Absent'];
    }
  }

  // 2. Parse Prefix Conventions
  const isMacro = fieldKey.startsWith('ext:macro:') || fieldKey.startsWith('macro:ext:');
  const isSub = fieldKey.startsWith('ext:sub:') || fieldKey.startsWith('sub:ext:');
  const isLeafTaxonomy = fieldKey.startsWith('ext:leaf:') || fieldKey.startsWith('leaf:ext:') || fieldKey.startsWith('ext:tail:') || fieldKey.startsWith('tail:ext:');
  const isLeafRaw = fieldKey.startsWith('raw:leaf:ext:') || fieldKey.startsWith('raw:tail:ext:');
  const isExplicitRaw = isLeafRaw || fieldKey.startsWith('raw:ext:') || fieldKey.startsWith('raw:');
  const isQaPrefix = fieldKey.startsWith('qa:');

  let realKey = '';
  if (isMacro) {
    realKey = fieldKey.startsWith('ext:macro:') ? fieldKey.substring(10) : fieldKey.substring(10);
  } else if (isSub) {
    realKey = fieldKey.startsWith('ext:sub:') ? fieldKey.substring(8) : fieldKey.substring(8);
  } else if (isLeafTaxonomy) {
    realKey = (fieldKey.startsWith('ext:leaf:') || fieldKey.startsWith('ext:tail:')) ? fieldKey.substring(9) : fieldKey.substring(9);
  } else if (isLeafRaw) {
    realKey = fieldKey.startsWith('raw:leaf:ext:') ? fieldKey.substring(13) : fieldKey.substring(13);
  } else if (isExplicitRaw) {
    realKey = fieldKey.startsWith('raw:ext:') ? fieldKey.substring(8) : fieldKey.substring(4);
  } else if (isQaPrefix) {
    realKey = fieldKey.substring(3);
  } else if (fieldKey.startsWith('ext:')) {
    realKey = fieldKey.substring(4);
  }

  // 3. QA Criteria Extraction (either 'qa:...' or specific QA keys like 'Overall_QA', 'QA1')
  if (isQaPrefix || fieldKey.toLowerCase().startsWith('qa') || fieldKey === 'Overall_QA') {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const qaStr = isManualDominant 
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

    if (fieldKey === 'Overall_QA') {
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
    }

    // Specific QA Criterion Lookup (e.g. 'QA1' or 'qa1_study_design')
    const targetQaKey = realKey || fieldKey;
    if (qaStr) {
      try {
        const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
        const qaObj = parsed.qa_scores || parsed;
        if (typeof qaObj === 'object' && qaObj !== null) {
          // Direct or normalized lookup
          let val = qaObj[targetQaKey];
          if (val === undefined) {
            const normTarget = normalizeForLookup(targetQaKey);
            const foundKey = Object.keys(qaObj).find(k => normalizeForLookup(k) === normTarget);
            if (foundKey) val = qaObj[foundKey];
          }
          if (val !== undefined && val !== null && val !== '') {
            return [safeString(val)];
          }
        }
      } catch (e) {}
    }
  }

  // 4. Extracted Data Layer (Explicit prefix OR Dynamic Fallback)
  const extStr = getStageDominantExtractedDataStr(paper);
  if (extStr) {
    try {
      const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
      const extObj = parsed.extracted_data || parsed;

      if (typeof extObj === 'object' && extObj !== null) {
        // Resolve target key
        let targetKey = realKey;
        let rawVal = targetKey ? extObj[targetKey] : undefined;

        // If not found or realKey not set, try matching fieldKey directly against extObj
        if (rawVal === undefined) {
          const candidateKeys = [fieldKey, fieldKey.replace(/^ext:/, ''), fieldKey.replace(/ /g, '_'), fieldKey.replace(/_/g, ' ')];
          for (const cand of candidateKeys) {
            if (extObj[cand] !== undefined) {
              targetKey = cand;
              rawVal = extObj[cand];
              break;
            }
          }

          // Case-insensitive & normalized search if still undefined
          if (rawVal === undefined) {
            const normField = normalizeForLookup(fieldKey.replace(/^ext:/, ''));
            const matchedKey = Object.keys(extObj).find(k => normalizeForLookup(k) === normField);
            if (matchedKey) {
              targetKey = matchedKey;
              rawVal = extObj[matchedKey];
            }
          }
        }

        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
          if (typeof rawVal === 'object' && !Array.isArray(rawVal) && 'value' in rawVal) {
            rawVal = (rawVal as any).value;
          }

          const tokens = normalizeExtractedTokens(rawVal, targetKey || fieldKey);
          if (tokens.length > 0) {
            let activeTokens = tokens;
            if (options.scopeFilter) {
              const normScope = normalizeForLookup(options.scopeFilter);
              activeTokens = tokens.filter(t => {
                const resolved = resolveUmbrellanizerValue(t, targetKey || fieldKey, useUmbrellanizer, umbrellanizerMap);
                if (!resolved) return false;
                const colonIdx = resolved.indexOf(':');
                const macroPfx = colonIdx !== -1 ? resolved.substring(0, colonIdx).trim() : resolved;
                return normalizeForLookup(macroPfx) === normScope || normalizeForLookup(resolved).startsWith(normScope);
              });
            }

            const transformToken = (t: string): string => {
              if (isExplicitRaw) {
                if (isLeafRaw) {
                  const lastColonIdx = t.lastIndexOf(':');
                  return lastColonIdx !== -1 ? t.substring(lastColonIdx + 1).trim() : t;
                }
                return t;
              }
              const resolved = resolveUmbrellanizerValue(t, targetKey || fieldKey, useUmbrellanizer, umbrellanizerMap);
              if (!resolved) return t;
              if (isMacro) {
                const colonIdx = resolved.indexOf(':');
                return colonIdx !== -1 ? resolved.substring(0, colonIdx).trim() : resolved;
              }
              if (isSub) {
                const parts = resolved.split(':').map(s => s.trim()).filter(Boolean);
                return parts.length >= 2 ? parts[1] : (parts[0] || resolved);
              }
              if (isLeafTaxonomy) {
                const parts = resolved.split(':').map(s => s.trim()).filter(Boolean);
                return parts.length >= 3 ? parts[2] : (parts[parts.length - 1] || resolved);
              }
              return resolved;
            };

            let mappedList = activeTokens.map(transformToken).filter(v => Boolean(v) && v !== '[object Object]');
            
            // Apply custom category mapping if configured
            const mapObj = customCategoryMap[fieldKey] || customCategoryMap[targetKey];
            if (mapObj && Object.keys(mapObj).length > 0) {
              mappedList = mappedList.map(v => safeString(mapObj[v] || v));
            }

            if (parentName) {
              mappedList = mappedList.map(v => stripParentPrefix(v, parentName));
            }

            if (splitMultiValues) {
              return mappedList.length > 0 ? mappedList : (excludeEmpty ? [] : ['Unspecified']);
            } else {
              const joined = mappedList.join(', ');
              return joined ? [joined] : (excludeEmpty ? [] : ['Unspecified']);
            }
          }
        }
      }
    } catch (e) {}
  }

  // 5. Bibliographic Metadata Fallback
  if (fieldKey === 'Publisher') {
    const pub = safeString(paper.Publisher || paper.Original_Publisher || '');
    return pub ? [pub] : (excludeEmpty ? [] : ['Unspecified']);
  }

  const directProp = paper[fieldKey] ?? paper[fieldKey.toLowerCase()] ?? paper[fieldKey.toUpperCase()];
  if (directProp !== undefined && directProp !== null && directProp !== '') {
    const strVal = safeString(directProp).trim();
    if (!strVal || strVal === '[object Object]') return excludeEmpty ? [] : ['Unspecified'];
    return [strVal];
  }

  return excludeEmpty ? [] : ['Unspecified'];
}

/**
 * Scientific Data Integrity & Typo Validator.
 * Audits variable keys against the active cohort to detect 0-hit false negatives and generate smart corrections.
 */
export function validateCohortDataIntegrity(
  papers: any[],
  variableKeys: string[],
  options: TaxonomyOptions = {}
): Map<string, DataIntegrityReport> {
  const reports = new Map<string, DataIntegrityReport>();
  const totalCohortCount = papers ? papers.length : 0;
  const discovered = discoverCohortVariables(papers, options);

  variableKeys.forEach(k => {
    let positivePaperCount = 0;
    papers.forEach(p => {
      const vals = resolveCohortFieldValue(p, k, options);
      const valid = vals.some(v => {
        const s = String(v || '').trim().toUpperCase();
        return Boolean(s) && s !== 'NOT_STATED' && s !== 'FALSE' && s !== '0' && s !== 'NONE' && s !== 'UNSPECIFIED' && s !== '[OBJECT OBJECT]';
      });
      if (valid) positivePaperCount++;
    });

    const prevalencePct = totalCohortCount > 0 ? Math.round((positivePaperCount / totalCohortCount) * 100) : 0;
    const hasZeroHits = positivePaperCount === 0 && totalCohortCount > 0;

    const suggestedKeys: Array<{ key: string; displayName: string; prevalencePct: number }> = [];
    let warningMessage: string | undefined;

    if (hasZeroHits) {
      const normInput = normalizeForLookup(k.replace(/^ext:(macro:|sub:|leaf:|tail:)?/, '').replace(/^raw:(leaf:|tail:)?ext:/, ''));
      
      // Search for near-miss candidates in discovered variables
      discovered.variables.forEach(d => {
        if (d.positivePaperCount > 0) {
          const normCandidate = normalizeForLookup(d.rawKey);
          if (normCandidate.includes(normInput) || normInput.includes(normCandidate)) {
            suggestedKeys.push({
              key: d.key,
              displayName: d.displayName,
              prevalencePct: d.prevalencePct
            });
          }
        }
      });

      suggestedKeys.sort((a, b) => b.prevalencePct - a.prevalencePct);

      if (suggestedKeys.length > 0) {
        warningMessage = `Found in 0 papers. Did you mean: "${suggestedKeys[0].displayName}" (${suggestedKeys[0].prevalencePct}%)?`;
      } else {
        warningMessage = `Found in 0 papers in active cohort (N=${totalCohortCount}).`;
      }
    }

    reports.set(k, {
      isValid: !hasZeroHits,
      key: k,
      positivePaperCount,
      totalCohortCount,
      prevalencePct,
      hasZeroHits,
      suggestedKeys,
      warningMessage
    });
  });

  return reports;
}
