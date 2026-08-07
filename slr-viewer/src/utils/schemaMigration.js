/**
 * Central schema versioning and backward compatibility normalization layer for slr-viewer.
 * Supports legacy v1.0.0 files and modern v1.1.0+ exported snapshots.
 */

export const CURRENT_SCHEMA_VERSION = '1.1.0';

export function normalizeViewerSnapshot(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Invalid snapshot payload: Expected JSON object.');
  }

  // 1. Resolve schema version (defaulting to '1.0.0' for legacy files)
  const schemaVersion = rawPayload.schema_version || '1.0.0';
  const isLegacyV1 = schemaVersion === '1.0.0';

  // 2. Validate mandatory top-level structural tags
  const type = rawPayload.type || 'slr-viewer-export';
  if (type !== 'slr-viewer-export') {
    throw new Error('Invalid schema type: Expected "slr-viewer-export".');
  }

  // 3. Normalize section defaults
  const project = rawPayload.project || {};
  const scientificRigor = rawPayload.scientific_rigor || {};
  const prisma = scientificRigor.prisma || {};
  const finalCohort = rawPayload.final_cohort || {};
  const accounting = rawPayload.accounting || {};

  // 4. Schema-aware PRISMA normalization
  const normalizedPrisma = {
    ...prisma,
    dbReportsNotRetrieved: prisma.dbReportsNotRetrieved !== undefined ? prisma.dbReportsNotRetrieved : 0,
    otherReportsNotRetrieved: prisma.otherReportsNotRetrieved !== undefined ? prisma.otherReportsNotRetrieved : 0,
    _schemaVersion: schemaVersion,
    _isLegacy: isLegacyV1,
  };

  return {
    ...rawPayload,
    schema_version: schemaVersion,
    type,
    export_date: rawPayload.export_date || new Date().toISOString(),
    project: {
      ...project,
      name: project.name || 'Untitled Project',
      description: project.description || '',
      scopus_search_string: project.scopus_search_string || project.search_string || '',
      manual_search_string: project.manual_search_string || '',
    },
    scientific_rigor: {
      ...scientificRigor,
      prisma: normalizedPrisma,
      stage_comparisons: scientificRigor.stage_comparisons || [],
      pool_metrics: scientificRigor.pool_metrics || {},
      rolling_batch_qc: scientificRigor.rolling_batch_qc || {},
    },
    final_cohort: {
      ...finalCohort,
      papers: finalCohort.papers || [],
      umbrellanizer_mappings: finalCohort.umbrellanizer_mappings || {},
      total_count: finalCohort.total_count !== undefined ? finalCohort.total_count : (finalCohort.papers ? finalCohort.papers.length : 0),
    },
    accounting: {
      ...accounting,
      summary: accounting.summary || {},
      pipeline_breakdown: accounting.pipeline_breakdown || [],
      top_expensive_calls: accounting.top_expensive_calls || [],
    },
  };
}
