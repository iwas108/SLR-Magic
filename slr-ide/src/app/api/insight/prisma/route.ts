import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // 1. Fetch project config for EC labels and QA rules
    const project = db.prepare('SELECT name, ec_rules, pool_c_qa_rules FROM projects WHERE id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId, projectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse ec_rules to map EC codes to descriptions
    let ecLabels: Record<string, string> = {};
    if (project.ec_rules) {
      try {
        const parsed = typeof project.ec_rules === 'string' ? JSON.parse(project.ec_rules) : project.ec_rules;
        if (Array.isArray(parsed)) {
          parsed.forEach((rule: any) => {
            if (rule.code && rule.description) {
              ecLabels[rule.code.trim().toUpperCase()] = rule.description;
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse ec_rules', e);
      }
    }

    // 2. Fetch papers for active project
    const papers = db.prepare(`
      SELECT 
        Import_Source, 
        Source, 
        is_duplicate, 
        manual_stage, 
        ai_stage, 
        manual_decision, 
        ai_decision, 
        manual_exclusion_code, 
        ai_exclusion_code, 
        Local_PDF_Status 
      FROM papers 
      WHERE Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)
    `).all(projectId, projectId) as any[];

    // Other sources filter list
    const otherSources = ['backward snowball', 'forward snowball', 'manual search', 'manual ingestion'];
    const isOtherSource = (src: string) => {
      if (!src) return false;
      return otherSources.includes(src.trim().toLowerCase());
    };

    // Helpers to resolve decision and stage
    const resolvePaper = (paper: any) => {
      const ms = paper.manual_stage || 0;
      const as = paper.ai_stage || 0;
      const effectiveStage = Math.max(ms, as);

      let dec = null;
      let ec = null;

      if (ms > as) {
        dec = paper.manual_decision;
        ec = paper.manual_exclusion_code;
      } else if (as > ms) {
        dec = paper.ai_decision;
        ec = paper.ai_exclusion_code;
      } else {
        dec = paper.manual_decision || paper.ai_decision;
        ec = paper.manual_exclusion_code || paper.ai_exclusion_code;
      }

      const decUpper = dec ? dec.toUpperCase() : '';
      const isIncluded = decUpper.startsWith('INCLUDE');
      const isExcluded = decUpper.startsWith('EXCLUDE');

      return {
        effectiveStage,
        isIncluded,
        isExcluded,
        ec: ec ? ec.trim() : null,
      };
    };

    // Metrics tracking
    // Left column (Databases)
    const dbSourcesMap: Record<string, number> = {};
    let dbDuplicatesRemoved = 0;
    let dbRecordsScreened = 0;
    let dbStage1Excluded = 0;
    const dbStage1ExcludedByEC: Record<string, number> = {};
    let dbReportsSought = 0;
    let dbReportsNotRetrieved = 0;
    const dbReportsExcludedStage2: Record<string, number> = {};
    let dbStage3FatalFlaw = 0;
    let dbStage3Cumulative = 0;

    // Right column (Other Methods)
    let otherDuplicatesRemoved = 0;
    let otherReportsSought = 0;
    let otherReportsNotRetrieved = 0;
    const otherReportsExcludedStage2: Record<string, number> = {};
    let otherStage3FatalFlaw = 0;
    let otherStage3Cumulative = 0;

    // Final Merged Included
    let totalIncludedStudies = 0;

    // Process all papers
    for (const paper of papers) {
      const isOther = isOtherSource(paper.Import_Source);
      const isDuplicate = paper.is_duplicate === 1;

      if (!isOther) {
        // Left Column: Databases
        // [**1] Records identified
        const sourceName = paper.Source || 'Unknown Database';
        dbSourcesMap[sourceName] = (dbSourcesMap[sourceName] || 0) + 1;

        if (isDuplicate) {
          // [**2] Duplicates removed
          dbDuplicatesRemoved++;
          continue;
        }

        // [**5] Records screened
        dbRecordsScreened++;

        const res = resolvePaper(paper);

        // [**12] Studies included in review (Stage 3 Scientist is final inclusion screening stage)
        if (res.effectiveStage >= 3 && res.isIncluded) {
          totalIncludedStudies++;
        }

        // [**6] Stage 1 Excluded
        if (res.effectiveStage === 1 && res.isExcluded) {
          dbStage1Excluded++;
          const code = res.ec || 'Unspecified';
          dbStage1ExcludedByEC[code] = (dbStage1ExcludedByEC[code] || 0) + 1;
        }

        // [**8] Reports sought for retrieval
        const passedStage1 = res.effectiveStage > 1 || (res.effectiveStage === 1 && res.isIncluded);
        if (passedStage1) {
          dbReportsSought++;

          // [**9] Reports not retrieved
          if (res.effectiveStage === 1 && paper.Local_PDF_Status?.toUpperCase() === 'INACCESSIBLE') {
            dbReportsNotRetrieved++;
          }

          // [**11] Reports excluded Stage 2 (Gatekeeper structural eligibility)
          if (res.effectiveStage === 2 && res.isExcluded) {
            const code = res.ec || 'Unspecified';
            dbReportsExcludedStage2[code] = (dbReportsExcludedStage2[code] || 0) + 1;
          }

          if (res.effectiveStage === 3 && res.isExcluded) {
            const ecUpper = res.ec ? res.ec.toUpperCase() : '';
            if (ecUpper.includes('CUMULATIVE')) {
              dbStage3Cumulative++;
            } else {
              dbStage3FatalFlaw++;
            }
          }
        }

      } else {
        // Right Column: Other Methods
        if (isDuplicate) {
          // [**13] Duplicates removed
          otherDuplicatesRemoved++;
          continue;
        }

        // [**16] Reports sought for retrieval
        otherReportsSought++;

        const res = resolvePaper(paper);

        // [**20] Reports of included studies (Stage 3 Scientist is final inclusion screening stage)
        if (res.effectiveStage >= 3 && res.isIncluded) {
          totalIncludedStudies++;
        }

        // [**17] Reports not retrieved
        if (res.effectiveStage === 1 && paper.Local_PDF_Status?.toUpperCase() === 'INACCESSIBLE') {
          otherReportsNotRetrieved++;
        }

        // [**19] Reports excluded Stage 2
        if (res.effectiveStage === 2 && res.isExcluded) {
          const code = res.ec || 'Unspecified';
          otherReportsExcludedStage2[code] = (otherReportsExcludedStage2[code] || 0) + 1;
        }

        if (res.effectiveStage === 3 && res.isExcluded) {
          const ecUpper = res.ec ? res.ec.toUpperCase() : '';
          if (ecUpper.includes('CUMULATIVE')) {
            otherStage3Cumulative++;
          } else {
            otherStage3FatalFlaw++;
          }
        }
      }
    }

    // Format DB sources array for [**1]
    const databaseSources = Object.entries(dbSourcesMap).map(([source, count]) => ({
      source,
      count
    }));

    // Format exclusion breakdowns
    const formatECList = (map: Record<string, number>) => {
      return Object.entries(map).map(([code, count]) => ({ code, count }));
    };

    return NextResponse.json({
      projectName: project.name,
      // Left Column
      databaseSources,
      dbDuplicatesRemoved,
      dbRecordsScreened,
      dbStage1Excluded,
      dbStage1ExcludedByEC: formatECList(dbStage1ExcludedByEC),
      dbReportsSought,
      dbReportsNotRetrieved,
      dbReportsAssessed: Math.max(0, dbReportsSought - dbReportsNotRetrieved), // [**10]
      dbReportsExcludedStage2: formatECList(dbReportsExcludedStage2),
      dbReportsExcludedStage3: [
        { gate: 'Fatal Flaw Gate', count: dbStage3FatalFlaw },
        { gate: 'Cumulative Gate', count: dbStage3Cumulative }
      ],
      dbStudiesIncluded: totalIncludedStudies,

      // Right Column
      otherDuplicatesRemoved,
      otherReportsSought,
      otherReportsNotRetrieved,
      otherReportsAssessed: Math.max(0, otherReportsSought - otherReportsNotRetrieved), // [**18]
      otherReportsExcludedStage2: formatECList(otherReportsExcludedStage2),
      otherReportsExcludedStage3: [
        { gate: 'Fatal Flaw Gate', count: otherStage3FatalFlaw },
        { gate: 'Cumulative Gate', count: otherStage3Cumulative }
      ],
      otherStudiesIncluded: totalIncludedStudies,

      ecLabels
    });
  } catch (error: any) {
    console.error('Failed to calculate PRISMA data:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch PRISMA data' }, { status: 500 });
  }
}
