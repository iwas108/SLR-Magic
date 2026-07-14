import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import {
  calculatePoolCDecision,
  getScoreIndex,
  calculateCohensKappa,
  calculateWeightedKappa,
  calculatePoolBPrecision,
  calculateSchemaExactness
} from '@/lib/inter-rater/adjudication-calculations';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';
    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    // 1. Query distinct reviewers for this pool
    const reviewerRows = db.prepare(`
      SELECT DISTINCT reviewer_name 
      FROM reviewer_decisions 
      WHERE project_id = ? AND pool = ?
      ORDER BY reviewer_name ASC
    `).all(activeProjectId, dbPool) as { reviewer_name: string }[];

    const reviewers = reviewerRows.map(r => r.reviewer_name);
    const total_reviewers = reviewers.length;

    // 2. NaN guard if < 2 reviewers
    if (total_reviewers < 2) {
      return NextResponse.json({
        isCalibrated: false,
        message: 'Awaiting second reviewer data',
        reviewers,
        total_reviewers
      });
    }

    const r1 = reviewers[0];
    const r2 = reviewers[1];

    if (dbPool === 'pool_c') {
      // Query project rules to parse fatal flaws and keys
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
      let qaRules: any[] = [];
      let extractionRules: any[] = [];
      if (project) {
        if (project.pool_c_qa_rules) {
          try {
            qaRules = typeof project.pool_c_qa_rules === 'string' ? JSON.parse(project.pool_c_qa_rules) : project.pool_c_qa_rules;
          } catch {}
        }
        if (project.pool_c_extraction_rules) {
          try {
            extractionRules = typeof project.pool_c_extraction_rules === 'string' ? JSON.parse(project.pool_c_extraction_rules) : project.pool_c_extraction_rules;
          } catch {}
        }
      }

      // Query paired decisions for Pool C
      const pairedDecisions = db.prepare(`
        SELECT rd.paper_id,
               p.Title as title,
               p.Abstract as abstract,
               p.Local_PDF_Path as local_pdf_path,
               p.Authors as authors,
               p.Year as year,
               p.DOI as doi,
               p.Source as source,
               p.PDF_Link as pdf_link,
               p.Publisher as publisher,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.qa_scores END) as r1_qa_scores,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.qa_scores END) as r2_qa_scores,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.extracted_data END) as r1_extracted_data,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.extracted_data END) as r2_extracted_data
        FROM reviewer_decisions rd
        JOIN calibration_papers p ON rd.paper_id = p.Paper_ID AND rd.project_id = p.Project_ID
        WHERE rd.project_id = ? AND rd.pool = 'pool_c'
        GROUP BY rd.paper_id
        HAVING COUNT(DISTINCT rd.reviewer_name) = 2
      `).all(r1, r2, r1, r2, activeProjectId) as any[];

      const discrepancies: any[] = [];
      const total_intersection = pairedDecisions.length;

      // 3x3 Confusion Matrix for QA scores: [0.0, 0.5, 1.0]
      const O = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

      let totalRatings = 0;
      let r1_include_count = 0;
      let r2_include_count = 0;
      let agree_include = 0;
      let agree_exclude = 0;

      let missingKeysCount = 0;
      let typeMatchesCount = 0;

      for (const row of pairedDecisions) {
        const r1_qa = JSON.parse(row.r1_qa_scores || '{}');
        const r2_qa = JSON.parse(row.r2_qa_scores || '{}');
        const r1_ext = JSON.parse(row.r1_extracted_data || '{}');
        const r2_ext = JSON.parse(row.r2_extracted_data || '{}');

        // Compile Kappa Ratings
        for (const rule of qaRules) {
          const idx1 = getScoreIndex(r1_qa[rule.code]?.value);
          const idx2 = getScoreIndex(r2_qa[rule.code]?.value);
          O[idx1][idx2]++;
          totalRatings++;
        }

        // Calculate dynamic decisions for rates
        const d1 = calculatePoolCDecision(r1_qa, qaRules);
        const d2 = calculatePoolCDecision(r2_qa, qaRules);

        if (d1.decision === 'Include') r1_include_count++;
        if (d2.decision === 'Include') r2_include_count++;
        if (d1.decision === 'Include' && d2.decision === 'Include') agree_include++;
        if (d1.decision === 'Exclude' && d2.decision === 'Exclude') agree_exclude++;

        // Calculate Schema Exactness
        for (const rule of extractionRules) {
          if (r1_ext[rule.json_key] === undefined) {
            missingKeysCount++;
          } else {
            if (typeof r1_ext[rule.json_key]?.value === 'string') {
              typeMatchesCount++;
            }
          }

          if (r2_ext[rule.json_key] === undefined) {
            missingKeysCount++;
          } else {
            if (typeof r2_ext[rule.json_key]?.value === 'string') {
              typeMatchesCount++;
            }
          }
        }

        // Conflict check
        let hasConflict = false;
        for (const rule of qaRules) {
          if (r1_qa[rule.code]?.value !== r2_qa[rule.code]?.value) {
            hasConflict = true;
            break;
          }
        }
        if (!hasConflict) {
          for (const rule of extractionRules) {
            const v1 = (r1_ext[rule.json_key]?.value || '').trim().replace(/\s+/g, ' ');
            const v2 = (r2_ext[rule.json_key]?.value || '').trim().replace(/\s+/g, ' ');
            if (v1 !== v2) {
              hasConflict = true;
              break;
            }
          }
        }

        if (hasConflict) {
          discrepancies.push({
            paper_id: row.paper_id,
            title: row.title,
            abstract: row.abstract,
            local_pdf_path: row.local_pdf_path,
            authors: row.authors,
            year: row.year,
            doi: row.doi,
            source: row.source,
            pdf_link: row.pdf_link,
            publisher: row.publisher,
            r1_qa_scores: row.r1_qa_scores,
            r2_qa_scores: row.r2_qa_scores,
            r1_extracted_data: row.r1_extracted_data,
            r2_extracted_data: row.r2_extracted_data
          });
        }
      }

      // Linear Weighted Kappa Calculation
      const kappaMetrics = calculateWeightedKappa(O, totalRatings);
      // Schema metrics
      const schemaMetrics = calculateSchemaExactness(total_intersection, extractionRules.length, missingKeysCount, typeMatchesCount);

      return NextResponse.json({
        isCalibrated: true,
        reviewers,
        total_reviewers,
        total_intersection,
        weighted_kappa: kappaMetrics.weighted_kappa,
        kappa_label: kappaMetrics.kappa_label,
        raw_agreement_pct: kappaMetrics.raw_agreement_pct,
        expected_agreement_pct: kappaMetrics.expected_agreement_pct,
        kappa_warning: kappaMetrics.kappa_warning,
        agree_include,
        agree_exclude,
        r1_include_count,
        r2_include_count,
        missing_keys_pct: schemaMetrics.missing_keys_pct,
        type_match_pct: schemaMetrics.type_match_pct,
        discrepancies
      });

    } else {
      // Pool A & Pool B Standard Stats
      const pairedDecisions = db.prepare(`
        SELECT rd.paper_id,
               p.Title as title,
               p.Abstract as abstract,
               p.Local_PDF_Path as local_pdf_path,
               p.Authors as authors,
               p.Year as year,
               p.DOI as doi,
               p.Source as source,
               p.PDF_Link as pdf_link,
               p.Publisher as publisher,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.decision END) as r1_decision,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.decision END) as r2_decision,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.rationale END) as r1_rationale,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.rationale END) as r2_rationale,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.ec_trigger END) as r1_ec,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.ec_trigger END) as r2_ec
        FROM reviewer_decisions rd
        JOIN calibration_papers p ON rd.paper_id = p.Paper_ID AND rd.project_id = p.Project_ID
        WHERE rd.project_id = ? AND rd.pool = ?
        GROUP BY rd.paper_id
        HAVING COUNT(DISTINCT rd.reviewer_name) = 2
      `).all(r1, r2, r1, r2, r1, r2, activeProjectId, dbPool) as any[];

      let agree_include = 0;
      let agree_exclude = 0;
      let r1_inc_r2_exc = 0;
      let r1_exc_r2_inc = 0;

      const discrepancies: any[] = [];
      const total_intersection = pairedDecisions.length;

      for (const row of pairedDecisions) {
        const dec1 = (row.r1_decision || '').trim().toLowerCase();
        const dec2 = (row.r2_decision || '').trim().toLowerCase();

        const isInc1 = dec1 === 'include';
        const isInc2 = dec2 === 'include';
        const isExc1 = dec1 === 'exclude';
        const isExc2 = dec2 === 'exclude';

        if (isInc1 && isInc2) {
          agree_include++;
        } else if (isExc1 && isExc2) {
          agree_exclude++;
        } else if (isInc1 && isExc2) {
          r1_inc_r2_exc++;
        } else if (isExc1 && isInc2) {
          r1_exc_r2_inc++;
        }

        if (dec1 !== dec2) {
          discrepancies.push({
            paper_id: row.paper_id,
            title: row.title,
            abstract: row.abstract,
            local_pdf_path: row.local_pdf_path,
            authors: row.authors,
            year: row.year,
            doi: row.doi,
            source: row.source,
            pdf_link: row.pdf_link,
            publisher: row.publisher,
            r1_decision: row.r1_decision,
            r2_decision: row.r2_decision,
            r1_rationale: row.r1_rationale,
            r2_rationale: row.r2_rationale,
            r1_ec: row.r1_ec,
            r2_ec: row.r2_ec
          });
        }
      }

      // Cohen's Kappa
      const kappaMetrics = calculateCohensKappa(total_intersection, agree_include, agree_exclude, r1_inc_r2_exc, r1_exc_r2_inc);

      // Precision calculation for Pool B
      let r1_precision = 0;
      let r2_precision = 0;
      let precision_warning = false;
      if (dbPool === 'pool_b') {
        const precMetrics = calculatePoolBPrecision(agree_include, r1_exc_r2_inc, r1_inc_r2_exc);
        r1_precision = precMetrics.r1_precision;
        r2_precision = precMetrics.r2_precision;
        precision_warning = precMetrics.precision_warning;
      }

      return NextResponse.json({
        isCalibrated: true,
        reviewers,
        total_reviewers,
        agree_include,
        agree_exclude,
        r1_inc_r2_exc,
        r1_exc_r2_inc,
        total_intersection,
        cohens_kappa: kappaMetrics.cohens_kappa,
        kappa_label: kappaMetrics.kappa_label,
        raw_agreement_pct: kappaMetrics.raw_agreement_pct,
        expected_agreement_pct: kappaMetrics.expected_agreement_pct,
        kappa_warning: kappaMetrics.kappa_warning,
        r1_precision,
        r2_precision,
        precision_warning,
        discrepancies
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to calculate statistics' }, { status: 500 });
  }
}
