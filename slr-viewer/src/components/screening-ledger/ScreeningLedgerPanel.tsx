import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Check,
  Copy,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  Database,
  FileSpreadsheet,
  Download,
  Info,
  UserCheck
} from 'lucide-react';
import { useViewerData } from '@/context/ViewerContext';
import { ScreenedCorpusPaper } from '@/types';
import PaperInspectionModal from './PaperInspectionModal';

const DEFAULT_WIDTHS: Record<string, number> = {
  Paper_ID: 110,
  Title: 280,
  Authors: 160,
  Year: 65,
  DOI: 130,
  Source: 110,
  Stage: 115,
  Decision: 105,
  Exclusion_Trigger: 115,
  PDF_Status: 120,
  Citations: 70,
  Actions: 80
};

export default function ScreeningLedgerPanel() {
  const { activeSession, showToast } = useViewerData();
  const projectId = String(activeSession?.id || 'viewer-project');

  // Extract raw papers: prefer screened_corpus, fall back to final_cohort if legacy snapshot
  const rawCorpus = activeSession?.rawData?.screened_corpus;
  const rawCohort = activeSession?.rawData?.final_cohort;
  const projectData = activeSession?.rawData?.project || {};

  const isLegacyCohortOnly = !rawCorpus?.papers || rawCorpus.papers.length === 0;

  const allPapers: ScreenedCorpusPaper[] = useMemo(() => {
    if (rawCorpus?.papers && rawCorpus.papers.length > 0) {
      return rawCorpus.papers;
    }
    if (rawCohort?.papers && rawCohort.papers.length > 0) {
      return rawCohort.papers;
    }
    return [];
  }, [rawCorpus, rawCohort]);

  // Parse project exclusion criteria rules
  const ecRules: Array<{ code: string; description: string }> = useMemo(() => {
    const rules: Array<{ code: string; description: string }> = [];
    const parse = (raw: any) => {
      if (!raw) return;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          parsed.forEach((r: any) => {
            if (r.code) rules.push({ code: r.code, description: r.description || '' });
          });
        }
      } catch {}
    };
    parse(projectData.ec_rules);
    parse(projectData.pool_b_ec_rules);
    return rules;
  }, [projectData]);

  // Build exclusion criteria code-to-description map
  const ecMap = useMemo(() => {
    const map: Record<string, string> = {};
    ecRules.forEach(r => {
      if (r.code) map[r.code.trim().toUpperCase()] = r.description || '';
    });
    return map;
  }, [ecRules]);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [prismaPhaseFilter, setPrismaPhaseFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [ecTriggerFilter, setEcTriggerFilter] = useState('');
  const [pdfStatusFilter, setPdfStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [duplicateFilter, setDuplicateFilter] = useState<'non-duplicates' | 'all' | 'duplicates-only'>('non-duplicates');
  const [poolFilter, setPoolFilter] = useState('');

  // Pagination & Sorting States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('Paper_ID');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Inspection Modal State
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Column Width Resizing State
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`slr_viewer_screening_ledger_widths_${projectId}`);
      if (saved) {
        setColumnWidths(JSON.parse(saved));
      }
    } catch {}
  }, [projectId]);

  const getColWidth = useCallback((key: string): number => {
    return columnWidths[key] ?? DEFAULT_WIDTHS[key] ?? 100;
  }, [columnWidths]);

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.pageX;
    const startWidth = getColWidth(colKey);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const newWidth = Math.max(50, Math.min(600, startWidth + deltaX));
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      setColumnWidths(prev => {
        const next = { ...prev, [colKey]: Math.max(50, Math.min(600, startWidth + (upEvent.pageX - startX))) };
        try {
          localStorage.setItem(`slr_viewer_screening_ledger_widths_${projectId}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Helper: Resolve effective stage, decision, and exact PRISMA 2020 phase for a paper
  const resolvePaperScreening = useCallback((p: ScreenedCorpusPaper) => {
    const ms = Number(p.manual_stage || 0);
    const as = Number(p.ai_stage || 0);
    const effectiveStage = Number(p.effective_stage ?? Math.max(ms, as));

    let effectiveDecision = p.effective_decision;
    let effectiveEc = p.effective_exclusion_code;

    if (!effectiveDecision) {
      if (ms > as) {
        effectiveDecision = p.manual_decision;
        effectiveEc = p.manual_exclusion_code;
      } else if (as > ms) {
        effectiveDecision = p.ai_decision;
        effectiveEc = p.ai_exclusion_code;
      } else {
        effectiveDecision = p.manual_decision || p.ai_decision || null;
        effectiveEc = p.manual_exclusion_code || p.ai_exclusion_code || null;
      }
    }

    const rawDec = (effectiveDecision || '').toUpperCase();
    const isIncluded = rawDec.startsWith('INCLUDE');
    const isExcluded = rawDec.startsWith('EXCLUDE');
    const isPdfInaccessible = (p.Local_PDF_Status || '').toUpperCase() === 'INACCESSIBLE';
    const isDuplicate = p.is_duplicate === 1 || p.prisma_phase === 'DUPLICATE_REMOVED';

    // Derive deterministic PRISMA phase
    let prismaPhase = p.prisma_phase || 'UNSCREENED';
    if (!p.prisma_phase) {
      if (isDuplicate) {
        prismaPhase = 'DUPLICATE_REMOVED';
      } else if (effectiveStage === 1 && isExcluded) {
        prismaPhase = 'STAGE_1_EXCLUDED';
      } else if (effectiveStage === 1 && isIncluded && isPdfInaccessible) {
        prismaPhase = 'RETRIEVAL_INACCESSIBLE';
      } else if (effectiveStage === 2 && isExcluded) {
        prismaPhase = 'STAGE_2_EXCLUDED';
      } else if (effectiveStage === 3 && isExcluded) {
        prismaPhase = 'STAGE_3_EXCLUDED';
      } else if ((effectiveStage >= 4 || (effectiveStage >= 3 && !isPdfInaccessible)) && isIncluded) {
        prismaPhase = 'FINAL_INCLUDED';
      }
    }

    const isUnscreened = prismaPhase === 'UNSCREENED';

    return {
      effectiveStage,
      effectiveDecision: prismaPhase === 'DUPLICATE_REMOVED'
        ? 'DUPLICATE'
        : prismaPhase === 'RETRIEVAL_INACCESSIBLE'
        ? 'UNRETRIEVED'
        : isIncluded
        ? 'INCLUDE'
        : isExcluded
        ? 'EXCLUDE'
        : 'UNSCREENED',
      effectiveEc: effectiveEc ? effectiveEc.trim().toUpperCase() : null,
      isIncluded,
      isExcluded,
      isUnscreened,
      isPdfInaccessible,
      isDuplicate,
      prismaPhase
    };
  }, []);

  // Compute Project-Wide KPI Metrics strictly matching PRISMA 2020 Flow Diagram grouped by stage
  const kpiMetrics = useMemo(() => {
    const totalIngested = allPapers.length;
    let duplicates = 0;
    let stage1Excluded = 0;
    let pdfInaccessible = 0;
    let stage2Excluded = 0;
    let stage3Excluded = 0;
    let finalIncluded = 0;
    let unscreenedCount = 0;

    allPapers.forEach(p => {
      const res = resolvePaperScreening(p);
      if (res.prismaPhase === 'DUPLICATE_REMOVED') {
        duplicates++;
      } else if (res.prismaPhase === 'STAGE_1_EXCLUDED') {
        stage1Excluded++;
      } else if (res.prismaPhase === 'RETRIEVAL_INACCESSIBLE') {
        pdfInaccessible++;
      } else if (res.prismaPhase === 'STAGE_2_EXCLUDED') {
        stage2Excluded++;
      } else if (res.prismaPhase === 'STAGE_3_EXCLUDED') {
        stage3Excluded++;
      } else if (res.prismaPhase === 'FINAL_INCLUDED') {
        finalIncluded++;
      } else {
        unscreenedCount++;
      }
    });

    const screenedCorpus = totalIngested - duplicates;
    const reportsSought = screenedCorpus - stage1Excluded;
    const reportsAssessedStage2 = reportsSought - pdfInaccessible;
    const reportsAssessedStage3 = reportsAssessedStage2 - stage2Excluded;
    const totalExcluded = stage1Excluded + stage2Excluded + stage3Excluded;

    return {
      totalIngested,
      duplicates,
      screenedCorpus,
      stage1Excluded,
      reportsSought,
      pdfInaccessible,
      reportsAssessedStage2,
      stage2Excluded,
      reportsAssessedStage3,
      stage3Excluded,
      finalIncluded,
      unscreenedCount,
      totalExcluded
    };
  }, [allPapers, resolvePaperScreening]);

  // Unique sources and EC codes discovered in the dataset for dynamic filter dropdowns
  const availableFilterOptions = useMemo(() => {
    const sources = new Set<string>();
    const triggers = new Set<string>();

    allPapers.forEach(p => {
      if (p.Source) sources.add(p.Source.trim());
      if (p.Import_Source) sources.add(p.Import_Source.trim());

      const res = resolvePaperScreening(p);
      if (res.effectiveEc) triggers.add(res.effectiveEc);
      if (p.ai_exclusion_code) triggers.add(p.ai_exclusion_code.trim().toUpperCase());
      if (p.manual_exclusion_code) triggers.add(p.manual_exclusion_code.trim().toUpperCase());
    });

    ecRules.forEach(r => {
      if (r.code) triggers.add(r.code.trim().toUpperCase());
    });

    return {
      sources: Array.from(sources).sort(),
      triggers: Array.from(triggers).sort()
    };
  }, [allPapers, ecRules, resolvePaperScreening]);

  // Filter & Search Evaluation
  const filteredPapers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allPapers.filter(p => {
      const res = resolvePaperScreening(p);

      // 0. PRISMA Phase filter
      if (prismaPhaseFilter !== '') {
        if (res.prismaPhase !== prismaPhaseFilter) return false;
      }

      // 1. Duplicate filter
      if (duplicateFilter === 'non-duplicates' && res.isDuplicate) return false;
      if (duplicateFilter === 'duplicates-only' && !res.isDuplicate) return false;

      // 2. Stage filter
      if (stageFilter !== '') {
        const stNum = Number(stageFilter);
        if (res.effectiveStage !== stNum) return false;
      }

      // 3. Decision filter
      if (decisionFilter !== '') {
        if (decisionFilter === 'FINAL_INCLUDED' && res.prismaPhase !== 'FINAL_INCLUDED') return false;
        if (decisionFilter === 'INCLUDE' && !res.isIncluded) return false;
        if (decisionFilter === 'EXCLUDE' && !res.isExcluded) return false;
        if (decisionFilter === 'UNRETRIEVED' && res.prismaPhase !== 'RETRIEVAL_INACCESSIBLE') return false;
        if (decisionFilter === 'DUPLICATE' && !res.isDuplicate) return false;
        if (decisionFilter === 'UNSCREENED' && !res.isUnscreened) return false;
      }

      // 4. Exclusion criterion / Trigger filter
      if (ecTriggerFilter !== '') {
        if (res.effectiveEc !== ecTriggerFilter) return false;
      }

      // 5. PDF Status filter
      if (pdfStatusFilter !== '') {
        if ((p.Local_PDF_Status || '').toUpperCase() !== pdfStatusFilter) return false;
      }

      // 6. Source filter
      if (sourceFilter !== '') {
        const matchSource = (p.Source || '').toLowerCase().includes(sourceFilter.toLowerCase()) ||
                            (p.Import_Source || '').toLowerCase().includes(sourceFilter.toLowerCase());
        if (!matchSource) return false;
      }

      // 7. Calibration pool filter
      if (poolFilter !== '') {
        if (poolFilter === 'none') {
          if (p.calibration_pool) return false;
        } else {
          if (p.calibration_pool !== poolFilter) return false;
        }
      }

      // 8. Full-Text Multi-Field Search
      if (term) {
        const idMatch = (p.Paper_ID || '').toLowerCase().includes(term);
        const titleMatch = (p.Title || '').toLowerCase().includes(term);
        const authorMatch = (p.Authors || '').toLowerCase().includes(term);
        const doiMatch = (p.DOI || '').toLowerCase().includes(term);
        const abstractMatch = (p.Abstract || '').toLowerCase().includes(term);
        const publisherMatch = (p.Publisher || p.Original_Publisher || '').toLowerCase().includes(term);
        const ecMatch = (res.effectiveEc || '').toLowerCase().includes(term);
        const aiRatMatch = (p.ai_rationale || '').toLowerCase().includes(term);
        const manRatMatch = (p.manual_rationale || '').toLowerCase().includes(term);

        if (!idMatch && !titleMatch && !authorMatch && !doiMatch && !abstractMatch && !publisherMatch && !ecMatch && !aiRatMatch && !manRatMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    allPapers,
    searchTerm,
    prismaPhaseFilter,
    duplicateFilter,
    stageFilter,
    decisionFilter,
    ecTriggerFilter,
    pdfStatusFilter,
    sourceFilter,
    poolFilter,
    resolvePaperScreening
  ]);

  // Active filter count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (prismaPhaseFilter !== '') count++;
    if (stageFilter !== '') count++;
    if (decisionFilter !== '') count++;
    if (ecTriggerFilter !== '') count++;
    if (pdfStatusFilter !== '') count++;
    if (sourceFilter !== '') count++;
    if (duplicateFilter !== 'non-duplicates') count++;
    if (poolFilter !== '') count++;
    return count;
  }, [prismaPhaseFilter, stageFilter, decisionFilter, ecTriggerFilter, pdfStatusFilter, sourceFilter, duplicateFilter, poolFilter]);

  const resetAllFilters = () => {
    setSearchTerm('');
    setPrismaPhaseFilter('');
    setStageFilter('');
    setDecisionFilter('');
    setEcTriggerFilter('');
    setPdfStatusFilter('');
    setSourceFilter('');
    setDuplicateFilter('non-duplicates');
    setPoolFilter('');
    setPage(1);
  };

  // Sorting
  const sortedPapers = useMemo(() => {
    const copy = [...filteredPapers];
    copy.sort((a, b) => {
      let valA: any = a[sortBy as keyof ScreenedCorpusPaper] ?? '';
      let valB: any = b[sortBy as keyof ScreenedCorpusPaper] ?? '';

      if (sortBy === 'Stage') {
        valA = resolvePaperScreening(a).effectiveStage;
        valB = resolvePaperScreening(b).effectiveStage;
      } else if (sortBy === 'Decision') {
        valA = resolvePaperScreening(a).effectiveDecision;
        valB = resolvePaperScreening(b).effectiveDecision;
      } else if (sortBy === 'Exclusion_Trigger') {
        valA = resolvePaperScreening(a).effectiveEc || '';
        valB = resolvePaperScreening(b).effectiveEc || '';
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filteredPapers, sortBy, sortOrder, resolvePaperScreening]);

  // Pagination
  const total = sortedPapers.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedPapers = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedPapers.slice(start, start + limit);
  }, [sortedPapers, page, limit]);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, stageFilter, decisionFilter, ecTriggerFilter, pdfStatusFilter, sourceFilter, duplicateFilter, poolFilter]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary inline ml-1" />
      : <ArrowDown className="w-3 h-3 text-primary inline ml-1" />;
  };

  // Modal navigation index tracking
  const activePaperIndex = useMemo(() => {
    if (!selectedPaperId) return -1;
    return sortedPapers.findIndex(p => p.Paper_ID === selectedPaperId);
  }, [selectedPaperId, sortedPapers]);

  const activePaper = activePaperIndex >= 0 ? sortedPapers[activePaperIndex] : null;

  const handleModalNavigate = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && activePaperIndex > 0) {
      setSelectedPaperId(sortedPapers[activePaperIndex - 1].Paper_ID);
    } else if (direction === 'next' && activePaperIndex < sortedPapers.length - 1) {
      setSelectedPaperId(sortedPapers[activePaperIndex + 1].Paper_ID);
    }
  };

  // Export filtered or full screening ledger to RFC 4180 CSV
  const handleExportCsv = useCallback(() => {
    if (filteredPapers.length === 0) {
      showToast('No papers to export with current filters', 'info');
      return;
    }
    try {
      const rows = filteredPapers.map(p => {
        const res = resolvePaperScreening(p);
        return {
          'Paper_ID': p.Paper_ID || '',
          'PRISMA_Phase': res.prismaPhase,
          'Title': p.Title || '',
          'Authors': p.Authors || '',
          'Year': p.Year || '',
          'DOI': p.DOI || '',
          'Source': p.Source || p.Import_Source || '',
          'Effective_Stage': res.effectiveStage,
          'Effective_Decision': res.effectiveDecision,
          'Effective_Exclusion_Code': res.effectiveEc || '',
          'Exclusion_Description': res.effectiveEc ? (ecMap[res.effectiveEc] || '') : '',
          'Is_Manual_Override': p.is_manual_override ? 'YES' : 'NO',
          'AI_Stage': p.ai_stage ?? '',
          'AI_Decision': p.ai_decision || '',
          'AI_Exclusion_Code': p.ai_exclusion_code || '',
          'AI_Rationale': p.ai_rationale || '',
          'Manual_Stage': p.manual_stage ?? '',
          'Manual_Decision': p.manual_decision || '',
          'Manual_Exclusion_Code': p.manual_exclusion_code || '',
          'Manual_Rationale': p.manual_rationale || '',
          'Local_PDF_Status': p.Local_PDF_Status || '',
          'PDF_Link': p.PDF_Link || '',
          'Citation_Count': p.citation_count ?? 0,
          'Is_Duplicate': p.is_duplicate === 1 ? 'YES' : 'NO',
          'Merged_Into_ID': p.merged_into_id || p.Parent_Paper_ID || '',
          'Calibration_Pool': p.calibration_pool || '',
          'Calibration_Tag': p.calibration_tag || '',
          'Import_Source': p.Import_Source || '',
          'Import_Date': p.Import_Date || '',
          'Created_At': p.created_at || '',
          'Updated_At': p.updated_at || ''
        };
      });

      const csvString = '\uFEFF' + Papa.unparse(rows);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const projectName = projectData.name || activeSession?.projectName || 'slr';
      const safeProjectName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `${safeProjectName}_screening_ledger_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`Exported ${filteredPapers.length.toLocaleString()} papers to CSV successfully`, 'success');
    } catch (err: any) {
      console.error('Failed to export screening ledger CSV:', err);
      showToast('Failed to export CSV: ' + err.message, 'error');
    }
  }, [filteredPapers, resolvePaperScreening, ecMap, projectData, activeSession, showToast]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background">
      {/* Top Notification for Legacy Snapshots */}
      {isLegacyCohortOnly && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-2 font-medium">
            <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>
              This snapshot was exported using an earlier version that only packaged the <strong>Final Cohort ({allPapers.length} papers)</strong>. To view and audit the full 1,800+ input corpus with complete exclusion histories, please re-export this project from SLR IDE v1.3.0+.
            </span>
          </div>
        </div>
      )}

      {/* KPI Summary Filter Cards Bar - Grouped strictly by PRISMA 2020 Stages */}
      <div className="px-6 py-2.5 border-b border-border bg-card/40 flex items-center gap-2 overflow-x-auto shrink-0 select-none scrollbar-thin">
        {/* Stage 1: Identification & Deduplication */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              resetAllFilters();
              setDuplicateFilter('all');
            }}
            className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer ${
              activeFiltersCount === 0 && !searchTerm && duplicateFilter === 'all'
                ? 'bg-primary/10 border-primary/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:bg-secondary'
            }`}
            title="Total records identified from all database queries"
          >
            <div className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground">1. Ingested</div>
            <div className="text-xs font-black text-foreground font-mono">{kpiMetrics.totalIngested.toLocaleString()}</div>
          </button>

          {kpiMetrics.duplicates > 0 && (
            <button
              onClick={() => {
                resetAllFilters();
                setDuplicateFilter('duplicates-only');
                setPrismaPhaseFilter('DUPLICATE_REMOVED');
              }}
              className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer shadow-xs ${
                duplicateFilter === 'duplicates-only' || prismaPhaseFilter === 'DUPLICATE_REMOVED'
                  ? 'bg-orange-500/15 dark:bg-orange-500/20 border-orange-500/40 shadow-sm'
                  : 'bg-secondary/40 border-border hover:bg-secondary'
              }`}
              title="Duplicate records purged before screening"
            >
              <div className="text-[8.5px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400">Duplicates</div>
              <div className="text-xs font-black text-orange-800 dark:text-orange-400 font-mono">{kpiMetrics.duplicates.toLocaleString()}</div>
            </button>
          )}
        </div>

        <div className="h-6 w-px bg-border/60 shrink-0 mx-0.5" />

        {/* Stage 2: Stage 1 Fast Filter */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              resetAllFilters();
              setDuplicateFilter('non-duplicates');
              setPrismaPhaseFilter('STAGE_1_EXCLUDED');
            }}
            className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer shadow-xs ${
              prismaPhaseFilter === 'STAGE_1_EXCLUDED' || (stageFilter === '1' && decisionFilter === 'EXCLUDE')
                ? 'bg-blue-500/15 dark:bg-blue-500/20 border-blue-500/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:bg-secondary'
            }`}
            title="Records excluded at Stage 1: Fast Filter (Title & Abstract, EC-1..3)"
          >
            <div className="text-[8.5px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">2. Stage 1 Excluded</div>
            <div className="text-xs font-black text-blue-800 dark:text-blue-400 font-mono">{kpiMetrics.stage1Excluded.toLocaleString()}</div>
          </button>
        </div>

        <div className="h-6 w-px bg-border/60 shrink-0 mx-0.5" />

        {/* Stage 3: PDF Retrieval Gate */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              resetAllFilters();
              setDuplicateFilter('non-duplicates');
              setPrismaPhaseFilter('RETRIEVAL_INACCESSIBLE');
            }}
            className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer shadow-xs ${
              prismaPhaseFilter === 'RETRIEVAL_INACCESSIBLE' || (pdfStatusFilter === 'INACCESSIBLE' && stageFilter === '1')
                ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-500/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:bg-secondary'
            }`}
            title="Reports sought for retrieval but unretrieved due to inaccessible PDF (PRISMA Phase 2b)"
          >
            <div className="text-[8.5px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">3. PDF Inaccessible</div>
            <div className="text-xs font-black text-amber-900 dark:text-amber-400 font-mono">{kpiMetrics.pdfInaccessible.toLocaleString()}</div>
          </button>
        </div>

        <div className="h-6 w-px bg-border/60 shrink-0 mx-0.5" />

        {/* Stage 4: Stage 2 Gatekeeper */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              resetAllFilters();
              setDuplicateFilter('non-duplicates');
              setPrismaPhaseFilter('STAGE_2_EXCLUDED');
            }}
            className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer shadow-xs ${
              prismaPhaseFilter === 'STAGE_2_EXCLUDED' || (stageFilter === '2' && decisionFilter === 'EXCLUDE')
                ? 'bg-purple-500/15 dark:bg-purple-500/20 border-purple-500/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:bg-secondary'
            }`}
            title="Reports assessed and excluded at Stage 2: Gatekeeper (Full-text structural EC-4..11)"
          >
            <div className="text-[8.5px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">4. Stage 2 Excluded</div>
            <div className="text-xs font-black text-purple-800 dark:text-purple-400 font-mono">{kpiMetrics.stage2Excluded.toLocaleString()}</div>
          </button>
        </div>

        <div className="h-6 w-px bg-border/60 shrink-0 mx-0.5" />

        {/* Stage 5: Stage 3 Scientist */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              resetAllFilters();
              setDuplicateFilter('non-duplicates');
              setPrismaPhaseFilter('STAGE_3_EXCLUDED');
            }}
            className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer shadow-xs ${
              prismaPhaseFilter === 'STAGE_3_EXCLUDED' || (stageFilter === '3' && decisionFilter === 'EXCLUDE')
                ? 'bg-rose-500/15 dark:bg-rose-500/20 border-rose-500/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:bg-secondary'
            }`}
            title="Reports assessed and excluded at Stage 3: Scientist (Dual-gate Quality Failures)"
          >
            <div className="text-[8.5px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">5. Stage 3 Excluded</div>
            <div className="text-xs font-black text-rose-800 dark:text-rose-400 font-mono">{kpiMetrics.stage3Excluded.toLocaleString()}</div>
          </button>
        </div>

        <div className="h-6 w-px bg-border/60 shrink-0 mx-0.5" />

        {/* Stage 6: Final Included Cohort */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              resetAllFilters();
              setDuplicateFilter('non-duplicates');
              setPrismaPhaseFilter('FINAL_INCLUDED');
            }}
            className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer shadow-xs ${
              prismaPhaseFilter === 'FINAL_INCLUDED' || decisionFilter === 'FINAL_INCLUDED'
                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:bg-secondary'
            }`}
            title="Studies included in review (Stage 4 Miner / Final Cohort)"
          >
            <div className="text-[8.5px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">6. Final Included</div>
            <div className="text-xs font-black text-emerald-900 dark:text-emerald-400 font-mono">{kpiMetrics.finalIncluded.toLocaleString()}</div>
          </button>
        </div>

        {/* Optional: Unscreened (if any) */}
        {kpiMetrics.unscreenedCount > 0 && (
          <>
            <div className="h-6 w-px bg-border/60 shrink-0 mx-0.5" />
            <button
              onClick={() => {
                resetAllFilters();
                setDuplicateFilter('all');
                setPrismaPhaseFilter('UNSCREENED');
              }}
              className={`px-3 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer shadow-xs ${
                prismaPhaseFilter === 'UNSCREENED'
                  ? 'bg-slate-500/15 dark:bg-slate-500/20 border-slate-500/40 shadow-sm'
                  : 'bg-secondary/40 border-border hover:bg-secondary'
              }`}
              title="Filter unscreened records"
            >
              <div className="text-[8.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400">Unscreened</div>
              <div className="text-xs font-black text-slate-800 dark:text-slate-400 font-mono">{kpiMetrics.unscreenedCount.toLocaleString()}</div>
            </button>
          </>
        )}
      </div>

      {/* Main Search & Control Filter Bar */}
      <div className="px-6 py-3 border-b border-border bg-card/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search all input papers, titles, authors, DOIs, abstracts, rationales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-medium transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              showFilters || activeFiltersCount > 0
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-secondary hover:bg-secondary/80 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[9px] font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {(activeFiltersCount > 0 || searchTerm) && (
            <button
              onClick={resetAllFilters}
              className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground self-end md:self-auto font-medium">
          <span>
            Showing <strong className="text-foreground">{total ? (page - 1) * limit + 1 : 0}</strong>–
            <strong className="text-foreground">{Math.min(page * limit, total)}</strong> of{' '}
            <strong className="text-foreground">{total.toLocaleString()}</strong> papers
          </span>

          <button
            onClick={handleExportCsv}
            disabled={filteredPapers.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-lg transition-all border border-border cursor-pointer shrink-0 disabled:opacity-40"
            title="Export full or filtered screening ledger to RFC 4180 CSV"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Expandable Advanced Filter Options Drawer */}
      {showFilters && (
        <div className="px-6 py-4 bg-secondary/30 border-b border-border grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 shrink-0 animate-in slide-in-from-top-2 duration-150 text-xs">
          {/* 1. PRISMA Phase Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">PRISMA Phase</label>
            <select
              value={prismaPhaseFilter}
              onChange={(e) => setPrismaPhaseFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="">All Phases</option>
              <option value="FINAL_INCLUDED">Final Included Cohort ({kpiMetrics.finalIncluded})</option>
              <option value="RETRIEVAL_INACCESSIBLE">PDF Inaccessible ({kpiMetrics.pdfInaccessible})</option>
              <option value="STAGE_1_EXCLUDED">Stage 1 Excluded ({kpiMetrics.stage1Excluded})</option>
              <option value="STAGE_2_EXCLUDED">Stage 2 Excluded ({kpiMetrics.stage2Excluded})</option>
              <option value="STAGE_3_EXCLUDED">Stage 3 Excluded ({kpiMetrics.stage3Excluded})</option>
              <option value="DUPLICATE_REMOVED">Duplicates Purged ({kpiMetrics.duplicates})</option>
            </select>
          </div>

          {/* 2. Stage Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="">All Stages</option>
              <option value="0">0: Initial / Unscreened</option>
              <option value="1">1: Fast Filter</option>
              <option value="2">2: Gatekeeper</option>
              <option value="3">3: Scientist</option>
              <option value="4">4: Miner</option>
            </select>
          </div>

          {/* 3. Decision Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Decision</label>
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="">All Decisions</option>
              <option value="FINAL_INCLUDED">Final Included ({kpiMetrics.finalIncluded})</option>
              <option value="INCLUDE">Included (Any Stage)</option>
              <option value="EXCLUDE">Excluded ({kpiMetrics.totalExcluded})</option>
              <option value="UNRETRIEVED">Unretrieved (PDF Inaccessible)</option>
              <option value="DUPLICATE">Duplicates ({kpiMetrics.duplicates})</option>
              <option value="UNSCREENED">Unscreened ({kpiMetrics.unscreenedCount})</option>
            </select>
          </div>

          {/* 3. Exclusion Trigger Code Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Trigger Code</label>
            <select
              value={ecTriggerFilter}
              onChange={(e) => setEcTriggerFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="">All Triggers</option>
              {availableFilterOptions.triggers.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          {/* 4. PDF Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">PDF Status</label>
            <select
              value={pdfStatusFilter}
              onChange={(e) => setPdfStatusFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="">Any PDF Status</option>
              <option value="SYNCED">SYNCED</option>
              <option value="DOWNLOADED">DOWNLOADED</option>
              <option value="MATCHED">MATCHED</option>
              <option value="MISSING">MISSING</option>
              <option value="INACCESSIBLE">INACCESSIBLE</option>
              <option value="FAILED">FAILED</option>
              <option value="IGNORED">IGNORED</option>
            </select>
          </div>

          {/* 5. Database Source Scope */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Source Scope</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="">All Sources</option>
              {availableFilterOptions.sources.map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>

          {/* 6. Duplicates Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Duplicates</label>
            <select
              value={duplicateFilter}
              onChange={(e) => setDuplicateFilter(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="non-duplicates">Exclude Duplicates</option>
              <option value="all">Include Duplicates</option>
              <option value="duplicates-only">Only Duplicates</option>
            </select>
          </div>

          {/* 7. Calibration Pool */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Calibration Pool</label>
            <select
              value={poolFilter}
              onChange={(e) => setPoolFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
            >
              <option value="">All Papers</option>
              <option value="pool_a">Pool A (Fast Filter)</option>
              <option value="pool_b">Pool B (Gatekeeper)</option>
              <option value="pool_c">Pool C (Scientist/Miner)</option>
              <option value="none">Non-Calibration Only</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Wide Table Area */}
      <div className="flex-1 overflow-auto bg-card relative">
        {allPapers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Layers className="w-12 h-12 mb-3 text-muted-foreground/40" />
            <h3 className="font-bold text-sm text-foreground mb-1">No Papers in Session</h3>
            <p className="text-xs max-w-sm leading-relaxed">
              Import a valid .slr-viewer snapshot file to explore and audit all screening decisions and literature candidates.
            </p>
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Search className="w-12 h-12 mb-3 text-muted-foreground/40" />
            <h3 className="font-bold text-sm text-foreground mb-1">No Matching Papers Found</h3>
            <p className="text-xs max-w-sm leading-relaxed mb-4">
              None of the papers in the corpus match your active search terms and filter criteria.
            </p>
            <button
              onClick={resetAllFilters}
              className="px-3.5 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-lg border border-border transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <table className="w-full table-fixed text-left text-xs border-collapse relative">
            <thead className="sticky top-0 z-20 bg-secondary border-b border-border shadow-sm text-muted-foreground text-[10px] font-bold uppercase select-none">
              <tr>
                {/* 1. Paper ID */}
                <th
                  style={{ width: getColWidth('Paper_ID'), minWidth: getColWidth('Paper_ID'), maxWidth: getColWidth('Paper_ID') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                  onClick={() => handleSort('Paper_ID')}
                >
                  <div className="truncate pr-2">ID {renderSortIndicator('Paper_ID')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Paper_ID')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 2. Title */}
                <th
                  style={{ width: getColWidth('Title'), minWidth: getColWidth('Title'), maxWidth: getColWidth('Title') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                  onClick={() => handleSort('Title')}
                >
                  <div className="truncate pr-2">Title {renderSortIndicator('Title')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Title')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 3. Authors */}
                <th
                  style={{ width: getColWidth('Authors'), minWidth: getColWidth('Authors'), maxWidth: getColWidth('Authors') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                  onClick={() => handleSort('Authors')}
                >
                  <div className="truncate pr-2">Authors {renderSortIndicator('Authors')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Authors')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 4. Year */}
                <th
                  style={{ width: getColWidth('Year'), minWidth: getColWidth('Year'), maxWidth: getColWidth('Year') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 text-center transition-colors relative group"
                  onClick={() => handleSort('Year')}
                >
                  <div className="truncate">Year {renderSortIndicator('Year')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Year')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 5. DOI */}
                <th
                  style={{ width: getColWidth('DOI'), minWidth: getColWidth('DOI'), maxWidth: getColWidth('DOI') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                  onClick={() => handleSort('DOI')}
                >
                  <div className="truncate pr-2">DOI {renderSortIndicator('DOI')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'DOI')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 6. Database Source */}
                <th
                  style={{ width: getColWidth('Source'), minWidth: getColWidth('Source'), maxWidth: getColWidth('Source') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                  onClick={() => handleSort('Source')}
                >
                  <div className="truncate pr-2">Source {renderSortIndicator('Source')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Source')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 7. Stage */}
                <th
                  style={{ width: getColWidth('Stage'), minWidth: getColWidth('Stage'), maxWidth: getColWidth('Stage') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                  onClick={() => handleSort('Stage')}
                >
                  <div className="truncate pr-2">Stage {renderSortIndicator('Stage')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Stage')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 8. Effective Decision */}
                <th
                  style={{ width: getColWidth('Decision'), minWidth: getColWidth('Decision'), maxWidth: getColWidth('Decision') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 text-center transition-colors relative group"
                  onClick={() => handleSort('Decision')}
                >
                  <div className="truncate">Decision {renderSortIndicator('Decision')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Decision')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 9. Exclusion Trigger */}
                <th
                  style={{ width: getColWidth('Exclusion_Trigger'), minWidth: getColWidth('Exclusion_Trigger'), maxWidth: getColWidth('Exclusion_Trigger') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 text-center transition-colors relative group"
                  onClick={() => handleSort('Exclusion_Trigger')}
                >
                  <div className="truncate">Trigger {renderSortIndicator('Exclusion_Trigger')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Exclusion_Trigger')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 10. PDF Status */}
                <th
                  style={{ width: getColWidth('PDF_Status'), minWidth: getColWidth('PDF_Status'), maxWidth: getColWidth('PDF_Status') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                  onClick={() => handleSort('Local_PDF_Status')}
                >
                  <div className="truncate pr-2">PDF Status {renderSortIndicator('Local_PDF_Status')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'PDF_Status')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 11. Citations */}
                <th
                  style={{ width: getColWidth('Citations'), minWidth: getColWidth('Citations'), maxWidth: getColWidth('Citations') }}
                  className="p-2.5 border-r border-border/40 cursor-pointer hover:bg-secondary/70 text-center transition-colors relative group"
                  onClick={() => handleSort('citation_count')}
                >
                  <div className="truncate">Cites {renderSortIndicator('citation_count')}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(e, 'Citations')}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary z-20"
                  />
                </th>

                {/* 12. Actions */}
                <th
                  style={{ width: getColWidth('Actions'), minWidth: getColWidth('Actions'), maxWidth: getColWidth('Actions') }}
                  className="p-2.5 text-center"
                >
                  Inspect
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {paginatedPapers.map(p => {
                const res = resolvePaperScreening(p);
                const isSelected = selectedPaperId === p.Paper_ID;

                return (
                  <tr
                    key={p.Paper_ID}
                    onClick={() => {
                      setSelectedPaperId(p.Paper_ID);
                      setIsModalOpen(true);
                    }}
                    className={`transition-colors group cursor-pointer ${
                      isSelected
                        ? 'bg-primary/15 font-medium'
                        : 'hover:bg-secondary/25'
                    }`}
                  >
                    {/* 1. Paper ID */}
                    <td
                      style={{ width: getColWidth('Paper_ID'), minWidth: getColWidth('Paper_ID'), maxWidth: getColWidth('Paper_ID') }}
                      className="p-2.5 border-r border-border/40 font-mono text-[10.5px] text-muted-foreground font-semibold truncate select-text"
                      title={p.Paper_ID}
                    >
                      {p.Paper_ID}
                    </td>

                    {/* 2. Title */}
                    <td
                      style={{ width: getColWidth('Title'), minWidth: getColWidth('Title'), maxWidth: getColWidth('Title') }}
                      className="p-2.5 border-r border-border/40 truncate"
                      title={p.Title}
                    >
                      <span className="font-bold text-foreground text-xs hover:text-primary transition-colors block truncate">
                        {p.Title || 'Untitled Paper'}
                      </span>
                    </td>

                    {/* 3. Authors */}
                    <td
                      style={{ width: getColWidth('Authors'), minWidth: getColWidth('Authors'), maxWidth: getColWidth('Authors') }}
                      className="p-2.5 border-r border-border/40 text-foreground/80 dark:text-muted-foreground text-[11px] font-medium truncate"
                      title={p.Authors}
                    >
                      {p.Authors || '—'}
                    </td>

                    {/* 4. Year */}
                    <td
                      style={{ width: getColWidth('Year'), minWidth: getColWidth('Year'), maxWidth: getColWidth('Year') }}
                      className="p-2.5 border-r border-border/40 text-center font-mono text-[11px] text-foreground font-bold"
                    >
                      {p.Year || '—'}
                    </td>

                    {/* 5. DOI */}
                    <td
                      style={{ width: getColWidth('DOI'), minWidth: getColWidth('DOI'), maxWidth: getColWidth('DOI') }}
                      className="p-2.5 border-r border-border/40 font-mono text-[10px] text-muted-foreground truncate"
                      title={p.DOI || ''}
                    >
                      {p.DOI || '—'}
                    </td>

                    {/* 6. Database Source */}
                    <td
                      style={{ width: getColWidth('Source'), minWidth: getColWidth('Source'), maxWidth: getColWidth('Source') }}
                      className="p-2.5 border-r border-border/40 text-[11px] text-foreground/80 dark:text-muted-foreground font-medium truncate"
                      title={p.Source || p.Import_Source}
                    >
                      {p.Source || p.Import_Source || '—'}
                    </td>

                    {/* 7. Stage Badge */}
                    <td
                      style={{ width: getColWidth('Stage'), minWidth: getColWidth('Stage'), maxWidth: getColWidth('Stage') }}
                      className="p-2.5 border-r border-border/40 truncate"
                    >
                      {(() => {
                        const phase = res.prismaPhase;
                        if (phase === 'DUPLICATE_REMOVED') {
                          return (
                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border truncate inline-block bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/25 text-orange-700 dark:text-orange-400">
                              Pre-Screening
                            </span>
                          );
                        }
                        if (phase === 'RETRIEVAL_INACCESSIBLE') {
                          return (
                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border truncate inline-block bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/25 text-amber-800 dark:text-amber-400">
                              Retrieval Gate
                            </span>
                          );
                        }
                        const s = res.effectiveStage;
                        const badgeStyle = {
                          0: 'bg-slate-500/10 dark:bg-slate-500/20 border-slate-500/25 text-slate-700 dark:text-slate-300',
                          1: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/25 text-blue-700 dark:text-blue-400',
                          2: 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/25 text-purple-700 dark:text-purple-400',
                          3: 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/25 text-rose-700 dark:text-rose-400',
                          4: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/25 text-emerald-700 dark:text-emerald-400',
                        }[s] || 'bg-secondary border-border text-muted-foreground';

                        const label = {
                          0: '0: Initial',
                          1: '1: Fast Filter',
                          2: '2: Gatekeeper',
                          3: '3: Scientist',
                          4: '4: Miner (Cohort)',
                        }[s] || `Stage ${s}`;

                        return (
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border truncate inline-block ${badgeStyle}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* 8. Effective Decision Badge */}
                    <td
                      style={{ width: getColWidth('Decision'), minWidth: getColWidth('Decision'), maxWidth: getColWidth('Decision') }}
                      className="p-2.5 border-r border-border/40 text-center"
                    >
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1 shadow-xs ${
                        res.prismaPhase === 'DUPLICATE_REMOVED'
                          ? 'bg-orange-500/15 dark:bg-orange-500/20 border-orange-500/30 text-orange-800 dark:text-orange-300'
                          : res.prismaPhase === 'RETRIEVAL_INACCESSIBLE'
                          ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-500/30 text-amber-900 dark:text-amber-300'
                          : res.isIncluded
                          ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                          : res.isExcluded
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300'
                          : 'bg-slate-500/15 dark:bg-slate-500/20 border-slate-500/30 text-slate-800 dark:text-slate-300'
                      }`}>
                        {res.prismaPhase === 'DUPLICATE_REMOVED'
                          ? 'DUPLICATE'
                          : res.prismaPhase === 'RETRIEVAL_INACCESSIBLE'
                          ? 'UNRETRIEVED'
                          : res.effectiveDecision}
                        {p.is_manual_override && <UserCheck className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400 shrink-0" />}
                      </span>
                    </td>

                    {/* 9. Exclusion Trigger Code */}
                    <td
                      style={{ width: getColWidth('Exclusion_Trigger'), minWidth: getColWidth('Exclusion_Trigger'), maxWidth: getColWidth('Exclusion_Trigger') }}
                      className="p-2.5 border-r border-border/40 text-center"
                    >
                      {res.prismaPhase === 'DUPLICATE_REMOVED' ? (
                        <span className="font-mono font-black text-[10px] text-orange-900 dark:text-orange-200 bg-orange-500/15 dark:bg-orange-500/25 px-1.5 py-0.5 rounded border border-orange-500/30 shadow-xs">
                          Duplicate
                        </span>
                      ) : res.prismaPhase === 'RETRIEVAL_INACCESSIBLE' ? (
                        <span className="font-mono font-black text-[10px] text-amber-900 dark:text-amber-200 bg-amber-500/15 dark:bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/30 shadow-xs">
                          PDF Inaccessible
                        </span>
                      ) : res.effectiveEc ? (
                        <span className="font-mono font-black text-[10px] text-rose-900 dark:text-rose-200 bg-rose-500/15 dark:bg-rose-500/25 px-1.5 py-0.5 rounded border border-rose-500/30 shadow-xs" title={ecMap[res.effectiveEc] || res.effectiveEc}>
                          {res.effectiveEc}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 italic text-[10px]">—</span>
                      )}
                    </td>

                    {/* 10. PDF Status */}
                    <td
                      style={{ width: getColWidth('PDF_Status'), minWidth: getColWidth('PDF_Status'), maxWidth: getColWidth('PDF_Status') }}
                      className="p-2.5 border-r border-border/40 truncate"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          p.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
                          p.Local_PDF_Status === 'DOWNLOADED' || p.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500' :
                          p.Local_PDF_Status === 'INACCESSIBLE' ? 'bg-rose-500' :
                          'bg-slate-500'
                        }`} />
                        <span className="text-[10px] font-bold uppercase truncate">
                          {p.Local_PDF_Status || 'UNKNOWN'}
                        </span>
                        {p.PDF_Link && (
                          <a
                            href={p.PDF_Link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-0.5 text-primary hover:underline ml-auto shrink-0"
                            title="Open PDF file"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* 11. Citations */}
                    <td
                      style={{ width: getColWidth('Citations'), minWidth: getColWidth('Citations'), maxWidth: getColWidth('Citations') }}
                      className="p-2.5 border-r border-border/40 text-center font-mono text-[10px] font-semibold text-muted-foreground"
                    >
                      {p.citation_count ?? '0'}
                    </td>

                    {/* 12. Inspect Action */}
                    <td
                      style={{ width: getColWidth('Actions'), minWidth: getColWidth('Actions'), maxWidth: getColWidth('Actions') }}
                      className="p-2.5 text-center"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPaperId(p.Paper_ID);
                          setIsModalOpen(true);
                        }}
                        className="p-1 px-2 hover:bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer hover:scale-105"
                        title="Inspect paper details, abstract, and screening history"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Table Pagination Footer Bar */}
      <div className="px-6 py-3 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0 select-none text-xs">
        <div className="text-[11px] text-muted-foreground font-semibold">
          Showing {total ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total.toLocaleString()} papers
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-semibold">Rows per page:</span>
            <select
              className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold cursor-pointer"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100, 250].map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-2.5">
              {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Paper Inspection Modal */}
      {isModalOpen && activePaper && (
        <PaperInspectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          paper={activePaper}
          onNavigate={handleModalNavigate}
          hasPrev={activePaperIndex > 0}
          hasNext={activePaperIndex < sortedPapers.length - 1}
          currentIndex={activePaperIndex}
          totalPapers={sortedPapers.length}
          ecRules={ecRules}
        />
      )}
    </div>
  );
}
