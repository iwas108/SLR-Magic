import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Layers,
  CheckSquare,
  GitCommit,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Copy,
  Check,
  ExternalLink,
  Scale
} from 'lucide-react';
import BatchStatisticsCards from './BatchStatisticsCards';
import AdjudicationInspectionModal from './AdjudicationInspectionModal';
import { renderPoolCReviewerSummary } from '@/lib/inter-rater/adjudication-calculations';

function formatDateSafe(val: any): string {
  if (!val) return '—';
  let str = String(val).trim();
  if (!str || str === 'undefined' || str === 'null') return '—';
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
}

interface RollingBatchPanelProps {
  rollingBatchQC?: any;
  projectConfig?: any;
}

export default function RollingBatchPanel({ rollingBatchQC, projectConfig }: RollingBatchPanelProps) {
  if (!rollingBatchQC) {
    return (
      <div className="text-center py-6 text-muted-foreground text-xs">
        No rolling batch sequential QC data available in this snapshot.
      </div>
    );
  }

  const {
    batches = [],
    overall_status,
    exit_triggered,
    cumulative_stats,
    individual_batch_stats = [],
    audit_passed = false,
    batch_details = {}
  } = rollingBatchQC;

  const completedBatches = batches.filter((b: any) => b.status === 'PASSED' || b.status === 'complete');
  const batchesCount = completedBatches.length > 0 ? completedBatches.length : (batches.length > 0 ? batches.length : 0);

  // State for Batch Explorer
  const [selectedBatchId, setSelectedBatchId] = useState<any>(batches[0]?.id || batches[0]?.batch_number || null);
  const [activeSubTab, setActiveSubTab] = useState<'papers' | 'ledger'>('papers');
  const [filterMode, setFilterMode] = useState<'all' | 'conflicts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Modal inspection state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Find active batch object and details
  const activeBatch = batches.find(
    (b: any) => b.id === selectedBatchId || b.batch_number === selectedBatchId
  ) || batches[0];

  const activeBatchDetail = (activeBatch && (
    batch_details[activeBatch.id] ||
    batch_details[String(activeBatch.batch_number)] ||
    activeBatch
  )) || {};

  // Parse project rules for modal
  const qaRules = useMemo(() => {
    if (!projectConfig?.pool_c_qa_rules) return [];
    try {
      return typeof projectConfig.pool_c_qa_rules === 'string'
        ? JSON.parse(projectConfig.pool_c_qa_rules)
        : projectConfig.pool_c_qa_rules;
    } catch {
      return [];
    }
  }, [projectConfig]);

  const extractionRules = useMemo(() => {
    if (!projectConfig?.pool_c_extraction_rules) return [];
    try {
      return typeof projectConfig.pool_c_extraction_rules === 'string'
        ? JSON.parse(projectConfig.pool_c_extraction_rules)
        : projectConfig.pool_c_extraction_rules;
    } catch {
      return [];
    }
  }, [projectConfig]);

  const ecRules = useMemo(() => {
    const raw = projectConfig?.exclusion_criteria || projectConfig?.ec_rules || projectConfig?.pool_b_ec_rules;
    if (!raw) return [];
    try {
      return typeof raw === 'string' && raw.includes('[') ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [projectConfig]);

  // Pair up sampled papers with decisions and discrepancies
  const pairedBatchPapers = useMemo(() => {
    if (!activeBatchDetail) return [];
    if (activeBatchDetail.all_papers && activeBatchDetail.all_papers.length > 0) {
      return activeBatchDetail.all_papers;
    }

    const rawPapers = activeBatchDetail.papers || [];
    const decisions = activeBatchDetail.decisions || [];
    const paperDecisionsMap: Record<string, any[]> = {};
    for (const d of decisions) {
      if (!paperDecisionsMap[d.paper_id]) paperDecisionsMap[d.paper_id] = [];
      paperDecisionsMap[d.paper_id].push(d);
    }

    if (rawPapers.length === 0 && activeBatchDetail.discrepancies && activeBatchDetail.discrepancies.length > 0) {
      return activeBatchDetail.discrepancies;
    }

    return rawPapers.map((p: any) => {
      const decs = (paperDecisionsMap[p.Paper_ID] || []).sort((a: any, b: any) =>
        (a.reviewer_name || '').localeCompare(b.reviewer_name || '')
      );
      const r1 = decs[0];
      const r2 = decs[1];
      const hasDiff = r1 && r2 ? (r1.qa_scores !== r2.qa_scores || r1.extracted_data !== r2.extracted_data) : false;
      const isPending = p.manual_decision === 'PENDING_ADJUDICATION' || p.manual_decision === null;

      return {
        paper_id: p.Paper_ID,
        title: p.Title || p.Paper_ID,
        abstract: p.Abstract || '',
        local_pdf_path: p.Local_PDF_Path || null,
        authors: p.Authors || '',
        year: p.Year || null,
        doi: p.DOI || null,
        source: p.Source || '',
        pdf_link: p.PDF_Link || '',
        publisher: p.Publisher || '',
        r1_name: r1?.reviewer_name || 'Reviewer Alpha',
        r1_qa_scores: r1?.qa_scores || '{}',
        r1_extracted_data: r1?.extracted_data || '{}',
        r2_name: r2?.reviewer_name || 'Reviewer Beta',
        r2_qa_scores: r2?.qa_scores || '{}',
        r2_extracted_data: r2?.extracted_data || '{}',
        resolved_decision: p.manual_decision || null,
        resolved_ec: p.manual_exclusion_code || null,
        resolved_rationale: p.manual_rationale || null,
        resolved_qa_scores: p.manual_quality_assessment || null,
        resolved_extracted_data: p.manual_extracted_data || null,
        is_resolved: !isPending,
        has_discrepancy: hasDiff
      };
    });
  }, [activeBatchDetail]);

  const batchDiscrepancies = useMemo(() => {
    if (activeBatchDetail?.discrepancies && activeBatchDetail.discrepancies.length > 0) {
      return activeBatchDetail.discrepancies;
    }
    return pairedBatchPapers.filter((p: any) => p.has_discrepancy);
  }, [activeBatchDetail, pairedBatchPapers]);

  const activeBatchLedger = activeBatchDetail?.ledger || [];

  // Filter papers based on view mode (conflicts vs all) and search
  const displayedBatchPapers = filterMode === 'conflicts'
    ? (batchDiscrepancies.length > 0 ? batchDiscrepancies : pairedBatchPapers.filter((p: any) => p.has_discrepancy))
    : pairedBatchPapers;

  const filteredBatchPapers = displayedBatchPapers.filter((paper: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (paper.paper_id && String(paper.paper_id).toLowerCase().includes(q)) ||
      (paper.title && String(paper.title).toLowerCase().includes(q)) ||
      (paper.authors && String(paper.authors).toLowerCase().includes(q)) ||
      (paper.doi && String(paper.doi).toLowerCase().includes(q))
    );
  });

  const openInspection = (paper: any) => {
    setSelectedPaper(paper);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Cumulative Stats Row */}
      <div className="space-y-2 select-none">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sequential Audit Progress</h4>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            audit_passed 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {audit_passed ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Sequential Audit Complete (Satisfied)
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                Sequential Audit In Progress (Unsatisfied)
              </>
            )}
          </span>
        </div>

        <BatchStatisticsCards 
          stats={cumulative_stats} 
          auditPassed={audit_passed} 
          batchesCount={batchesCount}
        />
      </div>

      {/* 2. Historical Batch Breakdown */}
      {(completedBatches.length > 0 || batches.length > 0) && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider">Historical Batch Performance</h3>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Finalized Date</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: Agreement</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: CI Lower</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: Miss Rate</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: Schema Integrity</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: CI Lower</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: Semantic Agreement</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {batches.map((batch: any) => {
                  const indStats = individual_batch_stats.find(
                    (s: any) => s.batchId === batch.id || s.batchNumber === batch.batch_number
                  )?.stats;

                  const batchStats = indStats || cumulative_stats;
                  const isPassed = batchStats?.s3?.passed !== false && batchStats?.s4?.passed !== false;
                  
                  return (
                    <tr key={batch.id || batch.batch_number} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold">#{batch.batch_number}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {formatDateSafe(batch.finalized_at || batch.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        {batchStats?.s3?.p_hat !== undefined ? `${(batchStats.s3.p_hat * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                        {batchStats?.s3?.CI_lower !== undefined ? `${(batchStats.s3.CI_lower * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {batchStats?.s3?.critical_miss_rate !== undefined ? (
                          <span className={batchStats.s3.critical_miss_rate === 0 ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-destructive font-semibold"}>
                            {batchStats.s3.critical_miss_rate.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        {batchStats?.s4?.schema_integrity_rate !== undefined 
                          ? `${batchStats.s4.schema_integrity_rate.toFixed(1)}%` 
                          : (batchStats?.s4?.schema_integrity !== undefined ? `${batchStats.s4.schema_integrity.toFixed(1)}%` : '—')}
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                        {batchStats?.s4?.CI_lower !== undefined ? `${(batchStats.s4.CI_lower * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {batchStats?.s4?.semantic_agreement !== undefined ? (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            {batchStats.s4.semantic_agreement.toFixed(1)}%
                          </span>
                        ) : (batchStats?.s4?.exact_match !== undefined ? (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            {batchStats.s4.exact_match.toFixed(1)}%
                          </span>
                        ) : '—')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPassed 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {isPassed ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Interactive Rolling Batch Adjudication & Micro-Audit Explorer */}
      {batches.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          {/* Header with Batch Selector Pills & Sub-Tab Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 mr-2">
                <Scale className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                  Rolling Batch Adjudication Explorer
                </h4>
              </div>

              {/* Batch Pills */}
              <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border/70 text-xs font-semibold overflow-x-auto">
                {batches.map((batch: any) => {
                  const bId = batch.id || batch.batch_number;
                  const isSelected = selectedBatchId === bId;
                  return (
                    <button
                      key={bId}
                      type="button"
                      onClick={() => setSelectedBatchId(bId)}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-card text-foreground font-bold shadow-xs border border-border/80'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Batch #{batch.batch_number} ({batch.papers_count || 20})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sub-Tabs: Sampled Papers vs Audit Ledger */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <div className="flex items-center bg-secondary/60 p-1 rounded-xl border border-border text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('papers')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeSubTab === 'papers'
                      ? 'bg-card text-foreground font-bold shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Sampled Papers &amp; Discrepancies</span>
                  <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-secondary text-foreground">
                    {pairedBatchPapers.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('ledger')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeSubTab === 'ledger'
                      ? 'bg-card text-foreground font-bold shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Batch Ledger</span>
                  <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-secondary text-foreground">
                    {activeBatchLedger.length}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Sub-Tab 1: Sampled Papers & Discrepancies Table */}
          {activeSubTab === 'papers' && (
            <div className="space-y-4">
              {/* Toolbar: Filter Toggle & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Filter:</span>
                  <div className="flex items-center bg-secondary/50 p-0.5 rounded-lg border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterMode('conflicts')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        filterMode === 'conflicts'
                          ? 'bg-card text-foreground shadow-2xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Conflicts Only ({batchDiscrepancies.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-card text-foreground shadow-2xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All Sampled Papers ({pairedBatchPapers.length})
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter by ID, Title, DOI..."
                    className="w-full bg-secondary/40 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Sampled Papers Table */}
              {filteredBatchPapers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                  {filterMode === 'conflicts' && batchDiscrepancies.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <span className="font-bold text-foreground">Zero Discrepancies in Batch #{activeBatch?.batch_number}</span>
                      <span className="text-[11px]">Both independent reviewers agreed identically on all 20 sampled papers.</span>
                    </div>
                  ) : (
                    <span>No papers match your search query in this batch.</span>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold text-[11px]">
                        <th className="py-2.5 px-3">Paper ID &amp; Title</th>
                        <th className="py-2.5 px-3">Reviewer Alpha</th>
                        <th className="py-2.5 px-3">Reviewer Beta</th>
                        <th className="py-2.5 px-3">Adjudicated Consensus</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredBatchPapers.map((paper: any) => {
                        const r1Summary = renderPoolCReviewerSummary(paper.r1_qa_scores, qaRules);
                        const r2Summary = renderPoolCReviewerSummary(paper.r2_qa_scores, qaRules);
                        
                        let resolvedSummary = 'Pending';
                        if (paper.resolved_qa_scores) {
                          resolvedSummary = renderPoolCReviewerSummary(paper.resolved_qa_scores, qaRules);
                        } else if (paper.resolved_decision) {
                          resolvedSummary = paper.resolved_decision;
                          if (paper.resolved_ec) resolvedSummary += ` (${paper.resolved_ec})`;
                        }

                        const isConflict = paper.has_discrepancy ||
                          paper.r1_qa_scores !== paper.r2_qa_scores ||
                          paper.r1_extracted_data !== paper.r2_extracted_data;

                        const isResolved = paper.is_resolved || !!paper.resolved_decision || !!paper.resolved_qa_scores;

                        return (
                          <tr key={paper.paper_id} className="hover:bg-muted/20 transition-colors">
                            {/* Paper ID & Title */}
                            <td className="py-3 px-3 max-w-xs sm:max-w-md">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-primary text-[11px] shrink-0">
                                  {paper.paper_id}
                                </span>
                                {paper.year && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    ({paper.year})
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-foreground text-[11px] truncate mt-0.5" title={paper.title}>
                                {paper.title || 'Untitled Paper'}
                              </div>
                              {paper.doi && (
                                <a
                                  href={`https://doi.org/${paper.doi}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5"
                                >
                                  <span className="truncate max-w-xs">{paper.doi}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              )}
                            </td>

                            {/* Reviewer Alpha */}
                            <td className="py-3 px-3 font-mono text-[11px]">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                r1Summary.startsWith('INC') || r1Summary.startsWith('Include')
                                  ? 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                                  : r1Summary.startsWith('EXC') || r1Summary.startsWith('Exclude')
                                  ? 'bg-rose-500/15 text-rose-950 dark:text-rose-300 border border-rose-500/30'
                                  : 'bg-secondary text-muted-foreground border border-border'
                              }`}>
                                {r1Summary}
                              </span>
                              <div className="text-[9px] text-muted-foreground font-sans mt-0.5">
                                {paper.r1_name || 'Reviewer Alpha'}
                              </div>
                            </td>

                            {/* Reviewer Beta */}
                            <td className="py-3 px-3 font-mono text-[11px]">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                r2Summary.startsWith('INC') || r2Summary.startsWith('Include')
                                  ? 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                                  : r2Summary.startsWith('EXC') || r2Summary.startsWith('Exclude')
                                  ? 'bg-rose-500/15 text-rose-950 dark:text-rose-300 border border-rose-500/30'
                                  : 'bg-secondary text-muted-foreground border border-border'
                              }`}>
                                {r2Summary}
                              </span>
                              <div className="text-[9px] text-muted-foreground font-sans mt-0.5">
                                {paper.r2_name || 'Reviewer Beta'}
                              </div>
                            </td>

                            {/* Adjudicated Consensus */}
                            <td className="py-3 px-3 font-mono text-[11px]">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                resolvedSummary.startsWith('INC') || resolvedSummary.startsWith('Include')
                                  ? 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                                  : resolvedSummary.startsWith('EXC') || resolvedSummary.startsWith('Exclude')
                                  ? 'bg-rose-500/15 text-rose-950 dark:text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-950 dark:text-amber-300 border border-amber-500/30'
                              }`}>
                                <ShieldCheck className="w-3 h-3" />
                                {resolvedSummary}
                              </span>
                              {paper.resolved_rationale && (
                                <p className="text-[10px] text-muted-foreground font-sans line-clamp-1 mt-1 max-w-xs italic" title={paper.resolved_rationale}>
                                  &ldquo;{paper.resolved_rationale}&rdquo;
                                </p>
                              )}
                            </td>

                            {/* Status Badge */}
                            <td className="py-3 px-3 text-center">
                              {!isConflict ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Agreed
                                </span>
                              ) : isResolved ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                                  <ShieldCheck className="w-2.5 h-2.5" /> Arbitrated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Conflict
                                </span>
                              )}
                            </td>

                            {/* Action Button */}
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => openInspection(paper)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border hover:border-primary/40 transition-all cursor-pointer"
                                title="Inspect Batch Paper Adjudication"
                              >
                                <Eye className="w-3.5 h-3.5 text-primary" />
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Batch Audit Ledger */}
          {activeSubTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Cryptographically Signed Batch Commit Ledger ({activeBatchLedger.length} commits)
                </span>
                <span>Batch #{activeBatch?.batch_number}</span>
              </div>

              {activeBatchLedger.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                  <GitCommit className="w-6 h-6 text-muted-foreground/60 mx-auto mb-1.5" />
                  <span>No audit commits recorded for Batch #{activeBatch?.batch_number} yet.</span>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold text-[11px]">
                        <th className="py-2.5 px-3">Commit Hash</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Paper ID</th>
                        <th className="py-2.5 px-3">Adjudicator</th>
                        <th className="py-2.5 px-3">Commit Message</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {activeBatchLedger.map((entry: any) => {
                        const shortHash = (entry.commit_hash || '').slice(0, 7);
                        const isCopied = copiedHash === entry.commit_hash;
                        const matchingPaper = pairedBatchPapers.find((p: any) => p.paper_id === entry.paper_id);

                        return (
                          <tr key={entry.id || entry.commit_hash} className="hover:bg-muted/20 transition-colors">
                            {/* Hash */}
                            <td className="py-3 px-3 font-mono font-bold">
                              <div className="flex items-center gap-1.5">
                                <span className="text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded text-[10px]">
                                  {shortHash}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyHash(entry.commit_hash)}
                                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                                  title="Copy Full Commit Hash"
                                >
                                  {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>

                            {/* Timestamp */}
                            <td className="py-3 px-3 text-muted-foreground text-[11px] whitespace-nowrap">
                              {formatDateSafe(entry.timestamp)}
                            </td>

                            {/* Paper ID */}
                            <td className="py-3 px-3 font-mono font-semibold text-foreground">
                              {entry.paper_id}
                            </td>

                            {/* Adjudicator */}
                            <td className="py-3 px-3 text-foreground font-medium text-[11px]">
                              {entry.adjudicator || 'Lead Methodologist'}
                            </td>

                            {/* Commit Message */}
                            <td className="py-3 px-3 max-w-sm">
                              <p className="text-[11px] text-muted-foreground italic line-clamp-2" title={entry.commit_message}>
                                &ldquo;{entry.commit_message}&rdquo;
                              </p>
                            </td>

                            {/* Action Button */}
                            <td className="py-3 px-3 text-right">
                              {matchingPaper && (
                                <button
                                  type="button"
                                  onClick={() => openInspection(matchingPaper)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border hover:border-primary/40 transition-all cursor-pointer"
                                  title="Inspect Paper Adjudication Details"
                                >
                                  <Eye className="w-3.5 h-3.5 text-primary" />
                                  <span>Inspect</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Deep Side-by-Side Adjudication Inspection Modal */}
      {selectedPaper && (
        <AdjudicationInspectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          discrepancy={selectedPaper}
          poolOrBatchTitle={`Rolling Batch #${activeBatch?.batch_number || 1}`}
          stageName="Rolling Micro-Batch Post-Validation"
          poolType="rolling_batch"
          qaRules={qaRules}
          extractionRules={extractionRules}
          ecRules={ecRules}
          discrepanciesList={filteredBatchPapers}
          onSelectDiscrepancy={(paper) => setSelectedPaper(paper)}
          ledgerEntries={activeBatchLedger}
        />
      )}
    </div>
  );
}
