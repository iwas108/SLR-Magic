import Papa from 'papaparse';

export function exportFinalCohortCsv(sessionData, filteredPapers = null) {
  const papers = filteredPapers || sessionData?.final_cohort?.papers || [];
  const project = sessionData?.project || {};
  const rawUmbMap = sessionData?.final_cohort?.umbrellanizer_mappings || {};

  // Standardize Umbrellanizer taxonomy map lookup
  const umbrellanizerMap = {};
  if (typeof rawUmbMap === 'object' && rawUmbMap !== null) {
    Object.entries(rawUmbMap).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        const map = {};
        v.forEach(item => {
          if (item && item.raw_token) {
            map[item.raw_token.trim().toLowerCase()] = item;
          }
        });
        umbrellanizerMap[k] = map;
      } else if (typeof v === 'object' && v !== null) {
        umbrellanizerMap[k] = v;
      }
    });
  }

  // Helper to resolve Umbrellanizer category value
  const resolveUmbrellanizerValue = (val, key) => {
    if (val === undefined || val === null || val === '') return '';
    const rawVal = String(val).trim();
    const raw = rawVal.toLowerCase().replace(/\s+/g, ' ');
    const map = umbrellanizerMap[key] || {};
    
    const matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === raw);
    if (!matchedKey) return rawVal;
    
    const mappedVal = map[matchedKey];
    if (!mappedVal) return rawVal;
    
    if (typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
      return String(mappedVal.umbrella_category || matchedKey).trim();
    }
    if (Array.isArray(mappedVal)) {
      return String(mappedVal[0] || matchedKey).trim();
    }
    return String(mappedVal).trim();
  };

  // Helper to resolve Umbrellanizer justification
  const getUmbrellanizerJustification = (rawVal, key) => {
    if (rawVal === undefined || rawVal === null || rawVal === '') return '';
    const map = umbrellanizerMap[key] || {};

    const resolveSingle = (singleRaw) => {
      const r = String(singleRaw).trim();
      const rNorm = r.toLowerCase().replace(/\s+/g, ' ');
      let matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === rNorm);
      
      if (!matchedKey) {
        matchedKey = Object.keys(map).find(k => {
          const mappedVal = map[k];
          if (mappedVal && typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
            return String(mappedVal.umbrella_category || '').trim().toLowerCase().replace(/\s+/g, ' ') === rNorm;
          }
          return false;
        });
      }

      if (matchedKey) {
        const mappedVal = map[matchedKey];
        if (mappedVal && typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
          return String(mappedVal.justification || '').trim();
        }
      }
      return '';
    };

    if (Array.isArray(rawVal)) {
      return rawVal.map(resolveSingle).filter(Boolean).join(' || ');
    }
    return resolveSingle(rawVal);
  };

  const qaKeysSet = new Set();
  const extKeysSet = new Set();

  const processedPapers = papers.map((paper) => {
    const manualStage = paper.manual_stage || 0;
    const aiStage = paper.ai_stage || 0;
    const isManualDominant = manualStage >= aiStage;

    // Parse QA Assessment
    const qaObjRaw = isManualDominant
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '')
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

    let qaTotalScore = 0;
    const qaItems = {};
    const qaTraces = {};

    if (qaObjRaw) {
      let parsed = qaObjRaw;
      if (typeof qaObjRaw === 'string') {
        try { parsed = JSON.parse(qaObjRaw); } catch (e) {}
      }

      if (typeof parsed === 'object' && parsed !== null) {
        const qaObj = parsed.qa_scores || parsed;
        const logicTrace = parsed.logic_trace || {};
        const appraisalReasoning = logicTrace.appraisal_reasoning || {};

        Object.entries(qaObj).forEach(([k, v]) => {
          if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace' || k === 'qa_scores') return;
          qaKeysSet.add(k);

          const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
          const valStr = String(val ?? '');
          qaItems[k] = valStr;

          const traceVal = appraisalReasoning[k + '_analysis'] || appraisalReasoning[k] || '';
          let evidenceVal = '';

          if (v && typeof v === 'object') {
            if (v.evidence) {
              evidenceVal = String(v.evidence);
            } else if (v.logic_trace?.evidence) {
              evidenceVal = String(v.logic_trace.evidence);
            }
          }

          qaTraces[k] = { mapping: String(traceVal || ''), evidence: evidenceVal };

          const numVal = parseFloat(valStr);
          if (!isNaN(numVal)) {
            qaTotalScore += numVal;
          } else if (['YES', 'PASS', 'TRUE'].includes(valStr.toUpperCase().trim())) {
            qaTotalScore += 1;
          }
        });
      } else {
        const num = parseFloat(qaObjRaw);
        if (!isNaN(num)) qaTotalScore = num;
      }
    }

    // Parse Extracted Data
    const extObjRaw = isManualDominant
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '')
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    const extItems = {};
    const extTraces = {};

    if (extObjRaw) {
      let parsed = extObjRaw;
      if (typeof extObjRaw === 'string') {
        try { parsed = JSON.parse(extObjRaw); } catch (e) {}
      }

      if (typeof parsed === 'object' && parsed !== null) {
        const extObj = parsed.extracted_data || parsed;
        const logicTrace = parsed.logic_trace || extObj.logic_trace || {};
        const locateMapping = logicTrace.extraction_mapping || logicTrace || {};

        Object.entries(extObj).forEach(([k, v]) => {
          if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace') return;
          extKeysSet.add(k);

          let origVal = v;
          if (v && typeof v === 'object' && 'value' in v) {
            origVal = v.value;
          }

          const origStr = Array.isArray(origVal) ? origVal.join('; ') : (origVal !== undefined && origVal !== null ? String(origVal) : '');
          
          let resolvedStr = '';
          if (Array.isArray(origVal)) {
            const mapped = Array.from(new Set(origVal.map(item => resolveUmbrellanizerValue(item, k)))).filter(Boolean);
            resolvedStr = mapped.join('; ');
          } else if (origVal !== undefined && origVal !== null && origVal !== '') {
            resolvedStr = resolveUmbrellanizerValue(origStr, k);
          }

          extItems[k] = resolvedStr;

          const mapping = locateMapping[`locate_${k}`] || locateMapping[k] || '';
          let evidence = '';
          if (v && typeof v === 'object') {
            if ('evidence' in v) {
              evidence = String(v.evidence || '');
            } else if ('logic_trace' in v && v.logic_trace) {
              evidence = String(v.logic_trace.evidence || '');
            }
          }

          const justification = getUmbrellanizerJustification(origVal, k);

          extTraces[k] = {
            original: origStr,
            mapping: String(mapping || ''),
            evidence,
            justification
          };
        });
      }
    }

    return {
      paper,
      qaTotalScore,
      qaItems,
      qaTraces,
      extItems,
      extTraces
    };
  });

  const sortedQaKeys = Array.from(qaKeysSet).sort();
  const sortedExtKeys = Array.from(extKeysSet).sort();

  // Dynamic CSV Headers
  const headers = [
    'Paper_ID',
    'Title',
    'Authors',
    'Year',
    'DOI',
    'Import_Source',
    'Local_PDF_Status',
    'PDF_Link',
    'Publisher',
    'Citation_Count',
    'Overall_QA'
  ];

  // Dynamic QA headers + tt_* columns
  sortedQaKeys.forEach(qaKey => {
    headers.push(qaKey);
    headers.push(`tt_mapping_${qaKey}`);
    headers.push(`tt_evidence_${qaKey}`);
  });

  // Dynamic Extracted headers + tt_* columns
  sortedExtKeys.forEach(extKey => {
    headers.push(extKey);
    headers.push(`tt_original_${extKey}`);
    headers.push(`tt_mapping_${extKey}`);
    headers.push(`tt_evidence_${extKey}`);
    headers.push(`tt_justification_${extKey}`);
  });

  headers.push('Abstract');

  // Build CSV Rows
  const rows = processedPapers.map(({ paper, qaTotalScore, qaItems, qaTraces, extItems, extTraces }) => {
    const publisherVal = paper.Publisher || paper.Original_Publisher || '';

    const row = [
      paper.Paper_ID || '',
      paper.Title || '',
      paper.Authors || '',
      paper.Year || '',
      paper.DOI || '',
      paper.Import_Source || '',
      paper.Local_PDF_Status || '',
      paper.PDF_Link || '',
      publisherVal,
      paper.citation_count ?? 0,
      qaTotalScore.toFixed(1)
    ];

    sortedQaKeys.forEach(qaKey => {
      const val = qaItems[qaKey] || '';
      const trace = qaTraces[qaKey] || { mapping: '', evidence: '' };
      row.push(val);
      row.push(trace.mapping);
      row.push(trace.evidence);
    });

    sortedExtKeys.forEach(extKey => {
      const val = extItems[extKey] || '';
      const trace = extTraces[extKey] || { original: '', mapping: '', evidence: '', justification: '' };
      row.push(val);
      row.push(trace.original);
      row.push(trace.mapping);
      row.push(trace.evidence);
      row.push(trace.justification);
    });

    row.push(paper.Abstract || '');
    return row;
  });

  const csvString = Papa.unparse({
    fields: headers,
    data: rows,
  });

  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const sanitizedProjectName = (project.name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${sanitizedProjectName}_cohort_${dateStr}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
