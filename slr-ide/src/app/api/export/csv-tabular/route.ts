import { NextResponse } from 'next/server';
import db from '@/lib/db';

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
      // Fallback to first available project
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
    const umbrellanizerMap: Record<string, Record<string, string>> = {};
    try {
      const rows = db
        .prepare('SELECT field_name, taxonomy_mapping FROM umbrellanizer_results WHERE project_id = ?')
        .all(resolvedProjectId) as any[];

      rows.forEach((r) => {
        try {
          const mapping = JSON.parse(r.taxonomy_mapping);
          if (Array.isArray(mapping)) {
            const map: Record<string, string> = {};
            mapping.forEach((item: any) => {
              if (item.raw_token && item.umbrella_category) {
                map[item.raw_token.trim().toLowerCase()] = item.umbrella_category;
              }
            });
            umbrellanizerMap[r.field_name] = map;
          }
        } catch (e) {}
      });
    } catch (e) {
      console.error('Failed to load umbrellanizer results:', e);
    }

    // 3. Fetch Final Cohort Papers (Stage 4 INCLUDE)
    let papers: any[] = [];
    try {
      papers = db
        .prepare(
          `SELECT p.*,
                  (SELECT structured_output FROM llm_audit_log 
                   WHERE paper_id = p.Paper_ID AND task_type = 'scientist'
                   ORDER BY id DESC LIMIT 1) as scientist_structured_output
           FROM papers p
           WHERE p.Project_ID = ?
             AND MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) = 4
             AND CASE 
                 WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
                 WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
                 ELSE COALESCE(p.manual_decision, p.ai_decision)
             END LIKE 'INCLUDE%'
           ORDER BY p.Year DESC, p.Title ASC`
        )
        .all(resolvedProjectId) as any[];
    } catch (e) {
      console.error('Failed to fetch csv cohort papers with subquery:', e);
      try {
        papers = db
          .prepare(
            `SELECT p.* FROM papers p
             WHERE p.Project_ID = ?
               AND MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) = 4
               AND CASE 
                   WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
                   WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
                   ELSE COALESCE(p.manual_decision, p.ai_decision)
               END LIKE 'INCLUDE%'
             ORDER BY p.Year DESC, p.Title ASC`
          )
          .all(resolvedProjectId) as any[];
      } catch (e2) {}
    }

    // CSV Column Headers
    const headers = [
      'Paper_ID',
      'Title',
      'Authors',
      'Year',
      'DOI',
      'Publisher',
      'Original_Publisher',
      'Import_Source',
      'Citation_Count',
      'Local_PDF_Status',
      'Decision_Source',
      'Active_Stage',
      'QA_Total_Score',
      'QA_1_Value',
      'QA_1_Evidence',
      'QA_2_Value',
      'QA_2_Evidence',
      'QA_3_Value',
      'QA_3_Evidence',
      'QA_4_Value',
      'QA_4_Evidence',
      'QA_5_Value',
      'QA_5_Evidence',
      'QA_6_Value',
      'QA_6_Evidence',
      'QA_7_Value',
      'QA_7_Evidence',
      'QA_8_Value',
      'QA_8_Evidence',
      'RQ_1_Raw',
      'RQ_1_Umbrella',
      'RQ_2_Raw',
      'RQ_2_Umbrella',
      'RQ_3_Raw',
      'RQ_3_Umbrella',
      'RQ_4_Raw',
      'RQ_4_Umbrella',
      'RQ_5_Raw',
      'RQ_5_Umbrella',
      'RQ_6_Raw',
      'RQ_6_Umbrella',
      'RQ_7_Raw',
      'RQ_7_Umbrella',
      'RQ_8_Raw',
      'RQ_8_Umbrella',
      'RQ_9_Raw',
      'RQ_9_Umbrella',
      'Abstract',
    ];

    const csvRows: string[] = [headers.join(',')];

    papers.forEach((paper) => {
      const manualStage = paper.manual_stage || 0;
      const aiStage = paper.ai_stage || 0;

      let decisionSource = 'AI';
      if (manualStage > aiStage) {
        decisionSource = 'Manual';
      } else if (manualStage === aiStage && paper.manual_decision) {
        decisionSource = 'Manual (Override)';
      }

      const activeStage = Math.max(manualStage, aiStage);

      // Parse Quality Assessment
      let qaObj = null;
      if (manualStage > aiStage && paper.manual_quality_assessment) {
        try { qaObj = JSON.parse(paper.manual_quality_assessment); } catch (e) {}
      } else if (paper.ai_quality_assessment) {
        try { qaObj = JSON.parse(paper.ai_quality_assessment); } catch (e) {}
      }

      let qaTotalScore = 0;
      const qaValues: Record<string, string> = {};
      const qaEvidences: Record<string, string> = {};

      if (qaObj) {
        for (let i = 1; i <= 8; i++) {
          const key = `qa${i}`;
          const item = qaObj[key];
          if (item) {
            const valStr = typeof item === 'object' ? item.value || '0' : String(item);
            qaValues[key] = valStr;
            qaTotalScore += parseFloat(valStr) || 0;
            qaEvidences[key] = typeof item === 'object' ? item.evidence || '' : '';
          } else {
            qaValues[key] = '0';
            qaEvidences[key] = '';
          }
        }
      }

      // Parse Extracted Data
      let extObj = null;
      if (manualStage > aiStage && paper.manual_extracted_data) {
        try { extObj = JSON.parse(paper.manual_extracted_data); } catch (e) {}
      } else if (paper.ai_extracted_data) {
        try { extObj = JSON.parse(paper.ai_extracted_data); } catch (e) {}
      }

      const rqRaws: Record<string, string> = {};
      const rqUmbrellas: Record<string, string> = {};

      for (let i = 1; i <= 9; i++) {
        const rqKey = `rq${i}`;
        let rawVal = extObj ? extObj[rqKey] || '' : '';
        if (Array.isArray(rawVal)) {
          rawVal = rawVal.join('; ');
        } else if (typeof rawVal === 'object' && rawVal !== null) {
          rawVal = JSON.stringify(rawVal);
        } else {
          rawVal = String(rawVal);
        }

        rqRaws[rqKey] = rawVal;

        // Resolve Umbrella term
        let umbrellaVal = rawVal;
        const fieldMapping = umbrellanizerMap[rqKey];
        if (fieldMapping && rawVal) {
          const normalized = rawVal.trim().toLowerCase();
          if (fieldMapping[normalized]) {
            umbrellaVal = fieldMapping[normalized];
          }
        }
        rqUmbrellas[rqKey] = umbrellaVal;
      }

      const rowValues = [
        escapeCsvCell(paper.Paper_ID),
        escapeCsvCell(paper.Title),
        escapeCsvCell(paper.Authors),
        escapeCsvCell(paper.Year),
        escapeCsvCell(paper.DOI),
        escapeCsvCell(paper.Publisher),
        escapeCsvCell(paper.Original_Publisher),
        escapeCsvCell(paper.Import_Source),
        escapeCsvCell(paper.citation_count || 0),
        escapeCsvCell(paper.Local_PDF_Status),
        escapeCsvCell(decisionSource),
        escapeCsvCell(activeStage),
        escapeCsvCell(qaTotalScore.toFixed(1)),
        escapeCsvCell(qaValues['qa1'] || ''),
        escapeCsvCell(qaEvidences['qa1'] || ''),
        escapeCsvCell(qaValues['qa2'] || ''),
        escapeCsvCell(qaEvidences['qa2'] || ''),
        escapeCsvCell(qaValues['qa3'] || ''),
        escapeCsvCell(qaEvidences['qa3'] || ''),
        escapeCsvCell(qaValues['qa4'] || ''),
        escapeCsvCell(qaEvidences['qa4'] || ''),
        escapeCsvCell(qaValues['qa5'] || ''),
        escapeCsvCell(qaEvidences['qa5'] || ''),
        escapeCsvCell(qaValues['qa6'] || ''),
        escapeCsvCell(qaEvidences['qa6'] || ''),
        escapeCsvCell(qaValues['qa7'] || ''),
        escapeCsvCell(qaEvidences['qa7'] || ''),
        escapeCsvCell(qaValues['qa8'] || ''),
        escapeCsvCell(qaEvidences['qa8'] || ''),
        escapeCsvCell(rqRaws['rq1'] || ''),
        escapeCsvCell(rqUmbrellas['rq1'] || ''),
        escapeCsvCell(rqRaws['rq2'] || ''),
        escapeCsvCell(rqUmbrellas['rq2'] || ''),
        escapeCsvCell(rqRaws['rq3'] || ''),
        escapeCsvCell(rqUmbrellas['rq3'] || ''),
        escapeCsvCell(rqRaws['rq4'] || ''),
        escapeCsvCell(rqUmbrellas['rq4'] || ''),
        escapeCsvCell(rqRaws['rq5'] || ''),
        escapeCsvCell(rqUmbrellas['rq5'] || ''),
        escapeCsvCell(rqRaws['rq6'] || ''),
        escapeCsvCell(rqUmbrellas['rq6'] || ''),
        escapeCsvCell(rqRaws['rq7'] || ''),
        escapeCsvCell(rqUmbrellas['rq7'] || ''),
        escapeCsvCell(rqRaws['rq8'] || ''),
        escapeCsvCell(rqUmbrellas['rq8'] || ''),
        escapeCsvCell(rqRaws['rq9'] || ''),
        escapeCsvCell(rqUmbrellas['rq9'] || ''),
        escapeCsvCell(paper.Abstract),
      ];

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
