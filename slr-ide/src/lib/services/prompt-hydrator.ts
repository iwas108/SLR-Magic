/**
 * Centralized Prompt Template Hydrator
 * 
 * Provides unified, case-insensitive variable hydration matching Python Jinja2
 * template conventions across all SLR pipeline stages, audits, and prompt optimization engines.
 */

export interface HydrationContext {
  project?: Record<string, any>;
  paper?: Record<string, any>;
  custom?: Record<string, any>;
  [key: string]: any;
}

/**
 * Builds a flat, normalized dictionary of all available variables and aliases.
 */
export function buildHydrationDictionary(context: HydrationContext): Record<string, string> {
  const dict: Record<string, string> = {};

  const sanitizeVal = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  const setAlias = (keys: string[], val: any) => {
    const str = sanitizeVal(val);
    for (const k of keys) {
      dict[k.toLowerCase()] = str;
    }
  };

  // 1. Process Project Context
  const proj = context.project || {};
  if (proj && typeof proj === 'object') {
    setAlias(['project_name', 'project.name', 'project_title', 'project.title', 'name'], proj.name || proj.project_name);
    setAlias(['project_manifesto', 'project.manifesto', 'manifesto', 'research_manifesto', 'project_scope'], proj.manifesto);
    setAlias(['project_objective', 'project.objective', 'objective', 'research_objective'], proj.objective);
    setAlias(['project_questions', 'project.questions', 'questions', 'research_questions'], proj.questions);
    setAlias(['project_qa_rules', 'project.qa_rules', 'qa_rules', 'pool_c_qa_rules', 'project.pool_c_qa_rules'], proj.pool_c_qa_rules || proj.qa_rules);
    setAlias(['project_ec_rules', 'project.ec_rules', 'ec_rules', 'exclusion_criteria', 'project.ec_rules'], proj.ec_rules || proj.pool_b_ec_rules);
    setAlias(['project_reasoning_template', 'project.reasoning_template', 'reasoning_template'], proj.reasoning_template || proj.pool_b_reasoning_template);
    setAlias(['project_extraction_rules', 'project.extraction_rules', 'extraction_rules', 'pool_c_extraction_rules'], proj.pool_c_extraction_rules);

    // Direct key iteration
    for (const [k, v] of Object.entries(proj)) {
      setAlias([`project_${k}`, `project.${k}`, k], v);
    }
  }

  // 2. Process Paper Context
  const paper = context.paper || {};
  if (paper && typeof paper === 'object') {
    setAlias(['paper_id', 'paper.id', 'id', 'paperid'], paper.Paper_ID || paper.id || paper.paper_id);
    setAlias(['paper_title', 'paper.title', 'title'], paper.Title || paper.title);
    setAlias(['paper_abstract', 'paper.abstract', 'abstract'], paper.Abstract || paper.abstract);
    setAlias(['paper_doi', 'paper.doi', 'doi'], paper.DOI || paper.doi);
    setAlias(['paper_authors', 'paper.authors', 'authors'], paper.Authors || paper.authors);
    setAlias(['paper_year', 'paper.year', 'year'], paper.Year || paper.year);
    setAlias(['paper_source', 'paper.source', 'source'], paper.Source || paper.source || paper.Import_Source);
    setAlias(['pdf_link', 'paper.pdf_link', 'local_pdf_path', 'paper.local_pdf_path'], paper.Local_PDF_Path || paper.PDF_Link);

    for (const [k, v] of Object.entries(paper)) {
      setAlias([`paper_${k}`, `paper.${k}`, k], v);
    }
  }

  // 3. Process Umbrellanizer Context
  if (context.raw_tokens_with_context || context.umbrellanizer_rich_tokens_context || context.raw_tokens || context.target_variable) {
    setAlias(['raw_tokens_with_context', 'umbrellanizer_rich_tokens_context', 'rich_tokens_context'], context.raw_tokens_with_context || context.umbrellanizer_rich_tokens_context);
    setAlias(['raw_tokens', 'umbrellanizer_raw_tokens_array', 'raw_tokens_array'], context.raw_tokens || context.umbrellanizer_raw_tokens_array);
    setAlias(['target_variable', 'umbrellanizer_target_research_question', 'target_variable_name'], context.target_variable || context.umbrellanizer_target_research_question);
    setAlias(['target_variable_description', 'umbrellanizer_target_research_question_description'], context.target_variable_description || context.umbrellanizer_target_research_question_description);
  }

  // 4. Process Custom or Sibling Stage Context
  const custom = context.custom || {};
  if (custom && typeof custom === 'object') {
    for (const [k, v] of Object.entries(custom)) {
      setAlias([k], v);
    }
  }

  // 5. Direct top-level context properties
  for (const [k, v] of Object.entries(context)) {
    if (k !== 'project' && k !== 'paper' && k !== 'custom') {
      setAlias([k], v);
    }
  }

  return dict;
}

/**
 * Hydrates a template string containing {{ variable }} placeholders.
 * Supports Jinja2 and Mustache tags with flexible whitespace: {{ variable }}, {{variable}}
 */
export function hydrateTemplate(templateStr: string | null | undefined, context: HydrationContext): string {
  if (!templateStr || typeof templateStr !== 'string') {
    return '';
  }

  const dict = buildHydrationDictionary(context);

  // Replace {{ key }} and {{key}} case-insensitively
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g, (match, key) => {
    const cleanKey = key.toLowerCase();
    if (cleanKey in dict && dict[cleanKey] !== '') {
      return dict[cleanKey];
    }
    return '';
  });
}
