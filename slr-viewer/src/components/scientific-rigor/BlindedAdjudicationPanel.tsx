import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Users,
  Scale,
  Clock,
  ShieldCheck,
  Search,
  ChevronRight,
  GitCommit,
  Copy,
  Check,
  FileText,
  ExternalLink,
  Layers,
  ArrowRight,
  CheckSquare,
  History,
  Eye
} from 'lucide-react';
import AdjudicationInspectionModal from './AdjudicationInspectionModal';
import { renderPoolCReviewerSummary } from '@/lib/inter-rater/adjudication-calculations';
import type { CalibrationDiscrepancy, CalibrationLedgerEntry } from '@/types';

export interface PoolBlindedStats {
  pool: 'pool_a' | 'pool_b' | 'pool_c' | string;
  title: string;
  stageName: string;
  isCalibrated: boolean;
  message?: string;
  reviewers?: string[];
  total_reviewers?: number;
  total_intersection?: number;
  
  // Agreement statistics
  cohens_kappa?: number;
  weighted_kappa?: number;
  kappa_label?: string;
  raw_agreement_pct?: number;
  expected_agreement_pct?: number;
  kappa_warning?: boolean;
  
  // Decisions breakdown
  agree_include?: number;
  agree_exclude?: number;
  r1_inc_r2_exc?: number;
  r1_exc_r2_inc?: number;
  r1_include_count?: number;
  r2_include_count?: number;
  
  // Pool B precision
  r1_precision?: number;
  r2_precision?: number;
  precision_warning?: boolean;
  
  // Pool C schema metrics
  missing_keys_pct?: number;
  type_match_pct?: number;
  
  // Discrepancies & Adjudication resolution
  total_discrepancies?: number;
  resolved_discrepancies?: number;
  pending_discrepancies?: number;
  resolution_pct?: number;
  
  // Passes overall evaluation criteria
  passes?: boolean;

  // Rich Adjudication Data
  discrepancies?: CalibrationDiscrepancy[];
  all_papers?: CalibrationDiscrepancy[];
  ledger?: CalibrationLedgerEntry[];
}

interface BlindedAdjudicationPanelProps {
  stats: {
    pools?: {
      pool_a?: PoolBlindedStats;
      pool_b?: PoolBlindedStats;
      pool_c?: PoolBlindedStats;
    };
    pool_a?: PoolBlindedStats;
    pool_b?: PoolBlindedStats;
    pool_c?: PoolBlindedStats;
    poolList?: PoolBlindedStats[];
    ledger?: CalibrationLedgerEntry[];
  } | PoolBlindedStats[] | null;
  loading?: boolean;
  projectConfig?: any;
}

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

export default function BlindedAdjudicationPanel({ stats, loading, projectConfig }: BlindedAdjudicationPanelProps) {
  const [selectedPool, setSelectedPool] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');
  const [activeSubTab, setActiveSubTab] = useState<'papers' | 'ledger'>('papers');
  const [filterMode, setFilterMode] = useState<'all' | 'conflicts'>('conflicts');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Modal inspection state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<CalibrationDiscrepancy | null>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

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

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map(idx => (
          <div key={idx} className="bg-card border border-border p-4 rounded-xl space-y-4 h-56">
            <div className="h-4 bg-secondary rounded w-2/3" />
            <div className="h-8 bg-secondary rounded w-1/3" />
            <div className="space-y-2">
              <div className="h-3 bg-secondary rounded" />
              <div className="h-3 bg-secondary rounded w-5/6" />
              <div className="h-3 bg-secondary rounded w-4/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Normalize stats into array of 3 pools
  const getNormalizedPools = (): PoolBlindedStats[] => {
    if (!stats) return [];
    if (Array.isArray(stats)) return stats;
    if (stats.poolList && Array.isArray(stats.poolList) && stats.poolList.length > 0) {
      return stats.poolList;
    }
    const poolSource = stats.pools || stats;
    const poolA = poolSource.pool_a || {
      pool: 'pool_a',
      title: 'Pool A (Fast Filter)',
      stageName: 'Stage 1: Fast Filter',
      isCalibrated: false,
      total_reviewers: 0,
      total_intersection: 0
    };
    const poolB = poolSource.pool_b || {
      pool: 'pool_b',
      title: 'Pool B (Gatekeeper)',
      stageName: 'Stage 2: Gatekeeper',
      isCalibrated: false,
      total_reviewers: 0,
      total_intersection: 0
    };
    const poolC = poolSource.pool_c || {
      pool: 'pool_c',
      title: 'Pool C (Scientist & Miner)',
      stageName: 'Stage 3 & 4: QA & Miner',
      isCalibrated: false,
      total_reviewers: 0,
      total_intersection: 0
    };
    return [poolA, poolB, poolC] as PoolBlindedStats[];
  };

  const poolList = getNormalizedPools();

  if (poolList.length === 0) {
    return (
      <div className="bg-card border border-border p-6 rounded-xl text-center text-muted-foreground text-xs">
        No blinded review or adjudication data available. Upload reviewer decisions in the Inter-Rater Dashboard.
      </div>
    );
  }

  const activeStat = poolList.find(p => p.pool === selectedPool) || poolList[0];
  const activeDiscrepancies = activeStat?.discrepancies || [];
  const activeAllPapers = activeStat?.all_papers || [];
  const activeLedger = activeStat?.ledger || [];

  // Filter papers based on view mode (conflicts vs all) and search query
  const displayedPapers = (filterMode === 'conflicts' && activeDiscrepancies.length > 0)
    ? activeDiscrepancies
    : (activeAllPapers.length > 0 ? activeAllPapers : activeDiscrepancies);

  const filteredPapers = displayedPapers.filter(paper => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (paper.paper_id && paper.paper_id.toLowerCase().includes(q)) ||
      (paper.title && paper.title.toLowerCase().includes(q)) ||
      (paper.authors && paper.authors.toLowerCase().includes(q)) ||
      (paper.doi && paper.doi.toLowerCase().includes(q))
    );
  });

  const openInspection = (paper: CalibrationDiscrepancy) => {
    setSelectedPaper(paper);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. High-Level Pool Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {poolList.map((stat) => {
          const poolKey = (stat.pool || 'pool_a') as 'pool_a' | 'pool_b' | 'pool_c';
          const isPoolA = poolKey === 'pool_a';
          const isPoolB = poolKey === 'pool_b';
          const isPoolC = poolKey === 'pool_c';
          const isSelected = selectedPool === poolKey;

          const isAwaiting = !stat.isCalibrated || (stat.total_reviewers || 0) < 2;
          const totalDisc = stat.total_discrepancies ?? 0;
          const resolvedDisc = stat.resolved_discrepancies ?? 0;
          const pendingDisc = stat.pending_discrepancies ?? (totalDisc - resolvedDisc);
          const resPct = stat.resolution_pct ?? (totalDisc > 0 ? Math.round((resolvedDisc / totalDisc) * 100) : 100);
          const hasPending = pendingDisc > 0;

          return (
            <div
              key={stat.pool}
              onClick={() => setSelectedPool(poolKey)}
              className={`bg-card border p-4 rounded-xl flex flex-col justify-between shadow-xs relative group transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/20 shadow-md'
                  : 'border-border hover:border-border/80'
              }`}
            >
              <div className="space-y-3">
                {/* Header & Status Badge */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
                      {stat.title || (isPoolA ? 'Pool A (Fast Filter)' : isPoolB ? 'Pool B (Gatekeeper)' : 'Pool C (Scientist & Miner)')}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-foreground mt-0.5 block">
                    {stat.stageName || (isPoolA ? 'Stage 1: Fast Filter' : isPoolB ? 'Stage 2: Gatekeeper' : 'Stage 3 & 4: QA & Miner')}
                  </span>
                </div>

                {isAwaiting ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border shrink-0">
                    <Clock className="w-3 h-3" /> AWAITING 2ND
                  </span>
                ) : hasPending ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                    <AlertTriangle className="w-3 h-3" /> {pendingDisc} PENDING
                  </span>
                ) : stat.passes ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> CALIBRATED
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 shrink-0">
                    <ShieldCheck className="w-3 h-3" /> RESOLVED
                  </span>
                )}
              </div>

              {/* Rater & Intersection Context */}
              <div className="flex items-center justify-between text-[10px] bg-secondary/35 px-2.5 py-1.5 rounded-lg border border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3 h-3 text-muted-foreground/70" />
                  <span>
                    {stat.total_reviewers && stat.total_reviewers >= 2
                      ? `${stat.reviewers?.[0] || 'Alpha'} & ${stat.reviewers?.[1] || 'Beta'}`
                      : `${stat.total_reviewers || 0}/2 Reviewers`}
                  </span>
                </div>
                <div className="font-mono font-semibold text-foreground">
                  {stat.total_intersection ?? 0} paired papers
                </div>
              </div>

              {/* Core Agreement Metrics with Tooltips */}
              <div className="space-y-1.5 pt-0.5">
                {isPoolA && (
                  <>
                    {/* Cohen's Kappa */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Cohen&apos;s Kappa (&kappa;):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">
                          {(stat.cohens_kappa ?? 0).toFixed(3)}
                        </span>
                        {stat.kappa_label && stat.kappa_label !== 'N/A' && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                            (stat.cohens_kappa ?? 0) >= 0.8
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : (stat.cohens_kappa ?? 0) >= 0.6
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}>
                            {stat.kappa_label}
                          </span>
                        )}
                      </div>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Cohen&apos;s Kappa (&kappa;) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> &kappa; = (P<sub>o</sub> - P<sub>e</sub>) / (1 - P<sub>e</sub>)</p>
                        <p><strong>Scientific Meaning:</strong> Evaluates inter-rater agreement on title/abstract screening decisions while strictly accounting for chance concordance. A target of &ge; 0.80 demonstrates robust double-blind human consensus before calibrating automated prompts.</p>
                      </div>
                    </div>

                    {/* Observed Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Observed Agreement:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.raw_agreement_pct ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Observed Agreement (P<sub>o</sub>) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> (Agreed<sub>INC</sub> + Agreed<sub>EXC</sub>) / N<sub>Total</sub></p>
                        <p><strong>Scientific Meaning:</strong> The empirical proportion of candidate papers where both blinded reviewers made the identical inclusion or exclusion decision.</p>
                      </div>
                    </div>

                    {/* Expected Chance Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Expected Chance (P<sub>e</sub>):
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.expected_agreement_pct ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Expected Agreement (P<sub>e</sub>) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> (P<sub>1,inc</sub> &times; P<sub>2,inc</sub>) + (P<sub>1,exc</sub> &times; P<sub>2,exc</sub>)</p>
                        <p><strong>Scientific Meaning:</strong> The hypothetical agreement probability that would occur purely by random chance given each reviewer&apos;s baseline marginal inclusion frequency.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 italic">
                      Target: &kappa; &ge; 0.80, 100% Adjudication Resolution
                    </div>
                  </>
                )}

                {isPoolB && (
                  <>
                    {/* Cohen's Kappa */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Cohen&apos;s Kappa (&kappa;):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">
                          {(stat.cohens_kappa ?? 0).toFixed(3)}
                        </span>
                        {stat.kappa_label && stat.kappa_label !== 'N/A' && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                            (stat.cohens_kappa ?? 0) >= 0.8
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : (stat.cohens_kappa ?? 0) >= 0.6
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}>
                            {stat.kappa_label}
                          </span>
                        )}
                      </div>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Gatekeeper Kappa (&kappa;) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Full-text inter-rater Cohen&apos;s Kappa</p>
                        <p><strong>Scientific Meaning:</strong> Measures blinded agreement on full-text study eligibility criteria (EC-1 through EC-5). Ensures methodological alignment before AI screening calibration.</p>
                      </div>
                    </div>

                    {/* Observed Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Observed Agreement:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.raw_agreement_pct ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Observed Agreement (P<sub>o</sub>) Tooltip</p>
                        <p><strong>Scientific Meaning:</strong> Percentage of full-text papers where both reviewers agreed on inclusion or the exact exclusion criteria code.</p>
                      </div>
                    </div>

                    {/* Methodological Precision */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Precision (&alpha; / &beta;):
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.r1_precision ?? 0).toFixed(1)}% / {(stat.r2_precision ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Methodological Precision Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Agreed<sub>INC</sub> / Total<sub>Rater,INC</sub></p>
                        <p><strong>Scientific Meaning:</strong> Rater-specific inclusion precision. Confirms that neither human reviewer was overly inclusive or suffered concept conflation on ambiguous borderline papers (Target &ge; 85%).</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 italic">
                      Target: &kappa; &ge; 0.80, Precision &ge; 85%, 100% Resolved
                    </div>
                  </>
                )}

                {isPoolC && (
                  <>
                    {/* Weighted Kappa */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Weighted Kappa (&kappa;<sub>w</sub>):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">
                          {(stat.weighted_kappa ?? 0).toFixed(3)}
                        </span>
                        {stat.kappa_label && stat.kappa_label !== 'N/A' && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                            (stat.weighted_kappa ?? 0) >= 0.81
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : (stat.weighted_kappa ?? 0) >= 0.65
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}>
                            {stat.kappa_label}
                          </span>
                        )}
                      </div>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Weighted Cohen&apos;s Kappa (&kappa;<sub>w</sub>) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Linear Weighted Kappa across ordinal scale [0.0, 0.5, 1.0]</p>
                        <p><strong>Scientific Meaning:</strong> Assesses ordinal agreement across QA quality appraisal criteria. Critical misses (0.0 vs 1.0) are penalized twice as heavily as minor step variances (0.0 vs 0.5). Target &ge; 0.65 (Substantial).</p>
                      </div>
                    </div>

                    {/* Dual-Gate Cutoff Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Dual-Gate Concordance:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {stat.agree_include ?? 0} INC / {stat.agree_exclude ?? 0} EXC
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Dual-Gate Quality Cutoff Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Dual-gate decision concordance</p>
                        <p><strong>Scientific Meaning:</strong> Demonstrates agreement between reviewers on overall study quality synthesis combining Fatal Flaw gates (score 0 = fatal exclude) and Cumulative score (&ge; 4.5/8.0).</p>
                      </div>
                    </div>

                    {/* Miner Schema Exactness */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Miner Schema Match:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.type_match_pct ?? 100).toFixed(0)}% Type / {(stat.missing_keys_pct ?? 0).toFixed(0)}% Miss
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Miner Schema Exactness Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Type match % &amp; Missing keys %</p>
                        <p><strong>Scientific Meaning:</strong> Verifies that both reviewers extracted all required entity keys (RQ-1 to RQ-9) in the exact expected schema data types without missing fields.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 italic">
                      Target: &kappa;<sub>w</sub> &ge; 0.65, 0% Missing Keys, 100% Resolved
                    </div>
                  </>
                )}
              </div>

              {/* Decision Concordance Mini Breakdown */}
              <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-center border-t border-border/60 pt-2">
                <div className="bg-secondary/40 rounded p-1">
                  <span className="text-muted-foreground block scale-90">Agreed INC</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {stat.agree_include ?? 0}
                  </span>
                </div>
                <div className="bg-secondary/40 rounded p-1">
                  <span className="text-muted-foreground block scale-90">Agreed EXC</span>
                  <span className="font-bold text-foreground">
                    {stat.agree_exclude ?? 0}
                  </span>
                </div>
                <div className="bg-secondary/40 rounded p-1">
                  <span className="text-muted-foreground block scale-90">Conflicts</span>
                  <span className={`font-bold ${totalDisc > 0 ? 'text-amber-500' : 'text-foreground'}`}>
                    {totalDisc}
                  </span>
                </div>
              </div>

              {/* Adjudication Progress Bar & Tooltip */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] relative group/tooltip cursor-help">
                  <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40 font-medium">
                    Adjudication:
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {resolvedDisc} / {totalDisc} resolved ({resPct}%)
                  </span>
                  <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                    <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Discrepancy Adjudication Tooltip</p>
                    <p className="mb-1"><strong>Statistic:</strong> Resolved / Total Conflicts &times; 100%</p>
                    <p><strong>Scientific Meaning:</strong> Every discrepancy between reviewers must be formally adjudicated with an explicit rationale and committed to the ledger to establish the unassailable Gold Standard benchmark.</p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      resPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${resPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="text-[9px] text-muted-foreground/75 mt-3 border-t border-border/40 pt-1.5 flex justify-between font-medium">
              <span>Conflicts: {totalDisc}</span>
              <span className={pendingDisc === 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                {pendingDisc === 0 ? 'All Resolved' : `${pendingDisc} Pending Arbitration`}
              </span>
            </div>
          </div>
        );
      })}
      </div>

      {/* 2. Interactive Pre-Calibration Adjudication Explorer */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Pool Selector & Sub-Tabs Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <Scale className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                Adjudication &amp; Ground Truth Explorer
              </h4>
            </div>

            {/* Pool Selector Pills */}
            <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border/70 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedPool('pool_a')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedPool === 'pool_a'
                    ? 'bg-card text-foreground font-bold shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pool A (Fast Filter)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPool('pool_b')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedPool === 'pool_b'
                    ? 'bg-card text-foreground font-bold shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pool B (Gatekeeper)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPool('pool_c')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedPool === 'pool_c'
                    ? 'bg-card text-foreground font-bold shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pool C (QA &amp; Miner)
              </button>
            </div>
          </div>

          {/* Sub-Tab Switcher: Papers vs Audit Ledger */}
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
                <span>Cohort &amp; Discrepancies</span>
                <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-secondary text-foreground">
                  {activeStat?.total_intersection || activeAllPapers.length || activeDiscrepancies.length}
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
                <span>Calibration Ledger</span>
                <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-secondary text-foreground">
                  {activeLedger.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode 1: Papers & Discrepancies Table */}
        {activeSubTab === 'papers' && (
          <div className="space-y-4">
            {/* Toolbar: Filter Mode Toggle & Search */}
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
                    Conflicts Only ({activeDiscrepancies.length})
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
                    All Paired Papers ({activeAllPapers.length > 0 ? activeAllPapers.length : activeDiscrepancies.length})
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

            {/* Papers Table */}
            {filteredPapers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                {filterMode === 'conflicts' && activeDiscrepancies.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <span className="font-bold text-foreground">Zero Discrepancies Recorded</span>
                    <span className="text-[11px]">All reviewers agreed 100% on every candidate paper in this pool.</span>
                  </div>
                ) : (
                  <span>No papers match your search query.</span>
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
                    {filteredPapers.map(paper => {
                      const isPoolC = selectedPool === 'pool_c';

                      // Reviewer summaries
                      let r1Summary = paper.r1_decision || '—';
                      if (paper.r1_ec) r1Summary += ` (${paper.r1_ec})`;
                      let r2Summary = paper.r2_decision || '—';
                      if (paper.r2_ec) r2Summary += ` (${paper.r2_ec})`;

                      if (isPoolC) {
                        r1Summary = renderPoolCReviewerSummary(paper.r1_qa_scores || '', qaRules);
                        r2Summary = renderPoolCReviewerSummary(paper.r2_qa_scores || '', qaRules);
                      }

                      // Adjudicated summary
                      let resolvedSummary = paper.resolved_decision || 'Pending';
                      if (paper.resolved_ec) resolvedSummary += ` (${paper.resolved_ec})`;
                      if (isPoolC && paper.resolved_qa_scores) {
                        resolvedSummary = renderPoolCReviewerSummary(paper.resolved_qa_scores || '', qaRules);
                      }

                      // Determine conflict state
                      const isConflict = isPoolC
                        ? (paper.r1_qa_scores !== paper.r2_qa_scores || paper.r1_extracted_data !== paper.r2_extracted_data)
                        : (paper.r1_decision !== paper.r2_decision || (paper.r1_decision?.startsWith('EXCLUDE') && paper.r1_ec !== paper.r2_ec));

                      const isResolved = !!paper.resolved_decision || !!paper.resolved_qa_scores || paper.is_resolved;

                      return (
                        <tr key={paper.paper_id} className="hover:bg-muted/20 transition-colors">
                          {/* Paper ID & Metadata */}
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
                            {paper.r1_rationale && (
                              <p className="text-[10px] text-muted-foreground font-sans line-clamp-1 mt-1 max-w-xs italic" title={paper.r1_rationale}>
                                &ldquo;{paper.r1_rationale}&rdquo;
                              </p>
                            )}
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
                            {paper.r2_rationale && (
                              <p className="text-[10px] text-muted-foreground font-sans line-clamp-1 mt-1 max-w-xs italic" title={paper.r2_rationale}>
                                &ldquo;{paper.r2_rationale}&rdquo;
                              </p>
                            )}
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
                              title="Inspect Full Adjudication Comparison"
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

        {/* View Mode 2: Calibration Audit Ledger */}
        {activeSubTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                Cryptographically Signed Calibration Ledger ({activeLedger.length} commits)
              </span>
              <span>Pool: {activeStat?.title}</span>
            </div>

            {activeLedger.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                <GitCommit className="w-6 h-6 text-muted-foreground/60 mx-auto mb-1.5" />
                <span>No calibration commits recorded for this pool yet.</span>
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
                      <th className="py-2.5 px-3">Resolution &amp; Commit Message</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {activeLedger.map((entry) => {
                      const shortHash = (entry.commit_hash || '').slice(0, 7);
                      const isCopied = copiedHash === entry.commit_hash;
                      const matchingPaper = activeAllPapers.find(p => p.paper_id === entry.paper_id) ||
                        activeDiscrepancies.find(p => p.paper_id === entry.paper_id);

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

                          {/* Message & Resolved State */}
                          <td className="py-3 px-3 max-w-sm">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {entry.resolved_decision && (
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  entry.resolved_decision.startsWith('INC')
                                    ? 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-500/15 text-rose-950 dark:text-rose-300'
                                }`}>
                                  {entry.resolved_decision}
                                  {entry.resolved_ec && ` (${entry.resolved_ec})`}
                                </span>
                              )}
                            </div>
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

      {/* 3. Deep Side-by-Side Adjudication Inspection Modal */}
      {selectedPaper && (
        <AdjudicationInspectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          discrepancy={selectedPaper}
          poolOrBatchTitle={activeStat?.title}
          stageName={activeStat?.stageName}
          poolType={selectedPool}
          qaRules={qaRules}
          extractionRules={extractionRules}
          ecRules={ecRules}
          discrepanciesList={filteredPapers}
          onSelectDiscrepancy={(paper) => setSelectedPaper(paper)}
          ledgerEntries={activeLedger}
        />
      )}
    </div>
  );
}
