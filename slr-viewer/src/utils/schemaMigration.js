/**
 * Central schema versioning and backward compatibility normalization layer for slr-viewer.
 * Supports legacy v1.0.0 files and modern v1.1.0+ exported snapshots.
 */

export const CURRENT_SCHEMA_VERSION = '1.1.0';

function inferPromptType(tpl) {
  if (tpl && tpl.prompt_type && typeof tpl.prompt_type === 'string' && tpl.prompt_type.trim()) {
    return tpl.prompt_type.trim();
  }
  const name = (tpl?.name || tpl?.id || '').toLowerCase();
  const schemaStr = (typeof tpl?.response_schema === 'string' ? tpl.response_schema : JSON.stringify(tpl?.response_schema || {})).toLowerCase();

  if (schemaStr.includes('taxonomy_mapping') || name.includes('umbrellanizer')) {
    return 'umbrellanizer';
  }
  if (schemaStr.includes('qa_scores') || name.includes('scientist')) {
    return 'scientist';
  }
  if (schemaStr.includes('extracted_data') || name.includes('miner')) {
    return 'miner';
  }
  if (name.includes('gatekeeper') || schemaStr.includes('gate_4') || schemaStr.includes('eligibility')) {
    return 'gatekeeper';
  }
  if (name.includes('fast_filter') || name.includes('screening') || name.includes('filter')) {
    return 'fast_filter';
  }
  return 'fast_filter';
}

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

  // 5. Prompt templates normalization & prompt_type inferral
  const rawTemplates = rawPayload.prompt_templates || project.prompt_templates || [];
  const normalizedPromptTemplates = Array.isArray(rawTemplates)
    ? rawTemplates.map(tpl => ({
        ...tpl,
        prompt_type: inferPromptType(tpl),
      }))
    : [];

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
      prompt_templates: normalizedPromptTemplates,
    },
    prompt_templates: normalizedPromptTemplates,
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
