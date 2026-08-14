import type { StatisticalSummary, ErrorBarType } from '../types';
import { extractNumericalValue } from './dataExtractor';

/**
 * Calculates descriptive statistical metrics (Mean, Variance, SD, SE, 95% CI)
 * for a collection of papers against a specified numerical extraction key.
 */
export function computeGroupStatistics(
  papers: any[], 
  numKey: string
): StatisticalSummary {
  if (!papers || papers.length === 0) {
    return {
      mean: 0,
      count: 0,
      variance: 0,
      stdDev: 0,
      stdError: 0,
      ci95Lower: 0,
      ci95Upper: 0,
      min: 0,
      max: 0
    };
  }

  const values: number[] = [];
  papers.forEach(p => {
    const val = extractNumericalValue(p, numKey);
    if (!isNaN(val) && val !== null && val !== undefined) {
      values.push(val);
    }
  });

  const count = values.length;
  if (count === 0) {
    return {
      mean: 0,
      count: 0,
      variance: 0,
      stdDev: 0,
      stdError: 0,
      ci95Lower: 0,
      ci95Upper: 0,
      min: 0,
      max: 0
    };
  }

  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = parseFloat((sum / count).toFixed(2));
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (count === 1) {
    return {
      mean,
      count: 1,
      variance: 0,
      stdDev: 0,
      stdError: 0,
      ci95Lower: mean,
      ci95Upper: mean,
      min,
      max
    };
  }

  // Sample variance (divided by n - 1)
  const sumSquaredDiff = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const variance = parseFloat((sumSquaredDiff / (count - 1)).toFixed(3));
  const stdDev = parseFloat(Math.sqrt(variance).toFixed(2));
  const stdError = parseFloat((stdDev / Math.sqrt(count)).toFixed(2));
  
  // 95% Confidence Interval (t-critical ~ 1.96 approximation for academic figures)
  const margin95 = 1.96 * stdError;
  const ci95Lower = parseFloat(Math.max(0, mean - margin95).toFixed(2));
  const ci95Upper = parseFloat((mean + margin95).toFixed(2));

  return {
    mean,
    count,
    variance,
    stdDev,
    stdError,
    ci95Lower,
    ci95Upper,
    min,
    max
  };
}

/**
 * Resolves the lower and upper bounds of an error bar based on error bar type.
 */
export function getErrorBounds(
  stats: StatisticalSummary, 
  errorType: ErrorBarType
): { lower: number; upper: number } {
  const { mean, stdDev, stdError, ci95Lower, ci95Upper } = stats;
  if (errorType === 'std_dev') {
    return {
      lower: Math.max(0, parseFloat((mean - stdDev).toFixed(2))),
      upper: parseFloat((mean + stdDev).toFixed(2))
    };
  }
  if (errorType === 'ci_95') {
    return {
      lower: ci95Lower,
      upper: ci95Upper
    };
  }
  // Default: std_error
  return {
    lower: Math.max(0, parseFloat((mean - stdError).toFixed(2))),
    upper: parseFloat((mean + stdError).toFixed(2))
  };
}
