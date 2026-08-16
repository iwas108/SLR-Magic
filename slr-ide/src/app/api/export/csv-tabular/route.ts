import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { extractMappingReasoning, extractEvidenceQuote } from '@/lib/services/trace-normalizer';
import {
  resolveUmbrellanizerValue,
  getUmbrellanizerJustification
} from '@/lib/services/taxonomy-resolver';

function escapeCsvCell(cell: any): string {
  if (cell === null || cell === undefined) return '';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 1. Fetch Project Metadata
    let project = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as any;

    if (!project) {
      const numericProjectId = parseInt(projectId, 10);
      if (!isNaN(numericProjectId)) {
        project = db
          .prepare('SELECT * FROM projects WHERE id = ?')
          .get(numericProjectId) as any;
      }
    }

    if (!project) {
      project = db.prepare('SELECT * FROM projects ORDER BY id ASC LIMIT 1').get() as any;
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const resolvedProjectId = project.id;

    // 2. Fetch Umbrellanizer taxonomy mappings
    const umbrellanizerMap: Record<string, Record<string, any>> = {};
    try {
      const rows = db
        .prepare('SELECT field_name, taxonomy_mapping, extracted_data_key, umbrella_mapping FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))')
        .all(resolvedProjectId, resolvedProjectId) as any[];

      rows.forEach((r) => {
        try {
          const key = r.field_name || r.extracted_data_key;
          const mappingStr = r.taxonomy_mapping || r.umbrella_mapping;
          if (!key || !mappingStr) return;
          const mapping = JSON.parse(mappingStr);
          if (Array.isArray(mapping)) {
            const map: Record<string, any> = {};
            mapping.forEach((item: any) => {
              if (item.raw_token) {
                map[item.raw_token.trim().toLowerCase()] = item;
              }
            });
            umbrellanizerMap[key] = map;
          } else if (typeof mapping === 'object' && mapping !== null) {
            umbrellanizerMap[key] = mapping;
          }
        } catch (e) {}
      });
    } catch (e) {
      console.error('Failed to load umbrellanizer results:', e);
    }

    // Helper to resolve Umbrellanizer category value
    const resolveUmbrellanizerValueFn = (val: any, key: string) => resolveUmbrellanizerValue(val, key, true, umbrellanizerMap);

    // Helper to resolve Umbrellanizer justification
    const getUmbrellanizerJustificationFn = (rawVal: any, key: string) => getUmbrellanizerJustification(rawVal, key, undefined, umbrellanizerMap);

    // 3. Fetch Final Cohort Papers (Stage 4 INCLUDE)
    let papers: any[] = [];
    try {
      papers = db
        .prepare(
          `SELECT p.*
           FROM papers p
           WHERE (p.Project_ID = ? OR CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT))
             AND (MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) >= 4 OR p.ai_extracted_data IS NOT NULL OR p.manual_extracted_data IS NOT NULL)
             AND CASE 
                 WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
                 WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
                 ELSE COALESCE(p.manual_decision, p.ai_decision)
             END LIKE 'INCLUDE%'
           ORDER BY p.Year DESC, p.Title ASC`
        )
        .all(resolvedProjectId, resolvedProjectId) as any[];
    } catch (e) {
      papers = db
        .prepare(
          `SELECT p.* FROM papers p
           WHERE (p.Project_ID = ? OR CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT))
             AND (MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) >= 4 OR p.ai_extracted_data IS NOT NULL OR p.manual_extracted_data IS NOT NULL)
             AND CASE 
                 WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
                 WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
                 ELSE COALESCE(p.manual_decision, p.ai_decision)
             END LIKE 'INCLUDE%'
           ORDER BY p.Year DESC, p.Title ASC`
        )
        .all(resolvedProjectId, resolvedProjectId) as any[];
    }

    // 4. Pre-process papers to parse QA and Extracted Data with Stage Dominance
    const qaKeysSet = new Set<string>();
    const extKeysSet = new Set<string>();

    const processedPapers = papers.map((paper) => {
      const manualStage = paper.manual_stage || 0;
      const aiStage = paper.ai_stage || 0;
      const isManualDominant = manualStage >= aiStage;

      // Parse QA Assessment
      const qaStr = isManualDominant
        ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '')
        : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

      let qaTotalScore = 0;
      const qaItems: Record<string, string> = {};
      const qaTraces: Record<string, { mapping: string; evidence: string }> = {};

      if (qaStr) {
        try {
          const parsed = JSON.parse(qaStr);
          if (typeof parsed === 'object' && parsed !== null) {
            const qaObj = parsed.qa_scores || parsed;
            const logicTrace = parsed.logic_trace || {};
            const appraisalReasoning = logicTrace.appraisal_reasoning || {};

            Object.entries(qaObj).forEach(([k, v]) => {
              if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace' || k === 'qa_scores') return;
              qaKeysSet.add(k);

              let rawVal: any = v;
              let valStr = '';
              let evidenceVal = '';

              if (v !== null && v !== undefined) {
                if (typeof v === 'object') {
                  const vObj = v as any;
                  if ('score' in vObj && vObj.score !== undefined && vObj.score !== null) {
                    rawVal = vObj.score;
                  } else if ('value' in vObj && vObj.value !== undefined && vObj.value !== null) {
                    rawVal = vObj.value;
                  } else {
                    const entries = Object.entries(vObj);
                    const nonTextMatch = entries.find(([key, val]) => {
                      const kLower = key.toLowerCase();
                      const isMeta = ['exact_quote', 'quote', 'evidence', 'text', 'snippet', 'reasoning', 'justification', 'analysis', 'rationale', 'explanation', 'logic_trace'].includes(kLower);
                      return !isMeta && (typeof val === 'number' || typeof val === 'boolean' || (typeof val === 'string' && val.length < 50));
                    });
                    rawVal = nonTextMatch ? nonTextMatch[1] : '';
                  }

                  if (typeof rawVal === 'object' && rawVal !== null) {
                    if ('score' in rawVal) rawVal = (rawVal as any).score;
                    else if ('value' in rawVal) rawVal = (rawVal as any).value;
                    else rawVal = '';
                  }

                  if (vObj.exact_quote) evidenceVal = String(vObj.exact_quote);
                  else if (vObj.quote) evidenceVal = String(vObj.quote);
                  else if (vObj.evidence) evidenceVal = String(vObj.evidence);
                  else if (vObj.text) evidenceVal = String(vObj.text);
                  else if (vObj.logic_trace?.evidence) evidenceVal = String(vObj.logic_trace.evidence);
                }
              }

              valStr = (rawVal !== undefined && rawVal !== null) ? String(rawVal) : '';
              qaItems[k] = valStr;

              const traceVal = appraisalReasoning[k + '_analysis'] || appraisalReasoning[k] || '';
              qaTraces[k] = { mapping: String(traceVal || ''), evidence: evidenceVal };

              const numVal = parseFloat(valStr);
              if (!isNaN(numVal)) {
                qaTotalScore += numVal;
              } else if (['YES', 'PASS', 'TRUE'].includes(valStr.toUpperCase().trim())) {
                qaTotalScore += 1;
              }
            });
          }
        } catch (e) {
          const num = parseFloat(qaStr);
          if (!isNaN(num)) qaTotalScore = num;
        }
      }

      // Parse Extracted Data
      const extStr = isManualDominant
        ? (paper.manual_extracted_data || paper.ai_extracted_data || '')
        : (paper.ai_extracted_data || paper.manual_extracted_data || '');

      const extItems: Record<string, string> = {};
      const extTraces: Record<string, { original: string; mapping: string; evidence: string; justification: string }> = {};

      if (extStr) {
        try {
          const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
          if (typeof parsed === 'object' && parsed !== null) {
            const extObj = parsed.extracted_data || parsed;
            const logicTrace = parsed.logic_trace || extObj.logic_trace || {};
            const locateMapping = logicTrace.extraction_mapping || logicTrace || {};

            Object.entries(extObj).forEach(([k, v]) => {
              if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace') return;
              extKeysSet.add(k);

              let origVal = v;
              if (v && typeof v === 'object' && 'value' in v) {
                origVal = (v as any).value;
              }

              const origStr = Array.isArray(origVal) ? origVal.join('; ') : (origVal !== undefined && origVal !== null ? String(origVal) : '');
              
              // Resolve Umbrellanized value
              let resolvedStr = '';
              if (Array.isArray(origVal)) {
                const mapped = origVal.map(item => resolveUmbrellanizerValueFn(item, k)).filter(Boolean);
                resolvedStr = mapped.join('; ');
              } else if (origVal !== undefined && origVal !== null && origVal !== '') {
                resolvedStr = resolveUmbrellanizerValueFn(origStr, k);
              }

              extItems[k] = resolvedStr;

              const mapping = extractMappingReasoning(k, locateMapping, v);
              const evidence = extractEvidenceQuote(k, v);
              const justification = getUmbrellanizerJustificationFn(origVal, k);

              extTraces[k] = {
                original: origStr,
                mapping: String(mapping || ''),
                evidence,
                justification
              };
            });
          }
        } catch (e) {}
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

    // 5. Build Dynamic CSV Headers
    const headers: string[] = [
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

    // Dynamic QA columns with tooltip columns
    sortedQaKeys.forEach(qaKey => {
      headers.push(qaKey);
      headers.push(`tt_mapping_${qaKey}`);
      headers.push(`tt_evidence_${qaKey}`);
    });

    // Dynamic Extracted Data columns with tooltip columns
    sortedExtKeys.forEach(extKey => {
      headers.push(extKey);
      headers.push(`tt_original_${extKey}`);
      headers.push(`tt_mapping_${extKey}`);
      headers.push(`tt_evidence_${extKey}`);
      headers.push(`tt_justification_${extKey}`);
    });

    // Supplementary metadata column at the end
    headers.push('Abstract');

    // 6. Build CSV Rows
    const csvRows: string[] = [headers.map(escapeCsvCell).join(',')];

    processedPapers.forEach(({ paper, qaTotalScore, qaItems, qaTraces, extItems, extTraces }) => {
      const publisherVal = paper.Publisher || paper.Original_Publisher || '';

      const rowValues: string[] = [
        escapeCsvCell(paper.Paper_ID),
        escapeCsvCell(paper.Title),
        escapeCsvCell(paper.Authors),
        escapeCsvCell(paper.Year),
        escapeCsvCell(paper.DOI),
        escapeCsvCell(paper.Import_Source),
        escapeCsvCell(paper.Local_PDF_Status),
        escapeCsvCell(paper.PDF_Link),
        escapeCsvCell(publisherVal),
        escapeCsvCell(paper.citation_count ?? 0),
        escapeCsvCell(qaTotalScore.toFixed(1))
      ];

      // Append dynamic QA cells & tooltips
      sortedQaKeys.forEach(qaKey => {
        const val = qaItems[qaKey] || '';
        const trace = qaTraces[qaKey] || { mapping: '', evidence: '' };
        rowValues.push(escapeCsvCell(val));
        rowValues.push(escapeCsvCell(trace.mapping));
        rowValues.push(escapeCsvCell(trace.evidence));
      });

      // Append dynamic Extracted cells & tooltips
      sortedExtKeys.forEach(extKey => {
        const val = extItems[extKey] || '';
        const trace = extTraces[extKey] || { original: '', mapping: '', evidence: '', justification: '' };
        rowValues.push(escapeCsvCell(val));
        rowValues.push(escapeCsvCell(trace.original));
        rowValues.push(escapeCsvCell(trace.mapping));
        rowValues.push(escapeCsvCell(trace.evidence));
        rowValues.push(escapeCsvCell(trace.justification));
      });

      // Abstract
      rowValues.push(escapeCsvCell(paper.Abstract));

      csvRows.push(rowValues.join(','));
    });

    const csvContent = csvRows.join('\r\n');
    const sanitizedProjectName = (project.name || 'project')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${sanitizedProjectName}_cohort_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating CSV tabular export:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV tabular export', details: error.message },
      { status: 500 }
    );
  }
}
