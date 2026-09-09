export interface Paper {
  Paper_ID: string;
  Import_Date: string;
  Import_Source: string;
  Source: string;
  DOI: string;
  Title: string;
  Abstract: string;
  Authors: string;
  Year: number | null;
  PDF_Link: string;
  Local_PDF_Status: string;
  Local_PDF_Path: string | null;
  Project_ID?: string | null;
  Parent_Paper_ID?: string | null;
  Parent_Paper_Title?: string | null;
  Original_Publisher?: string | null;
  Publisher?: string | null;
  is_duplicate?: number;
  merged_into_id?: string | null;
  citation_count?: number;
  calibration_pool?: string | null;
  calibration_tag?: string | null;
  semantic_score?: number;
  search_rank?: number;
  notes?: string | null;
  ai_stage?: number;
  ai_decision?: string | null;
  ai_exclusion_code?: string | null;
  ai_rationale?: string | null;
  ai_quality_assessment?: string | Record<string, any> | null;
  ai_extracted_data?: string | Record<string, any> | null;
  manual_stage?: number;
  manual_decision?: string | null;
  manual_exclusion_code?: string | null;
  manual_rationale?: string | null;
  manual_quality_assessment?: string | Record<string, any> | null;
  manual_extracted_data?: string | Record<string, any> | null;
  effective_stage?: number;
  effective_decision?: string | null;
  effective_exclusion_code?: string | null;
  effective_rationale?: string | null;
  is_manual_override?: boolean;
  screening_history?: ScreeningHistoryRecord[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ScreeningHistoryRecord {
  stage: number;
  task_type?: string;
  decision: string;
  exclusion_code?: string | null;
  rationale?: string | null;
  logic_trace?: any;
  quality_assessment?: any;
  extracted_data?: any;
  cost_usd?: number | null;
  total_tokens?: number | null;
  latency_ms?: number | null;
  model_id?: string | null;
  created_at?: string | null;
}

export interface ScreenedCorpusPaper extends Paper {
  prisma_phase?: string;
}

export interface ScreenedCorpus {
  papers: ScreenedCorpusPaper[];
  total_count: number;
  prisma_summary?: {
    total_ingested: number;
    duplicates_removed: number;
    records_screened: number;
    stage1_excluded: number;
    reports_sought: number;
    reports_not_retrieved: number;
    reports_assessed_stage2: number;
    stage2_excluded: number;
    stage3_excluded: number;
    final_included: number;
  };
}

export interface DuplicatePair {
  id: number;
  project_id: string;
  paper1_id: string;
  paper2_id: string;
  similarity_score: number;
  shared_authors_count: number;
  status: 'PENDING' | 'FALSE_FLAG' | 'CONFIRMED_DUPLICATE';
  keep_paper_id?: string | null;
  exclude_paper_id?: string | null;
  created_at: string;
}

export interface SearchQuery {
  id?: string;
  source: string;
  query: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  manifesto?: string;
  objective?: string;
  questions?: string;
  qa_definition?: string;
  exclusion_criteria?: string;
  scopus_search_string?: string;
  manual_search_string?: string;
  search_queries?: string | SearchQuery[];
  pool_a_size?: number;
  pool_b_size?: number;
  pool_c_size?: number;
  gdrive_dest_path?: string;
  goldmine_dest_path?: string;
  cloud_provider?: 'gdrive' | 'onedrive';
  rclone_remote_name?: string;
  pool_tags?: string | {
    pool_a: { code: string; label: string }[];
    pool_b: { code: string; label: string }[];
    pool_c: { code: string; label: string }[];
  };
  ec_rules?: string | { code: string; description: string }[];
  reasoning_template?: string | string[];
  pool_b_ec_rules?: string | { code: string; description: string }[];
  pool_b_reasoning_template?: string | string[];
  pool_c_qa_rules?: string | { code: string; question: string; is_fatal_flaw?: boolean; score_0_logic?: string; score_05_logic?: string; score_1_logic?: string }[];
  pool_c_extraction_rules?: string | { json_key: string; question: string }[];
  stats?: any;
  Pool_A_Tags?: any;
  Pool_B_Tags?: any;
  Pool_C_Tags?: any;
}

// --- Backend Service Interfaces ---
export interface ProcessExecutionState {
  isExecuting: boolean;
  pid: number | null;
  startTime: number | null;
  checkedCount: number;
  foundCount: number;
  notFoundCount: number;
  currentTitle: string;
  averageSpeed: string;
  timeRemaining: string;
}

export interface BatchStreamEvent {
  type: 'scanning' | 'skipped' | 'success' | 'error' | 'heartbeat' | 'indexing' | 'stats';
  title?: string;
  id?: string;
  doi?: string;
  message?: string;
  tool?: string;
  stats?: Partial<ProcessExecutionState>;
}

export interface CancellationFlag {
  isCanceled: boolean;
  cancelReason?: string;
  canceledAt?: number;
}

export interface ProcessOrchestratorConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

// --- Modal Orchestration Interfaces ---
export interface ModalOrchestratorState {
  viewEditPaperOpen: boolean;
  deletePaperConfirmOpen: boolean;
  deleteProjectConfirmOpen: boolean;
  deleteAllPapersConfirmOpen: boolean;
  activePaperId: string | null;
}

export interface ModalActionPayload {
  action: 'OPEN' | 'CLOSE' | 'TOGGLE';
  modalName: keyof ModalOrchestratorState;
  contextData?: any;
}

export interface DeleteConfirmationConfig {
  entityId: string;
  entityTitle: string;
  confirmationRequired: boolean;
  expectedMatchText?: string;
}

// --- Dashboard Widget Interfaces ---
export interface DashboardMetricSummary {
  totalPapers: number;
  availablePdfs: number;
  missingPdfs: number;
  duplicatesCount: number;
  completionRate: number;
}

export interface LocalPDFChartData {
  status: 'AVAILABLE' | 'MISSING' | 'FAILED' | 'EXCLUDED';
  count: number;
  color: string;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  type: 'IMPORT' | 'BATCH' | 'RESOLVE' | 'DELETE' | 'PROJECT';
  summary: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
}

// --- Inter-Rater Domain Contracts ---
export interface RaterDecision {
  raterId: string;
  paperId: string;
  decision: string;
  rationale?: string;
  qaScores?: Record<string, number>;
  extractedData?: Record<string, any>;
}

export interface RaterConflict {
  paperId: string;
  paperTitle: string;
  rater1Decision: string;
  rater2Decision: string;
  conflictType: 'DECISION' | 'QA_SCORE' | 'EXTRACTION';
}

export interface AdjudicationScorecard {
  conflictId: string;
  paperId: string;
  raterChoices: Record<string, any>;
  resolvedDecision?: string;
  adjudicatorNotes?: string;
}

export interface ExtractionComparison {
  fieldKey: string;
  rater1Value: any;
  rater2Value: any;
  isMatch: boolean;
  mergedValue?: any;
}

export interface AgreementMetricSummary {
  cohenKappa: number;
  overallAgreementPercentage: number;
  totalPairsEvaluated: number;
  disagreementsCount: number;
  kappaInterpretation: 'Slight' | 'Fair' | 'Moderate' | 'Substantial' | 'Almost Perfect';
}

export interface CalibrationDiscrepancy {
  paper_id: string;
  title: string;
  abstract?: string;
  local_pdf_path?: string | null;
  authors?: string;
  year?: number | null;
  doi?: string | null;
  source?: string;
  pdf_link?: string;
  publisher?: string;
  r1_name?: string;
  r2_name?: string;
  r1_decision?: string;
  r2_decision?: string;
  r1_rationale?: string;
  r2_rationale?: string;
  r1_ec?: string | null;
  r2_ec?: string | null;
  r1_qa_scores?: string | Record<string, any>;
  r2_qa_scores?: string | Record<string, any>;
  r1_extracted_data?: string | Record<string, any>;
  r2_extracted_data?: string | Record<string, any>;
  resolved_decision?: string | null;
  resolved_ec?: string | null;
  resolved_rationale?: string | null;
  resolved_qa_scores?: string | Record<string, any> | null;
  resolved_extracted_data?: string | Record<string, any> | null;
  is_resolved?: boolean;
}

export interface CalibrationLedgerEntry {
  id: number;
  commit_hash: string;
  project_id: string;
  paper_id: string;
  pool: string;
  adjudicator: string;
  previous_state: string;
  resolved_decision?: string;
  resolved_ec?: string | null;
  resolved_rationale?: string;
  resolved_qa_scores?: string;
  resolved_extracted_data?: string;
  commit_message: string;
  timestamp: string;
}

export interface RollingBatchDetail {
  id: string;
  batch_number: number;
  status: string;
  created_at: string;
  finalized_at?: string | null;
  reviewers?: Array<{ reviewer_name: string; count?: number; papers_reviewed?: number }>;
  papers: any[];
  decisions: any[];
  discrepancies: any[];
  ledger: CalibrationLedgerEntry[];
}

