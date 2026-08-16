import { NextResponse } from 'next/server';
import db from '@/lib/db';
import path from 'path';
import { resolveUmbrellanizerValue } from '@/lib/services/taxonomy-resolver';

/**
 * Helper to parse composite QA score from JSON or numeric value
 */
function parseQaScore(paper: any): number {
  const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
  const qaStr = isManualDominant
    ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '')
    : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

  if (!qaStr) return 0;

  try {
    const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
    if (typeof parsed === 'object' && parsed !== null) {
      const qaObj = parsed.qa_scores || parsed;
      let score = 0;

      Object.entries(qaObj).forEach(([, v]: [string, any]) => {
        let rawVal = v;
        if (typeof v === 'object' && v !== null && 'value' in v) {
          rawVal = v.value;
        }
        const valStr = String(rawVal ?? '');
        const numVal = parseFloat(valStr);
        if (!isNaN(numVal)) {
          score += numVal;
        } else if (rawVal === true || ['YES', 'PASS', 'TRUE'].includes(valStr.toUpperCase().trim())) {
          score += 1;
        }
      });
      return score;
    }
  } catch (e) {
    const num = parseFloat(qaStr);
    if (!isNaN(num)) return num;
  }
  return 0;
}

/**
 * Helper to resolve raw token against Umbrellanizer mapping dictionary
 */
function resolveCategoryFromMapping(val: string, umbrellaMapping: Record<string, any>): string {
  return resolveUmbrellanizerValue(val, '', true, umbrellaMapping);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const groupByKey = searchParams.get('groupByKey') || '';
  const qaFilterEnabled = searchParams.get('qaFilterEnabled') === 'true';
  const minQaThreshold = parseFloat(searchParams.get('minQaThreshold') || '6');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // 1. Get Project Info
    const project = db.prepare('SELECT name, rclone_remote_name, gdrive_dest_path, goldmine_dest_path, cloud_provider FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const missingRemoteConfig = !project.rclone_remote_name || !project.rclone_remote_name.trim();
    const effectiveRemote = project.rclone_remote_name?.trim() || (project.cloud_provider === 'onedrive' ? 'onedrive' : 'gdrive');

    const resolvedGoldminePath = (project.goldmine_dest_path && project.goldmine_dest_path.trim() !== '')
      ? project.goldmine_dest_path.trim()
      : `${(project.gdrive_dest_path || 'SLR_Magic/PDFs').trim()}/Gold_Mine_Exports`;

    const safeGroupKey = groupByKey ? String(groupByKey).trim().replace(/[^a-z0-9_\-]/gi, '_') : '';
    const sessionPrefix = safeGroupKey ? `${safeGroupKey}_<timestamp>` : `Flat_Exports_<timestamp>`;
    const remoteDest = `${effectiveRemote}:${resolvedGoldminePath}/${sessionPrefix}`;

    // 2. Get Umbrellanizer mappings if key provided
    let umbrellaMapping: Record<string, any> = {};
    if (groupByKey) {
      const umbRes = db.prepare(`
        SELECT umbrella_mapping 
        FROM umbrellanizer_results 
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND extracted_data_key = ?
      `).get(projectId, groupByKey) as any;

      if (umbRes && umbRes.umbrella_mapping) {
        const mappingStr = umbRes.umbrella_mapping;
        if (mappingStr) {
          try {
            const parsed = JSON.parse(mappingStr);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                if (item && item.raw_token) {
                  const key = String(item.raw_token).trim();
                  umbrellaMapping[key] = item.umbrella_category || item.category || item;
                }
              });
            } else if (typeof parsed === 'object' && parsed !== null) {
              umbrellaMapping = parsed;
            }
          } catch (e) {}
        }
      }
    }

    // 3. Query Stage 4 Included SYNCED papers
    const papers = db.prepare(`
      SELECT 
        Paper_ID, Title, Local_PDF_Path, 
        ai_quality_assessment, manual_quality_assessment,
        ai_extracted_data, manual_extracted_data,
        ai_stage, manual_stage
      FROM papers 
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
        AND (MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) >= 4 OR ai_extracted_data IS NOT NULL OR manual_extracted_data IS NOT NULL)
        AND CASE 
            WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
            WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
            ELSE COALESCE(manual_decision, ai_decision)
        END LIKE 'INCLUDE%'
        AND Local_PDF_Status = 'SYNCED'
        AND Local_PDF_Path IS NOT NULL
    `).all(projectId, projectId) as any[];

    // 4. Pass 1: Filter by QA threshold & sort papers in descending order of QA score
    let skippedQa = 0;
    const qualifiedPapers: Array<{ paper: any; qaScore: number }> = [];

    for (const paper of papers) {
      const qaScore = parseQaScore(paper);
      if (qaFilterEnabled && qaScore < minQaThreshold) {
        skippedQa++;
        continue;
      }
      qualifiedPapers.push({ paper, qaScore });
    }

    qualifiedPapers.sort((a, b) => {
      if (b.qaScore !== a.qaScore) {
        return b.qaScore - a.qaScore;
      }
      return String(a.paper.Paper_ID || '').localeCompare(String(b.paper.Paper_ID || ''));
    });

    const paperCategoryItems: Array<{ fileName: string; categories: string[] }> = [];
    const categoryTotals: Record<string, number> = {};

    for (const { paper } of qualifiedPapers) {
      let categories: string[] = [];
      if (groupByKey) {
        const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
        const extDataStr = isManualDominant
          ? (paper.manual_extracted_data || paper.ai_extracted_data || '{}')
          : (paper.ai_extracted_data || paper.manual_extracted_data || '{}');

        try {
          const parsed = JSON.parse(extDataStr);
          const extObj = (parsed && typeof parsed === 'object' && parsed.extracted_data && typeof parsed.extracted_data === 'object')
            ? parsed.extracted_data
            : parsed;

          let rawVal = extObj ? extObj[groupByKey] : undefined;

          if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal) && 'value' in rawVal) {
            rawVal = rawVal.value;
          }

          const extractSingleVal = (item: any): string => {
            if (item && typeof item === 'object' && 'value' in item) {
              return String((item as any).value);
            }
            return String(item);
          };

          if (Array.isArray(rawVal)) {
            categories = rawVal
              .map((v) => {
                const s = extractSingleVal(v).trim();
                return resolveCategoryFromMapping(s, umbrellaMapping);
              })
              .filter((v) => v !== '' && v !== '[object Object]');
          } else if (rawVal !== undefined && rawVal !== null) {
            const s = extractSingleVal(rawVal).trim();
            if (s !== '' && s !== '[object Object]') {
              const res = resolveCategoryFromMapping(s, umbrellaMapping);
              if (res !== '') categories = [res];
            }
          }
        } catch (e) {}

        categories = Array.from(new Set(categories.map((c) => String(c || '').trim()))).filter(Boolean);

        const notStatedCat = safeGroupKey ? `${safeGroupKey}_NOT_STATED` : '_Ungrouped';
        if (categories.length === 0) {
          categories = [notStatedCat];
        } else {
          categories = categories.map((cat) => {
            const norm = String(cat || '').trim();
            if (norm.toUpperCase() === 'NOT_STATED' || norm.toUpperCase() === 'NOT STATED' || norm === '_Ungrouped') {
              return notStatedCat;
            }
            return norm;
          });
        }
      } else {
        categories = [''];
      }

      const fileName = path.basename(paper.Local_PDF_Path);
      paperCategoryItems.push({ fileName, categories });

      for (const cat of categories) {
        const strCat = String(cat).trim();
        const safeCat = strCat !== '' ? (strCat.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 80) || '_Category') : '';
        categoryTotals[safeCat] = (categoryTotals[safeCat] || 0) + 1;
      }
    }

    // 5. Pass 2: Assign to 50-source chunked folders (_Part1, _Part2...)
    let totalCopiesEstimate = 0;
    const categoryCurrentCounts: Record<string, number> = {};
    const categoryMap = new Map<string, string[]>();

    for (const item of paperCategoryItems) {
      for (const cat of item.categories) {
        const strCat = String(cat).trim();
        const safeCat = strCat !== '' ? (strCat.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 80) || '_Category') : '';
        
        categoryCurrentCounts[safeCat] = (categoryCurrentCounts[safeCat] || 0) + 1;
        const currentCount = categoryCurrentCounts[safeCat];
        const totalCount = categoryTotals[safeCat] || 0;

        let targetFolderName = safeCat;
        if (totalCount > 50) {
          const chunkIndex = Math.ceil(currentCount / 50);
          targetFolderName = safeCat !== '' ? `${safeCat}_Part${chunkIndex}` : `Part${chunkIndex}`;
        }

        if (!categoryMap.has(targetFolderName)) {
          categoryMap.set(targetFolderName, []);
        }
        categoryMap.get(targetFolderName)!.push(item.fileName);
        totalCopiesEstimate++;
      }
    }

    // 6. Structure preview output
    const categoryPreviews: Array<{ name: string; count: number; sampleFiles: string[] }> = [];
    categoryMap.forEach((files, catName) => {
      categoryPreviews.push({
        name: catName,
        count: files.length,
        sampleFiles: files
      });
    });

    // Sort categories: named categories first, _Ungrouped last, then by chunk Part number
    categoryPreviews.sort((a, b) => {
      if (a.name.startsWith('_Ungrouped') && !b.name.startsWith('_Ungrouped')) return 1;
      if (!a.name.startsWith('_Ungrouped') && b.name.startsWith('_Ungrouped')) return -1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    return NextResponse.json({
      remoteDest,
      missingRemoteConfig,
      totalQualifying: paperCategoryItems.length,
      totalStagedEstimate: totalCopiesEstimate,
      skippedQa,
      categories: categoryPreviews
    });

  } catch (error: any) {
    console.error('Failed to generate gold mine preview:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate preview' }, { status: 500 });
  }
}
