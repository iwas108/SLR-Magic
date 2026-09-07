import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import {
  canonicalizeString,
  normalizeExtractedTokens,
  normalizeForLookup,
  safeString
} from '@/lib/services/taxonomy-resolver';

export const dynamic = 'force-dynamic';

function escapeCsvCell(cell: any): string {
  if (cell === null || cell === undefined) return '';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper to map research question label from project questions text
function getResearchQuestionLabel(questionsStr: string, key: string): string {
  if (!questionsStr) return key.replace('rq', 'RQ').replace(/_/g, ' ');
  const lines = questionsStr.split('\n').map((l) => l.trim()).filter(Boolean);
  const match = key.match(/^rq(\d+)(?:_?([a-z])(?![a-z]))?/i);
  if (!match) return key.replace('rq', 'RQ').replace(/_/g, ' ');

  const num = match[1] + (match[2] || '');
  const targetPrefix = `rq${num}`.toLowerCase();
  const targetPrefix2 = `rq ${num}`.toLowerCase();


  const found = lines.find((line) => {
    const cleanLine = line.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    return cleanLine.startsWith(targetPrefix) || cleanLine.startsWith(targetPrefix2);
  });

  return found || key.replace('rq', 'RQ').replace(/_/g, ' ');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || searchParams.get('project_id');
    const targetKey = searchParams.get('key') || searchParams.get('extracted_data_key');
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 1. Fetch Project Metadata with strict project isolation
    const project = db
      .prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))')
      .get(projectId, projectId) as any;

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const resolvedProjectId = project.id;
    const projectName = project.name || `Project_${resolvedProjectId}`;
    const projectQuestions = project.research_questions || project.questions || '';

    // 2. Fetch Umbrellanizer Results
    let umbQuery = `
      SELECT * FROM umbrellanizer_results 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
        AND status = 'SUCCESS'
    `;
    const params: any[] = [resolvedProjectId, resolvedProjectId];

    if (targetKey) {
      umbQuery += ' AND extracted_data_key = ?';
      params.push(targetKey);
    }

    umbQuery += ' ORDER BY extracted_data_key ASC';

    const umbRows = db.prepare(umbQuery).all(...params) as any[];

    // 3. Fetch Miner-passed papers to calculate real token occurrences & paper references
    let minerPapers: any[] = [];
    try {
      minerPapers = db.prepare(`
        SELECT p.Paper_ID, p.Title, p.manual_extracted_data, p.ai_extracted_data, p.manual_stage, p.ai_stage, p.manual_decision, p.ai_decision
        FROM papers p
        WHERE (p.Project_ID = ? OR CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT))
          AND (MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) >= 4 OR p.ai_extracted_data IS NOT NULL OR p.manual_extracted_data IS NOT NULL)
          AND CASE 
              WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
              WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
              ELSE COALESCE(p.manual_decision, p.ai_decision)
          END LIKE 'INCLUDE%'
      `).all(resolvedProjectId, resolvedProjectId) as any[];
    } catch (err) {
      console.warn('Could not load miner papers for occurrence metrics:', err);
    }

    // Build occurrence lookup for each key: key -> normalized_token -> { count, paperIds: Set<string> }
    const occurrencesByKey: Record<string, Record<string, { count: number; paperIds: Set<string> }>> = {};

    minerPapers.forEach((paper) => {
      let extData: any = null;
      const isNonEmpty = (s: any) => typeof s === 'string' && s.trim() !== '' && s.trim() !== '{}' && s.trim() !== '[]' && s.trim() !== 'null';
      
      const ms = Number(paper.manual_stage || 0);
      const as = Number(paper.ai_stage || 0);
      const rawExt = (ms >= as && isNonEmpty(paper.manual_extracted_data))
        ? paper.manual_extracted_data
        : (isNonEmpty(paper.ai_extracted_data) ? paper.ai_extracted_data : paper.manual_extracted_data);

      if (rawExt) {
        try {
          const parsed = JSON.parse(rawExt);
          extData = parsed.extracted_data || parsed;
        } catch (_) {}
      }

      if (extData && typeof extData === 'object') {
        Object.entries(extData).forEach(([fieldKey, val]) => {
          if (!fieldKey || fieldKey.startsWith('_') || fieldKey === 'logic_trace' || fieldKey === 'qa_scores') return;
          const tokens = normalizeExtractedTokens(val, fieldKey);
          if (!occurrencesByKey[fieldKey]) {
            occurrencesByKey[fieldKey] = {};
          }

          tokens.forEach((tok) => {
            const norm = normalizeForLookup(tok);
            if (!norm || norm === 'not_stated') return;

            if (!occurrencesByKey[fieldKey][norm]) {
              occurrencesByKey[fieldKey][norm] = { count: 0, paperIds: new Set<string>() };
            }
            occurrencesByKey[fieldKey][norm].count += 1;
            occurrencesByKey[fieldKey][norm].paperIds.add(paper.Paper_ID);
          });
        });
      }
    });

    // 4. Construct parsed mapping records
    interface ExportMappingItem {
      variable_key: string;
      research_question: string;
      raw_value: string;
      umbrellanizer_value: string;
      justification: string;
      occurrences: number;
      paper_ids: string[];
    }

    const exportItems: ExportMappingItem[] = [];

    umbRows.forEach((row) => {
      const fieldKey = row.extracted_data_key;
      const rqLabel = getResearchQuestionLabel(projectQuestions, fieldKey);
      const rawMappingStr = row.umbrella_mapping;
      if (!rawMappingStr) return;

      try {
        const parsedMapping = JSON.parse(rawMappingStr);

        // Helper to append mapping record
        const addMappingEntry = (rawVal: string, catVal: string, justVal: string) => {
          const cleanRaw = canonicalizeString(rawVal);
          if (!cleanRaw) return;

          const norm = normalizeForLookup(cleanRaw);
          const occInfo = occurrencesByKey[fieldKey]?.[norm] || { count: 0, paperIds: new Set<string>() };

          exportItems.push({
            variable_key: fieldKey,
            research_question: rqLabel,
            raw_value: cleanRaw,
            umbrellanizer_value: canonicalizeString(catVal) || cleanRaw,
            justification: canonicalizeString(justVal) || 'Default mapped.',
            occurrences: occInfo.count,
            paper_ids: Array.from(occInfo.paperIds)
          });
        };

        if (Array.isArray(parsedMapping)) {
          parsedMapping.forEach((entry: any) => {
            if (!entry) return;
            const tok = entry.raw_token || entry.raw_value || entry.token;
            const cat = entry.umbrella_category || entry.umbrella_value || entry.category || tok;
            const just = entry.justification || '';
            if (tok) addMappingEntry(tok, cat, just);
          });
        } else if (typeof parsedMapping === 'object' && parsedMapping !== null) {
          Object.entries(parsedMapping).forEach(([tok, val]: [string, any]) => {
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
              const cat = val.umbrella_category || val.umbrella_value || val.category || tok;
              const just = val.justification || '';
              addMappingEntry(tok, cat, just);
            } else if (typeof val === 'string') {
              addMappingEntry(tok, val, '');
            } else if (Array.isArray(val)) {
              const cat = safeString(val[0] || tok);
              addMappingEntry(tok, cat, '');
            }
          });
        }
      } catch (parseErr) {
        console.warn(`Failed to parse umbrella mapping for key ${fieldKey}:`, parseErr);
      }
    });

    const safeProj = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const keySuffix = targetKey ? `_${targetKey}` : '_all';

    // 5. Generate CSV or JSON response
    if (format === 'json') {
      const groupedVariables: Record<string, { key: string; research_question: string; mappings: any[] }> = {};
      exportItems.forEach((item) => {
        if (!groupedVariables[item.variable_key]) {
          groupedVariables[item.variable_key] = {
            key: item.variable_key,
            research_question: item.research_question,
            mappings: []
          };
        }
        groupedVariables[item.variable_key].mappings.push({
          raw_value: item.raw_value,
          umbrellanizer_value: item.umbrellanizer_value,
          justification: item.justification,
          occurrences: item.occurrences,
          paper_ids: item.paper_ids
        });
      });

      const jsonPayload = {
        export_type: 'umbrellanizer_taxonomy_mapping',
        export_timestamp: new Date().toISOString(),
        project_id: resolvedProjectId,
        project_name: projectName,
        total_mapped_keys: Object.keys(groupedVariables).length,
        total_mappings: exportItems.length,
        variables: groupedVariables,
        all_mappings: exportItems
      };

      const filename = `umbrellanizer_mappings_${safeProj}${keySuffix}_${timestamp}.json`;
      return new NextResponse(JSON.stringify(jsonPayload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // Default to CSV
    const csvHeaders = [
      'Variable Key',
      'Research Question',
      'Raw Value',
      'Umbrellanizer Value',
      'Justification',
      'Occurrences',
      'Paper IDs'
    ];

    const csvRows = [
      csvHeaders.map(escapeCsvCell).join(','),
      ...exportItems.map((item) =>
        [
          escapeCsvCell(item.variable_key),
          escapeCsvCell(item.research_question),
          escapeCsvCell(item.raw_value),
          escapeCsvCell(item.umbrellanizer_value),
          escapeCsvCell(item.justification),
          escapeCsvCell(item.occurrences),
          escapeCsvCell(item.paper_ids.join(', '))
        ].join(',')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const filename = `umbrellanizer_mappings_${safeProj}${keySuffix}_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    console.error('Umbrellanizer mapping export failed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
