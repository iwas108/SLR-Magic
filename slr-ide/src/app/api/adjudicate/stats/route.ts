import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET() {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    // 1. Query distinct reviewers
    const reviewerRows = db.prepare(`
      SELECT DISTINCT reviewer_name 
      FROM reviewer_decisions 
      WHERE project_id = ? AND pool = 'pool_a'
      ORDER BY reviewer_name ASC
    `).all(activeProjectId) as { reviewer_name: string }[];

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

    // Since we enforce max 2 reviewers, we take the first 2 reviewers from alphabetical list
    const r1 = reviewers[0];
    const r2 = reviewers[1];

    // 3. Query paired decisions for the intersection of papers (both reviewers completed)
    const pairedDecisions = db.prepare(`
      SELECT rd.paper_id,
             p.Title as title,
             p.Abstract as abstract,
             MAX(CASE WHEN rd.reviewer_name = ? THEN rd.decision END) as r1_decision,
             MAX(CASE WHEN rd.reviewer_name = ? THEN rd.decision END) as r2_decision,
             MAX(CASE WHEN rd.reviewer_name = ? THEN rd.rationale END) as r1_rationale,
             MAX(CASE WHEN rd.reviewer_name = ? THEN rd.rationale END) as r2_rationale,
             MAX(CASE WHEN rd.reviewer_name = ? THEN rd.ec_trigger END) as r1_ec,
             MAX(CASE WHEN rd.reviewer_name = ? THEN rd.ec_trigger END) as r2_ec
      FROM reviewer_decisions rd
      JOIN papers p ON rd.paper_id = p.Paper_ID AND rd.project_id = p.Project_ID
      WHERE rd.project_id = ? AND rd.pool = 'pool_a'
      GROUP BY rd.paper_id
      HAVING COUNT(DISTINCT rd.reviewer_name) = 2
    `).all(r1, r2, r1, r2, r1, r2, activeProjectId) as any[];

    // Calculate agreement matrix
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

      // If they don't match, or if one is not matched properly, it's a discrepancy
      if (dec1 !== dec2) {
        discrepancies.push({
          paper_id: row.paper_id,
          title: row.title,
          abstract: row.abstract,
          r1_decision: row.r1_decision,
          r2_decision: row.r2_decision,
          r1_rationale: row.r1_rationale,
          r2_rationale: row.r2_rationale,
          r1_ec: row.r1_ec,
          r2_ec: row.r2_ec
        });
      }
    }

    // Cohen's Kappa Calculation
    let kappa = 0;
    let raw_agreement = 0;
    let expected_agreement = 0;

    if (total_intersection > 0) {
      raw_agreement = (agree_include + agree_exclude) / total_intersection;

      const p1_inc = (agree_include + r1_inc_r2_exc) / total_intersection;
      const p2_inc = (agree_include + r1_exc_r2_inc) / total_intersection;
      const p1_exc = (agree_exclude + r1_exc_r2_inc) / total_intersection;
      const p2_exc = (agree_exclude + r1_inc_r2_exc) / total_intersection;

      expected_agreement = (p1_inc * p2_inc) + (p1_exc * p2_exc);

      if (expected_agreement < 1) {
        kappa = (raw_agreement - expected_agreement) / (1 - expected_agreement);
      } else {
        kappa = raw_agreement === 1 ? 1 : 0;
      }
    }

    // Format Kappa interpretation
    let kappa_label = 'Poor';
    if (kappa >= 0.81) {
      kappa_label = 'Almost Perfect';
    } else if (kappa >= 0.61) {
      kappa_label = 'Substantial';
    } else if (kappa >= 0.41) {
      kappa_label = 'Moderate';
    } else if (kappa >= 0.21) {
      kappa_label = 'Fair';
    } else if (kappa > 0) {
      kappa_label = 'Poor';
    } else {
      kappa_label = 'Poor';
    }

    const kappa_warning = kappa < 0.80;

    return NextResponse.json({
      isCalibrated: true,
      reviewers,
      total_reviewers,
      agree_include,
      agree_exclude,
      r1_inc_r2_exc,
      r1_exc_r2_inc,
      total_intersection,
      cohens_kappa: parseFloat(kappa.toFixed(4)),
      kappa_label,
      raw_agreement_pct: parseFloat((raw_agreement * 100).toFixed(2)),
      expected_agreement_pct: parseFloat((expected_agreement * 100).toFixed(2)),
      kappa_warning,
      discrepancies
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to calculate statistics' }, { status: 500 });
  }
}
