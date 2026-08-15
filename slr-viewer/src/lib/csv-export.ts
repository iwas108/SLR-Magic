import Papa from 'papaparse';
import { resolveUmbrellanizerValue, getUmbrellanizerJustification } from './services/taxonomy-resolver';
import { extractMappingReasoning, extractEvidenceQuote } from './services/trace-normalizer';

export function exportFinalCohortCsv(sessionData: any, filteredPapers: any[] | null = null) {
  const papers = filteredPapers || sessionData?.final_cohort?.papers || [];
  const project = sessionData?.project || {};
  const rawUmbMap = sessionData?.final_cohort?.umbrellanizer_mappings || {};

  const qaKeysSet = new Set<string>();
  const extKeysSet = new Set<string>();

  const processedPapers = papers.map((paper: any) => {
    const manualStage = paper.manual_stage || 0;
    const aiStage = paper.ai_stage || 0;
    const isManualDominant = manualStage >= aiStage;

    // Parse QA Assessment
    const qaObjRaw = isManualDominant
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '')
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

    let qaTotalScore = 0;
    const qaItems: Record<string, string> = {};
    const qaTraces: Record<string, { mapping: string; evidence: string }> = {};

    if (qaObjRaw) {
      try {
        const parsed = typeof qaObjRaw === 'string' ? JSON.parse(qaObjRaw) : qaObjRaw;
        if (typeof parsed === 'object' && parsed !== null) {
          const qaObj = parsed.qa_scores || parsed;
          const logicTrace = parsed.logic_trace || parsed.logicTrace || paper.logic_trace || {};
          const appraisalReasoning = logicTrace.appraisal_reasoning || logicTrace.appraisalReasoning || parsed._scientist_logic_trace || logicTrace || {};

          Object.entries(qaObj).forEach(([k, v]: [string, any]) => {
            if (k.startsWith('_') || k === 'logic_trace' || k === 'logicTrace' || k === '_scientist_logic_trace' || k === 'qa_scores') return;
            qaKeysSet.add(k);

            let rawVal = v;
            let valStr = '';
            let evidenceVal = '';

            if (v !== null && v !== undefined) {
              if (typeof v === 'object') {
                if ('score' in v && v.score !== undefined && v.score !== null) {
                  rawVal = v.score;
                } else if ('value' in v && v.value !== undefined && v.value !== null) {
                  rawVal = v.value;
                } else if ('val' in v && v.val !== undefined && v.val !== null) {
                  rawVal = v.val;
                } else if ('numeric_score' in v && v.numeric_score !== undefined && v.numeric_score !== null) {
                  rawVal = v.numeric_score;
                } else {
                  const entries = Object.entries(v);
                  const nonTextMatch = entries.find(([key, val]) => {
                    const kLower = key.toLowerCase();
                    const isMeta = ['exact_quote', 'quote', 'evidence', 'text', 'snippet', 'reasoning', 'justification', 'analysis', 'rationale', 'explanation', 'logic_trace'].includes(kLower);
                    return !isMeta && (typeof val === 'number' || typeof val === 'boolean' || (typeof val === 'string' && val.length < 50));
                  });
                  rawVal = nonTextMatch ? nonTextMatch[1] : '';
                }

                if (typeof rawVal === 'object' && rawVal !== null) {
                  if ('score' in rawVal) rawVal = rawVal.score;
                  else if ('value' in rawVal) rawVal = rawVal.value;
                  else rawVal = '';
                }

                evidenceVal = extractEvidenceQuote(k, v);
              }
            }

            valStr = (rawVal !== undefined && rawVal !== null) ? String(rawVal) : '';
            qaItems[k] = valStr;

            const traceVal = extractMappingReasoning(k, appraisalReasoning, v) || appraisalReasoning[k + '_analysis'] || appraisalReasoning[k] || '';
            qaTraces[k] = { mapping: String(traceVal || ''), evidence: evidenceVal };

            const numVal = parseFloat(valStr);
            if (!isNaN(numVal)) {
              qaTotalScore += numVal;
            } else if (
              rawVal === true ||
              ['YES', 'PASS', 'TRUE'].includes(valStr.toUpperCase().trim())
            ) {
              qaTotalScore += 1;
            }
          });
        }
      } catch (e) {
        const num = parseFloat(qaObjRaw);
        if (!isNaN(num)) qaTotalScore = num;
      }
    }

    // Parse Extracted Data
    const extObjRaw = isManualDominant
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '')
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    const extOriginalItems: Record<string, string> = {};
    const extMappedItems: Record<string, string> = {};
    const extJustifications: Record<string, string> = {};
    const extTraces: Record<string, { mapping: string; evidence: string }> = {};

    if (extObjRaw) {
      try {
        const parsed = typeof extObjRaw === 'string' ? JSON.parse(extObjRaw) : extObjRaw;
        if (typeof parsed === 'object' && parsed !== null) {
          const extObj = parsed.extracted_data || parsed;
          const logicTrace = parsed.logic_trace || extObj.logic_trace || parsed.logicTrace || extObj.logicTrace || paper.logic_trace || {};
          const locateMapping = logicTrace.extraction_mapping || logicTrace.extractionMapping || logicTrace.appraisal_reasoning || logicTrace || {};

          Object.entries(extObj).forEach(([k, v]: [string, any]) => {
            if (k.startsWith('_') || k === 'logic_trace' || k === 'logicTrace' || k === '_scientist_logic_trace') return;
            extKeysSet.add(k);

            let val = v;
            if (v && typeof v === 'object' && 'value' in v) {
              val = v.value;
            }

            const rawTokens: string[] = [];
            if (Array.isArray(val)) {
              val.forEach(item => {
                if (typeof item === 'string' && item.includes(',') && !k.startsWith('rq8_a')) {
                  item.split(',').forEach(t => t.trim() && rawTokens.push(t.trim()));
                } else if (item !== undefined && item !== null && item !== '') {
                  rawTokens.push(String(item).trim());
                }
              });
            } else if (typeof val === 'string') {
              if (val.includes(',') && !k.startsWith('rq8_a')) {
                val.split(',').forEach(t => t.trim() && rawTokens.push(t.trim()));
              } else if (val.trim()) {
                rawTokens.push(val.trim());
              }
            } else if (val !== undefined && val !== null && val !== '') {
              rawTokens.push(String(val).trim());
            }

            extOriginalItems[k] = rawTokens.join(', ');

            if (rawTokens.length === 0) {
              extMappedItems[k] = '';
              extJustifications[k] = '';
            } else {
              const mapped = rawTokens.map(t => resolveUmbrellanizerValue(t, k, true, rawUmbMap)).filter(Boolean);
              extMappedItems[k] = mapped.join(', ');
              extJustifications[k] = getUmbrellanizerJustification(mapped, k, paper, rawUmbMap);
            }

            const mapVal = extractMappingReasoning(k, locateMapping, v);
            const evVal = extractEvidenceQuote(k, v);
            extTraces[k] = { mapping: String(mapVal || ''), evidence: evVal };
          });
        }
      } catch (e) {}
    }

    return {
      paper,
      qaTotalScore,
      qaItems,
      qaTraces,
      extOriginalItems,
      extMappedItems,
      extJustifications,
      extTraces
    };
  });

  const sortedQaKeys = Array.from(qaKeysSet).sort();
  const sortedExtKeys = Array.from(extKeysSet).sort();

  // Construct standard CSV Row Headers
  const csvRows = processedPapers.map(({ paper, qaTotalScore, qaItems, qaTraces, extOriginalItems, extMappedItems, extJustifications, extTraces }) => {
    const row: Record<string, any> = {
      'Paper_ID': paper.Paper_ID || '',
      'Title': paper.Title || '',
      'Authors': paper.Authors || '',
      'Year': paper.Year || '',
      'DOI': paper.DOI || '',
      'Publisher': paper.Publisher || paper.Original_Publisher || '',
      'Citation_Count': paper.citation_count ?? '',
      'Source': paper.Source || '',
      'Import_Source': paper.Import_Source || '',
      'Local_PDF_Status': paper.Local_PDF_Status || '',
      'PDF_Link': paper.PDF_Link || '',
      'Overall_QA_Score': qaTotalScore,
    };

    sortedQaKeys.forEach(qaKey => {
      row[`QA_${qaKey}_Score`] = qaItems[qaKey] || '';
      row[`QA_${qaKey}_Evidence`] = qaTraces[qaKey]?.evidence || '';
      row[`QA_${qaKey}_Analysis`] = qaTraces[qaKey]?.mapping || '';
    });

    sortedExtKeys.forEach(extKey => {
      row[`EXT_${extKey}_Raw`] = extOriginalItems[extKey] || '';
      row[`EXT_${extKey}_Taxonomy_Mapping`] = extMappedItems[extKey] || '';
      row[`EXT_${extKey}_Taxonomy_Justification`] = extJustifications[extKey] || '';
      row[`EXT_${extKey}_Evidence`] = extTraces[extKey]?.evidence || '';
      row[`EXT_${extKey}_Analysis`] = extTraces[extKey]?.mapping || '';
    });

    return row;
  });

  const csvString = Papa.unparse(csvRows);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeProjectName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `${safeProjectName}_final_cohort_fair_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
