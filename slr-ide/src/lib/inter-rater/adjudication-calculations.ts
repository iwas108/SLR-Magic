/**
 * Pure TypeScript Inter-Rater Reliability & Adjudication Calculation Engine.
 * Designed with zero Next.js dependencies to guarantee absolute portability with the standalone inter-rater/ React SPA.
 */

import { AgreementMetricSummary } from '@/types';

/**
 * Helper function to calculate Pool C dynamic decisions based on QA scores and project rules.
 */
export function calculatePoolCDecision(qaScores: Record<string, { value: any }>, qaRules: any[]) {
  let hasFatalFlaw = false;
  let totalScore = 0;
  
  const ruleKeys = Object.keys(qaScores);
  for (const code of ruleKeys) {
    const scoreVal = parseFloat(String(qaScores[code]?.value || 0));
    totalScore += scoreVal;
    
    // Check if this rule is flagged as a fatal flaw
    const ruleDef = qaRules.find(r => r.code.toLowerCase() === code.toLowerCase());
    const isFatal = ruleDef ? !!ruleDef.is_fatal_flaw : ['qa1', 'qa2', 'qa3', 'qa4', 'qa6'].includes(code.toLowerCase());
    
    if (isFatal && scoreVal === 0) {
      hasFatalFlaw = true;
    }
  }
  
  const meetsCumulative = totalScore >= 4.5;
  const decision = (!hasFatalFlaw && meetsCumulative) ? 'Include' : 'Exclude';
  
  let exclusionCode: string | null = null;
  if (decision === 'Exclude') {
    if (hasFatalFlaw) {
      const failedCode = ruleKeys.find(code => {
        const scoreVal = parseFloat(String(qaScores[code]?.value || 0));
        const ruleDef = qaRules.find(r => r.code.toLowerCase() === code.toLowerCase());
        const isFatal = ruleDef ? !!ruleDef.is_fatal_flaw : ['qa1', 'qa2', 'qa3', 'qa4', 'qa6'].includes(code.toLowerCase());
        return isFatal && scoreVal === 0;
      });
      exclusionCode = `FATAL_FLAW_${failedCode?.toUpperCase() || 'QA'}`;
    } else {
      exclusionCode = 'CUMULATIVE_BELOW_4.5';
    }
  }
  
  const rationale = `Adjudicated Pool C Decision: ${decision}. Total QA Score: ${totalScore.toFixed(1)}/8.0.${decision === 'Exclude' ? ` Exclusion reason: ${exclusionCode}.` : ''}`;
  
  return { decision, exclusionCode, rationale, totalScore };
}

/**
 * Get index for 3x3 Confusion Matrix for QA scores: [0.0, 0.5, 1.0]
 */
export function getScoreIndex(val: any): number {
  const num = parseFloat(String(val));
  if (num === 0.5) return 1;
  if (num === 1.0) return 2;
  return 0;
}

/**
 * Interpret Cohen's or Weighted Kappa value into categorical labels.
 */
export function interpretKappa(kappa: number): 'Poor' | 'Fair' | 'Moderate' | 'Substantial' | 'Almost Perfect' {
  if (kappa >= 0.81) return 'Almost Perfect';
  if (kappa >= 0.61 && kappa < 0.81) return 'Substantial';
  if (kappa >= 0.41 && kappa < 0.61) return 'Moderate';
  if (kappa >= 0.21 && kappa < 0.41) return 'Fair';
  return 'Poor';
}

/**
 * Calculate standard Cohen's Kappa for binary decisions (Pool A & Pool B).
 */
export function calculateCohensKappa(
  totalIntersection: number,
  agreeInclude: number,
  agreeExclude: number,
  r1IncR2Exc: number,
  r1ExcR2Inc: number
) {
  let kappa = 0;
  let raw_agreement = 0;
  let expected_agreement = 0;

  if (totalIntersection > 0) {
    raw_agreement = (agreeInclude + agreeExclude) / totalIntersection;

    const p1_inc = (agreeInclude + r1IncR2Exc) / totalIntersection;
    const p2_inc = (agreeInclude + r1ExcR2Inc) / totalIntersection;
    const p1_exc = (agreeExclude + r1ExcR2Inc) / totalIntersection;
    const p2_exc = (agreeExclude + r1IncR2Exc) / totalIntersection;

    expected_agreement = (p1_inc * p2_inc) + (p1_exc * p2_exc);

    if (expected_agreement < 1) {
      kappa = (raw_agreement - expected_agreement) / (1 - expected_agreement);
    } else {
      kappa = raw_agreement === 1 ? 1 : 0;
    }
  }

  const kappa_label = interpretKappa(kappa);
  const kappa_warning = kappa < 0.80;

  return {
    cohens_kappa: parseFloat(kappa.toFixed(4)),
    kappa_label,
    raw_agreement_pct: parseFloat((raw_agreement * 100).toFixed(2)),
    expected_agreement_pct: parseFloat((expected_agreement * 100).toFixed(2)),
    kappa_warning
  };
}

/**
 * Calculate linear weighted kappa for ordinal QA ratings (Pool C).
 */
export function calculateWeightedKappa(O: number[][], totalRatings: number) {
  let weighted_kappa = 0;
  let raw_agreement = 0;
  let expected_agreement = 0;

  if (totalRatings > 0) {
    const W = [
      [1.0, 0.5, 0.0],
      [0.5, 1.0, 0.5],
      [0.0, 0.5, 1.0]
    ];

    const r_totals = [0, 0, 0];
    const c_totals = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        r_totals[i] += O[i][j];
        c_totals[j] += O[i][j];
      }
    }

    const E = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        E[i][j] = (r_totals[i] * c_totals[j]) / totalRatings;
      }
    }

    let Po = 0;
    let Pe = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        Po += W[i][j] * (O[i][j] / totalRatings);
        Pe += W[i][j] * (E[i][j] / totalRatings);
      }
    }

    raw_agreement = Po;
    expected_agreement = Pe;

    if (Pe < 1) {
      weighted_kappa = (Po - Pe) / (1 - Pe);
    } else {
      weighted_kappa = Po === 1 ? 1 : 0;
    }
  }

  let kappa_label = 'Poor';
  if (weighted_kappa >= 0.81) kappa_label = 'Almost Perfect';
  else if (weighted_kappa >= 0.65) kappa_label = 'Substantial';
  else if (weighted_kappa >= 0.41) kappa_label = 'Moderate';
  else if (weighted_kappa >= 0.21) kappa_label = 'Fair';

  return {
    weighted_kappa: parseFloat(weighted_kappa.toFixed(4)),
    kappa_label,
    raw_agreement_pct: parseFloat((raw_agreement * 100).toFixed(2)),
    expected_agreement_pct: parseFloat((expected_agreement * 100).toFixed(2)),
    kappa_warning: weighted_kappa < 0.65
  };
}

/**
 * Calculate precision metrics for Pool B gatekeeper decisions.
 */
export function calculatePoolBPrecision(agreeInclude: number, r1ExcR2Inc: number, r1IncR2Exc: number) {
  const r2_inc_total = agreeInclude + r1ExcR2Inc;
  const r2_precision = r2_inc_total > 0 ? (agreeInclude / r2_inc_total) * 100 : 100;

  const r1_inc_total = agreeInclude + r1IncR2Exc;
  const r1_precision = r1_inc_total > 0 ? (agreeInclude / r1_inc_total) * 100 : 100;

  const r1_prec_parsed = parseFloat(r1_precision.toFixed(2));
  const r2_prec_parsed = parseFloat(r2_precision.toFixed(2));

  return {
    r1_precision: r1_prec_parsed,
    r2_precision: r2_prec_parsed,
    precision_warning: r1_prec_parsed < 85 || r2_prec_parsed < 85
  };
}

/**
 * Calculate Schema Exactness metrics for Pool C data extraction.
 */
export function calculateSchemaExactness(
  totalIntersection: number,
  extractionRulesCount: number,
  missingKeysCount: number,
  typeMatchesCount: number
) {
  const totalKeyChecks = totalIntersection * extractionRulesCount * 2;
  const missingKeysPct = totalKeyChecks > 0 ? (missingKeysCount / totalKeyChecks) * 100 : 0;
  const typeMatchPct = (totalKeyChecks - missingKeysCount) > 0 ? (typeMatchesCount / (totalKeyChecks - missingKeysCount)) * 100 : 100;

  return {
    missing_keys_pct: parseFloat(missingKeysPct.toFixed(2)),
    type_match_pct: parseFloat(typeMatchPct.toFixed(2))
  };
}

/**
 * Render summary string of decisions in discrepancy list row for Pool C.
 */
export function renderPoolCReviewerSummary(qaScoresStr: string, qaRules: any[]): string {
  try {
    const qaScores = JSON.parse(qaScoresStr || '{}');
    let hasFatal = false;
    let score = 0;
    const keys = Object.keys(qaScores);
    for (const k of keys) {
      const val = parseFloat(qaScores[k]?.value || 0);
      score += val;
      const ruleDef = qaRules.find(r => r.code.toLowerCase() === k.toLowerCase());
      const isFatal = ruleDef ? !!ruleDef.is_fatal_flaw : ['qa1', 'qa2', 'qa3', 'qa4', 'qa6'].includes(k.toLowerCase());
      if (isFatal && val === 0) {
        hasFatal = true;
      }
    }
    const meetsCumulative = score >= 4.5;
    const decision = (!hasFatal && meetsCumulative) ? 'Include' : 'Exclude';
    return `${decision} (${score.toFixed(1)}/8.0)`;
  } catch {
    return '—';
  }
}
