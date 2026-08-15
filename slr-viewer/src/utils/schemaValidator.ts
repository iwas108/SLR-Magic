/**
 * Strict schema validation and version enforcement layer for SLR Viewer.
 * Requires schema_version >= 1.1.0 and strict top-level structural integrity.
 */

export const MINIMUM_SCHEMA_VERSION = '1.1.0';

export interface SchemaValidationDetails {
  detectedVersion?: string;
  requiredVersion?: string;
  missingKeys?: string[];
  isOutdated?: boolean;
  [key: string]: any;
}

export class SchemaValidationError extends Error {
  detectedVersion: string;
  requiredVersion: string;
  missingKeys: string[];
  isOutdated: boolean;
  details: SchemaValidationDetails;

  constructor(message: string, details: SchemaValidationDetails = {}) {
    super(message);
    this.name = 'SchemaValidationError';
    this.detectedVersion = details.detectedVersion || 'Unknown / Legacy';
    this.requiredVersion = details.requiredVersion || MINIMUM_SCHEMA_VERSION;
    this.missingKeys = details.missingKeys || [];
    this.isOutdated = !!details.isOutdated;
    this.details = details;
  }
}

/**
 * Compare two semver strings (e.g. '1.1.0' vs '1.0.6').
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  if (!v1 || typeof v1 !== 'string') return -1;
  if (!v2 || typeof v2 !== 'string') return 1;

  const p1 = v1.replace(/^v/, '').split('.').map(Number);
  const p2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const num1 = isNaN(p1[i]) ? 0 : p1[i];
    const num2 = isNaN(p2[i]) ? 0 : p2[i];
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Validates the raw JSON payload against SLR Viewer v1.1.0+ specifications.
 * Throws SchemaValidationError if invalid or outdated.
 */
export function validateViewerSnapshot(rawPayload: any): any {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new SchemaValidationError('Invalid snapshot payload: Expected a valid JSON object.', {
      detectedVersion: 'Invalid JSON',
      requiredVersion: MINIMUM_SCHEMA_VERSION
    });
  }

  // 1. Validate mandatory payload type
  if (rawPayload.type !== 'slr-viewer-export') {
    throw new SchemaValidationError(
      `Invalid snapshot type: Expected "slr-viewer-export", received "${rawPayload.type || 'undefined'}".`,
      {
        detectedVersion: rawPayload.schema_version || 'Unknown',
        requiredVersion: MINIMUM_SCHEMA_VERSION
      }
    );
  }

  // 2. Validate strict schema version (>= 1.1.0)
  const detectedVersion = rawPayload.schema_version;
  if (!detectedVersion || compareSemver(detectedVersion, MINIMUM_SCHEMA_VERSION) < 0) {
    throw new SchemaValidationError(
      `Outdated schema version: Detected v${detectedVersion || '1.0.0 (legacy)'}, but SLR Viewer strictly requires v${MINIMUM_SCHEMA_VERSION}+. Please re-export your project from SLR IDE.`,
      {
        detectedVersion: detectedVersion || '1.0.0 (legacy)',
        requiredVersion: MINIMUM_SCHEMA_VERSION,
        isOutdated: true
      }
    );
  }

  // 3. Validate mandatory top-level sections
  const requiredSections = ['project', 'scientific_rigor', 'final_cohort', 'accounting'];
  const missingKeys = requiredSections.filter(sec => !rawPayload[sec] || typeof rawPayload[sec] !== 'object');

  if (missingKeys.length > 0) {
    throw new SchemaValidationError(
      `Corrupted snapshot structure: Missing required top-level section(s): ${missingKeys.join(', ')}.`,
      {
        detectedVersion,
        requiredVersion: MINIMUM_SCHEMA_VERSION,
        missingKeys
      }
    );
  }

  // 4. Validate final cohort structure
  if (!Array.isArray(rawPayload.final_cohort?.papers)) {
    throw new SchemaValidationError(
      'Corrupted final cohort data: Expected "final_cohort.papers" to be an array.',
      {
        detectedVersion,
        requiredVersion: MINIMUM_SCHEMA_VERSION,
        missingKeys: ['final_cohort.papers']
      }
    );
  }

  // 5. Clean / sanitized normalized return payload
  const project = rawPayload.project || {};
  const scientificRigor = rawPayload.scientific_rigor || {};
  const prisma = scientificRigor.prisma || {};
  const finalCohort = rawPayload.final_cohort || {};
  const accounting = rawPayload.accounting || {};
  const promptTemplates = rawPayload.prompt_templates || project.prompt_templates || [];

  return {
    ...rawPayload,
    schema_version: detectedVersion,
    type: 'slr-viewer-export',
    export_date: rawPayload.export_date || new Date().toISOString(),
    project: {
      ...project,
      name: project.name || 'Untitled Project',
      description: project.description || '',
      scopus_search_string: project.scopus_search_string || project.search_string || '',
      manual_search_string: project.manual_search_string || '',
      prompt_templates: promptTemplates,
    },
    prompt_templates: promptTemplates,
    scientific_rigor: {
      ...scientificRigor,
      prisma: {
        ...prisma,
        dbReportsNotRetrieved: prisma.dbReportsNotRetrieved !== undefined ? prisma.dbReportsNotRetrieved : 0,
        otherReportsNotRetrieved: prisma.otherReportsNotRetrieved !== undefined ? prisma.otherReportsNotRetrieved : 0,
      },
      stage_comparisons: scientificRigor.stage_comparisons || [],
      pool_metrics: scientificRigor.pool_metrics || {},
      rolling_batch_qc: scientificRigor.rolling_batch_qc || {},
    },
    final_cohort: {
      ...finalCohort,
      papers: finalCohort.papers || [],
      umbrellanizer_mappings: finalCohort.umbrellanizer_mappings || {},
      total_count: finalCohort.total_count !== undefined ? finalCohort.total_count : finalCohort.papers.length,
    },
    accounting: {
      ...accounting,
      summary: accounting.summary || {},
      pipeline_breakdown: accounting.pipeline_breakdown || [],
      top_expensive_calls: accounting.top_expensive_calls || [],
    },
  };
}

/**
 * Non-throwing safe validation helper.
 */
export function validateViewerSnapshotSafe(rawPayload: any): {
  isValid: boolean;
  data: any;
  error: string | null;
  detectedVersion?: string;
  requiredVersion?: string;
  missingKeys?: string[];
  isOutdated?: boolean;
  details?: SchemaValidationDetails;
} {
  try {
    const data = validateViewerSnapshot(rawPayload);
    return { isValid: true, data, error: null };
  } catch (err: any) {
    return {
      isValid: false,
      data: null,
      error: err.message,
      detectedVersion: err.detectedVersion || 'Unknown',
      requiredVersion: err.requiredVersion || MINIMUM_SCHEMA_VERSION,
      missingKeys: err.missingKeys || [],
      isOutdated: err.isOutdated || false,
      details: err.details || {}
    };
  }
}
