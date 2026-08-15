import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, Cpu, ArrowDown, ArrowUp, Filter, Layers } from 'lucide-react';
import VectorBuildModal from '../VectorBuildModal';

interface PaperSelectionListProps {
  assignSearch: string;
  setAssignSearch: (v: string) => void;
  assignPoolFilter: string;
  setAssignPoolFilter: (v: string) => void;
  assignLoading: boolean;
  assignPapers: any[];
  assignSelectedPaper: any;
  setAssignSelectedPaper: React.Dispatch<React.SetStateAction<any>>;
  assignIsRunning: boolean;
  setAssignLogs: React.Dispatch<React.SetStateAction<any[]>>;
  setAssignProgress: React.Dispatch<React.SetStateAction<number>>;
  setAssignStatusText: (v: string) => void;
  assignTotalPapers: number;
  assignPage: number;
  setAssignPage: React.Dispatch<React.SetStateAction<number>>;
  assignTotalPages: number;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  assignSearchMode: 'keyword' | 'semantic';
  setAssignSearchMode: React.Dispatch<React.SetStateAction<'keyword' | 'semantic'>>;
  vectorIndexStatus: {
    indexed: boolean;
    pdf_count: number;
    paper_count: number;
    project_id?: string;
    total_project_papers?: number;
    indexed_project_papers?: number;
    missing_project_papers?: number;
    coverage_pct?: number;
    model?: string;
  } | null;
  loadVectorStatus: () => Promise<void>;
  isMinimized: boolean;
  assignSortBy: string;
  setAssignSortBy: React.Dispatch<React.SetStateAction<string>>;
  assignSortOrder: 'ASC' | 'DESC';
  setAssignSortOrder: React.Dispatch<React.SetStateAction<'ASC' | 'DESC'>>;
  assignSearchTime: number | null;
  triggerSemanticSearch: () => void;
  assignExcludeReviews: boolean;
  setAssignExcludeReviews: React.Dispatch<React.SetStateAction<boolean>>;
  assignPublisherFilter: string;
  setAssignPublisherFilter: (val: string) => void;
  assignPdfFilter: string;
  setAssignPdfFilter: (val: string) => void;
  assignSourceFilter: string;
  setAssignSourceFilter: (val: string) => void;
  assignDoiStatusFilter: string;
  setAssignDoiStatusFilter: (val: string) => void;
  assignPdfLinkFilter: string;
  setAssignPdfLinkFilter: (val: string) => void;
  assignPipelineStageFilter: string;
  setAssignPipelineStageFilter: (val: string) => void;
  assignPipelineStatusFilter: string;
  setAssignPipelineStatusFilter: (val: string) => void;
  assignEcTriggerFilter: string;
  setAssignEcTriggerFilter: (val: string) => void;
  uniquePublishers: string[];
  ecTriggers: string[];
  loadingEcTriggers: boolean;
}

export default function PaperSelectionList({
  assignSearch,
  setAssignSearch,
  assignPoolFilter,
  setAssignPoolFilter,
  assignLoading,
  assignPapers,
  assignSelectedPaper,
  setAssignSelectedPaper,
  assignIsRunning,
  setAssignLogs,
  setAssignProgress,
  setAssignStatusText,
  assignTotalPapers,
  assignPage,
  setAssignPage,
  assignTotalPages,
  showToast,
  assignSearchMode,
  setAssignSearchMode,
  vectorIndexStatus,
  loadVectorStatus,
  isMinimized,
  assignSortBy,
  setAssignSortBy,
  assignSortOrder,
  setAssignSortOrder,
  assignSearchTime,
  triggerSemanticSearch,
  assignExcludeReviews,
  setAssignExcludeReviews,
  assignPublisherFilter,
  setAssignPublisherFilter,
  assignPdfFilter,
  setAssignPdfFilter,
  assignSourceFilter,
  setAssignSourceFilter,
  assignDoiStatusFilter,
  setAssignDoiStatusFilter,
  assignPdfLinkFilter,
  setAssignPdfLinkFilter,
  assignPipelineStageFilter,
  setAssignPipelineStageFilter,
  assignPipelineStatusFilter,
  setAssignPipelineStatusFilter,
  assignEcTriggerFilter,
  setAssignEcTriggerFilter,
  uniquePublishers,
  ecTriggers,
  loadingEcTriggers
}: PaperSelectionListProps) {
  const [showBuildModal, setShowBuildModal] = useState(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPipelineFilters, setShowPipelineFilters] = useState(false);
  const pipelineFiltersRef = useRef<HTMLDivElement>(null);
  const advancedFiltersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pipelineFiltersRef.current && !pipelineFiltersRef.current.contains(event.target as Node)) {
        setShowPipelineFilters(false);
      }
      if (advancedFiltersRef.current && !advancedFiltersRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const clearAllFilters = () => {
    setAssignPoolFilter('all');
    setAssignPublisherFilter('all');
    setAssignPdfFilter('');
    setAssignSourceFilter('');
    setAssignDoiStatusFilter('');
    setAssignPdfLinkFilter('');
  };

  const clearPipelineFilters = () => {
    setAssignPipelineStageFilter('');
    setAssignPipelineStatusFilter('');
    setAssignEcTriggerFilter('');
  };

  useEffect(() => {
    if (!assignSelectedPaper || !listContainerRef.current) return;
    
    const selectedEl = listContainerRef.current.querySelector(
      `[data-paper-id="${assignSelectedPaper.Paper_ID}"]`
    ) as HTMLElement;
    
    if (selectedEl) {
      listContainerRef.current.scrollTo({
        top: selectedEl.offsetTop,
        behavior: 'smooth'
      });
    }
  }, [assignSelectedPaper?.Paper_ID, assignPapers, assignLoading]);

  return (
    <div className={`bg-card/30 flex flex-col overflow-hidden shrink-0 transition-all duration-300 ${
      isMinimized ? 'w-[380px] border-r border-border' : 'flex-1'
    }`}>
      {/* Search and pool filter */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        {/* Row 1: Search Input & Mode Switcher */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground/70 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={assignSearchMode === 'semantic' ? "Semantic query (press Enter)..." : "Search papers..."}
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && assignSearchMode === 'semantic') {
                  triggerSemanticSearch();
                }
              }}
              className={`w-full bg-secondary/40 border border-border rounded-xl pl-9 py-2 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60 transition-colors font-semibold ${
                assignSearchMode === 'semantic' ? 'pr-16' : 'pr-4'
              }`}
            />
            {assignSearchMode === 'semantic' && (
              <button
                onClick={triggerSemanticSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[9px] font-bold uppercase transition-all duration-200 cursor-pointer select-none active:scale-95"
                title="Run Semantic Search"
              >
                Search
              </button>
            )}
          </div>
          <button
            onClick={() => setAssignSearchMode(prev => prev === 'keyword' ? 'semantic' : 'keyword')}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 ${
              assignSearchMode === 'semantic'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle between Keyword filter and Vector Semantic Search"
          >
            <Cpu className="w-4 h-4" />
            <span>{assignSearchMode === 'semantic' ? 'Semantic' : 'Keyword'}</span>
          </button>

          {assignSearchMode === 'semantic' && vectorIndexStatus && (
            <button
              onClick={() => setShowBuildModal(true)}
              title={vectorIndexStatus.indexed ? "Active project vector index 100% complete. Click to rebuild." : `Active project vector index incomplete (${vectorIndexStatus.indexed_project_papers ?? 0}/${vectorIndexStatus.total_project_papers ?? 0}). Click to build.`}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm shrink-0 ${
                vectorIndexStatus.indexed
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/25 animate-pulse'
              }`}
            >
              <span>{vectorIndexStatus.indexed ? '⚡' : '⚠️'}</span>
              <span>
                {vectorIndexStatus.total_project_papers !== undefined
                  ? `${vectorIndexStatus.indexed_project_papers ?? 0}/${vectorIndexStatus.total_project_papers} Indexed`
                  : `${vectorIndexStatus.paper_count} Indexed`}
              </span>
            </button>
          )}
        </div>

        {/* Row 2: Select Filters and Toggles */}
        <div className="flex items-center gap-2">
          {/* Screening Pipeline Filters Button */}
          <div className="relative" ref={pipelineFiltersRef}>
            <button
              onClick={() => {
                setShowPipelineFilters(!showPipelineFilters);
                setShowFilters(false);
              }}
              className={`px-2.5 py-1.5 border rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                showPipelineFilters || assignPipelineStageFilter || assignPipelineStatusFilter || assignEcTriggerFilter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/40 text-foreground border-border hover:bg-secondary/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Screening Pipeline</span>
              {(assignPipelineStageFilter || assignPipelineStatusFilter || assignEcTriggerFilter) && (
                <span className="ml-1 px-1 py-0.2 rounded-full bg-background/25 text-[9px]">
                  {[assignPipelineStageFilter, assignPipelineStatusFilter, assignEcTriggerFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            {showPipelineFilters && (
              <div className="absolute top-full left-0 mt-2 w-60 bg-card border border-border rounded-xl shadow-xl z-50 p-3.5 flex flex-col gap-2.5 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Screening Pipeline Filters</span>
                  <button onClick={clearPipelineFilters} className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline">Clear</button>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Pipeline Stage</label>
                  <select 
                    className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-semibold" 
                    value={assignPipelineStageFilter} 
                    onChange={(e) => {
                      setAssignPipelineStageFilter(e.target.value);
                      setAssignPipelineStatusFilter('');
                      setAssignEcTriggerFilter('');
                    }}
                  >
                    <option value="">Any Stage</option>
                    <option value="1">Stage 1: Fast Filter</option>
                    <option value="2">Stage 2: Gatekeeper</option>
                    <option value="3">Stage 3: Scientist</option>
                    <option value="4">Stage 4: Miner</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Pipeline Status</label>
                  <select 
                    className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-semibold" 
                    value={assignPipelineStatusFilter} 
                    onChange={(e) => setAssignPipelineStatusFilter(e.target.value)}
                    disabled={!assignPipelineStageFilter}
                  >
                    <option value="">Any Status</option>
                    {assignPipelineStageFilter === '1' && (
                      <>
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                        <option value="unprocessed">Unprocessed</option>
                      </>
                    )}
                    {assignPipelineStageFilter === '2' && (
                      <>
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                        <option value="unprocessed">Unprocessed (Has PDF)</option>
                        <option value="ready_for_ai">Unprocessed (Ready for AI — SYNCED PDF)</option>
                        <option value="pending_pdf">Pending PDF</option>
                      </>
                    )}
                    {assignPipelineStageFilter === '3' && (
                      <>
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                        <option value="unprocessed">Unprocessed (Has PDF)</option>
                        <option value="ready_for_ai">Unprocessed (Ready for AI — SYNCED PDF)</option>
                      </>
                    )}
                    {assignPipelineStageFilter === '4' && (
                      <>
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                        <option value="unprocessed">Unprocessed (Has PDF)</option>
                        <option value="ready_for_ai">Unprocessed (Ready for AI — SYNCED PDF)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Exclusion Trigger</label>
                  <select 
                    className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-semibold" 
                    value={assignEcTriggerFilter} 
                    onChange={(e) => setAssignEcTriggerFilter(e.target.value)}
                    disabled={loadingEcTriggers}
                  >
                    <option value="">Any Exclusion Trigger</option>
                    <option value="Unspecified">Unspecified / No Code</option>
                    {ecTriggers.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Filters Button */}
          <div className="relative" ref={advancedFiltersRef}>
            <button
              onClick={() => {
                setShowFilters(!showFilters);
                setShowPipelineFilters(false);
              }}
              className={`px-2.5 py-1.5 border rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                showFilters || assignPoolFilter !== 'all' || assignPublisherFilter !== 'all' || assignPdfFilter || assignSourceFilter || assignDoiStatusFilter || assignPdfLinkFilter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/40 text-foreground border-border hover:bg-secondary/60'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {(assignPoolFilter !== 'all' || assignPublisherFilter !== 'all' || assignPdfFilter || assignSourceFilter || assignDoiStatusFilter || assignPdfLinkFilter) && (
                <span className="ml-1 px-1 py-0.2 rounded-full bg-background/25 text-[9px]">
                  {[assignPoolFilter !== 'all', assignPublisherFilter !== 'all', assignPdfFilter, assignSourceFilter, assignDoiStatusFilter, assignPdfLinkFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            {showFilters && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 p-3.5 flex flex-col gap-2.5 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Advanced Filters</span>
                  <button onClick={clearAllFilters} className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline">Clear All</button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Calibration Pool</label>
                  <select
                    value={assignPoolFilter}
                    onChange={(e) => setAssignPoolFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                  >
                    <option value="all">All Papers</option>
                    <option value="unassigned">Unassigned</option>
                    <option value="pool_a">Pool A</option>
                    <option value="pool_b">Pool B</option>
                    <option value="pool_c">Pool C</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Publisher (Mapped)</label>
                  <select
                    value={assignPublisherFilter}
                    onChange={(e) => setAssignPublisherFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                  >
                    <option value="all">Publisher (Mapped)</option>
                    {uniquePublishers.map((pub) => (
                      <option key={pub} value={pub} title={pub}>
                        {pub}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">PDF Status</label>
                  <select
                    value={assignPdfFilter}
                    onChange={(e) => setAssignPdfFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                  >
                    <option value="">Any PDF Status</option>
                    <option value="IGNORED">IGNORED</option>
                    <option value="MISSING">MISSING</option>
                    <option value="INACCESSIBLE">INACCESSIBLE</option>
                    <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                    <option value="MATCHED">MATCHED</option>
                    <option value="DOWNLOADED">DOWNLOADED</option>
                    <option value="SYNCED">SYNCED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Source Scope</label>
                  <select
                    value={assignSourceFilter}
                    onChange={(e) => setAssignSourceFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                  >
                    <option value="">Any Source</option>
                    <option value="manual">Manual Ingestion</option>
                    <option value="backward">Backward Snowball</option>
                    <option value="forward">Forward Snowball</option>
                    <option value="csv">CSV Import</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">DOI Status</label>
                  <select
                    value={assignDoiStatusFilter}
                    onChange={(e) => setAssignDoiStatusFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                  >
                    <option value="">Any DOI Status</option>
                    <option value="has_doi">Has DOI</option>
                    <option value="empty">Empty DOI</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">PDF Link Status</label>
                  <select
                    value={assignPdfLinkFilter}
                    onChange={(e) => setAssignPdfLinkFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                  >
                    <option value="">Any PDF Link Status</option>
                    <option value="has_link">Has PDF Link</option>
                    <option value="empty">Empty PDF Link</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {assignSearchMode === 'semantic' && (
          <div className="flex items-center gap-1.5 select-none pt-0.5 animate-in fade-in duration-200">
            <input
              type="checkbox"
              id="excludeReviews"
              checked={assignExcludeReviews}
              onChange={(e) => setAssignExcludeReviews(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border bg-secondary/40 text-primary focus:ring-0 cursor-pointer"
            />
            <label htmlFor="excludeReviews" className="text-[10px] font-bold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Filter out reviews & surveys (increases search precision)
            </label>
          </div>
        )}

        {assignSearchMode === 'semantic' && vectorIndexStatus && !vectorIndexStatus.indexed && (
          <div className="p-2.5 border border-amber-500/30 bg-amber-500/10 rounded-xl flex flex-col gap-1.5 text-[9px] animate-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 text-[10px]">
              <Cpu className="w-3.5 h-3.5 animate-pulse" />
              <span>
                {vectorIndexStatus.total_project_papers && vectorIndexStatus.missing_project_papers
                  ? `Active Project Vector Index Incomplete (${vectorIndexStatus.indexed_project_papers}/${vectorIndexStatus.total_project_papers} Indexed)`
                  : 'Vector Semantic Search Index Required'}
              </span>
            </div>
            <p className="text-muted-foreground font-medium leading-relaxed">
              {vectorIndexStatus.missing_project_papers
                ? `The active project has ${vectorIndexStatus.missing_project_papers} unindexed paper(s). Semantic queries require vector embeddings to rank candidates.`
                : 'To run semantic searches, vector embeddings must be built for the active project corpus.'}
            </p>
            <button
              onClick={() => setShowBuildModal(true)}
              className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-center transition-colors shadow-sm cursor-pointer uppercase tracking-wider text-[9px]"
            >
              Build Semantic Index Now
            </button>
          </div>
        )}



        {/* Sorting Toolbar */}
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground pt-2 border-t border-border/40 select-none">
          <span className="uppercase tracking-wider">Sort by</span>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'citation_count', label: 'Citations' },
              { id: 'Year', label: 'Year' },
              ...(assignSearchMode === 'semantic' ? [{ id: 'semantic_score', label: 'Match %' }] : [])
            ].map((option) => {
              const isActive = assignSortBy === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      setAssignSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
                    } else {
                      setAssignSortBy(option.id);
                      setAssignSortOrder('DESC'); // Default to descending
                    }
                  }}
                  className={`px-2 py-0.5 rounded transition-colors flex items-center gap-0.5 cursor-pointer ${
                    isActive ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-secondary/40 border border-transparent'
                  }`}
                >
                  <span>{option.label}</span>
                  {isActive && (
                    assignSortOrder === 'DESC' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Query execution metadata */}
        {assignSearchTime !== null && !assignLoading && (
          <div className="mt-2 px-2.5 py-1 bg-secondary/15 border border-border/30 rounded-lg text-[9px] text-muted-foreground font-semibold flex items-center justify-between select-none animate-in fade-in duration-200">
            <span className="flex items-center gap-1">
              {assignSearchMode === 'semantic' ? '🧠' : '🔍'}
              <span>
                {assignSearchMode === 'semantic' 
                  ? `Semantic query processed in ${(assignSearchTime / 1000).toFixed(2)}s`
                  : `Database query processed in ${(assignSearchTime / 1000).toFixed(2)}s`}
              </span>
            </span>
            {assignSearchMode === 'semantic' && (
              <span className="text-[8px] bg-primary/10 border border-primary/20 text-primary px-1 py-0.2 rounded uppercase font-bold shrink-0">
                Top 200 Nearest Neighbors
              </span>
            )}
          </div>
        )}
      </div>

      {/* Papers List */}
      <div ref={listContainerRef} className="relative flex-1 overflow-y-auto divide-y divide-border/60">
        {assignLoading ? (
          <div className="p-6 m-4 text-center text-muted-foreground text-xs flex flex-col items-center gap-3 bg-secondary/10 border border-border/40 rounded-xl animate-pulse">
            <div className="relative">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              {assignSearchMode === 'semantic' && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] select-none">🧠</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-foreground">
                {assignSearchMode === 'semantic' ? "Semantic Similarity Search" : "Keyword Search"}
              </span>
              <span className="text-[9px] text-muted-foreground font-medium leading-relaxed max-w-[280px]">
                {assignSearchMode === 'semantic' 
                  ? "Resolving calibration filters, loading nomic-embed model weights, and searching SIMD-accelerated turbovec index..." 
                  : "Scanning local SQLite index utilising LIKE pattern queries..."}
              </span>
            </div>
          </div>
        ) : assignPapers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-3">
            {assignSearchMode === 'semantic' && vectorIndexStatus && !vectorIndexStatus.indexed ? (
              <div className="max-w-[320px] p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                <div className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5">
                  <Cpu className="w-4 h-4 animate-pulse" />
                  <span>Active Project Not Indexed</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  The active project ({vectorIndexStatus.total_project_papers || 0} papers) does not have embedded vector representations yet.
                </p>
                <button
                  onClick={() => setShowBuildModal(true)}
                  className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
                >
                  Build Semantic Index Now
                </button>
              </div>
            ) : assignSearchMode === 'semantic' ? (
              <div className="max-w-[300px] space-y-1">
                <p className="font-semibold text-foreground text-xs">No semantic matches found</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  No papers matched your query above the similarity threshold (0.65). Try broadening your search terms or clearing active filters.
                </p>
              </div>
            ) : (
              <span>No papers found matching filters.</span>
            )}
          </div>
        ) : (
          assignPapers.map((paper: any) => {
            const isSelected = assignSelectedPaper?.Paper_ID === paper.Paper_ID;
            if (isMinimized) {
              return (
                <div
                  key={paper.Paper_ID}
                  data-paper-id={paper.Paper_ID}
                  onClick={() => {
                    if (!assignIsRunning) {
                      setAssignSelectedPaper(paper);
                      setAssignLogs([]);
                      setAssignProgress(0);
                      setAssignStatusText('Idle');
                    }
                  }}
                  className={`p-3 cursor-pointer select-none transition-all duration-200 border-l-4 ${
                    isSelected ? 'bg-primary/15 border-primary shadow-inner font-semibold' : 'hover:bg-secondary/40 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-mono text-[9px] font-bold text-muted-foreground/80 truncate max-w-[120px] bg-secondary/80 px-1 py-0.5 rounded border border-border/40" title={paper.Paper_ID}>{paper.Paper_ID}</span>
                      {assignSearchMode === 'semantic' && paper.semantic_score !== undefined && (
                        <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded border font-mono ${
                          paper.semantic_score >= 0.75 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          paper.semantic_score >= 0.65 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`} title={`Cosine Similarity: ${paper.semantic_score.toFixed(4)}`}>
                          {(paper.semantic_score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {paper.calibration_pool && (
                      <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                        paper.calibration_pool === 'pool_a' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                        paper.calibration_pool === 'pool_b' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {paper.calibration_pool.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-relaxed">{paper.Title}</h4>
                  <p className="text-[9px] text-muted-foreground truncate">{paper.Authors || 'Unknown Author'} • {paper.Year || '—'}</p>
                </div>
              );
            } else {
              return (
                <div
                  key={paper.Paper_ID}
                  data-paper-id={paper.Paper_ID}
                  className="p-5 hover:bg-secondary/20 transition-all border-b border-border/60 flex flex-col gap-2 relative group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      {/* Paper Title (styled like a search engine link) */}
                      <h4
                        onClick={() => {
                          if (!assignIsRunning) {
                            setAssignSelectedPaper(paper);
                            setAssignLogs([]);
                            setAssignProgress(0);
                            setAssignStatusText('Idle');
                          }
                        }}
                        className="text-base font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer leading-snug"
                      >
                        {paper.Title}
                      </h4>
                      
                      {/* Authors & Publisher Line */}
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                        {paper.Authors || 'Unknown Author'} — {paper.Publisher || paper.Original_Publisher || 'Unknown Publisher'}, {paper.Year || '—'}
                      </p>
                    </div>

                    {/* Calibration Pool Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {paper.calibration_pool ? (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider ${
                          paper.calibration_pool === 'pool_a' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                          paper.calibration_pool === 'pool_b' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {paper.calibration_pool.replace('_', ' ')}
                          {paper.calibration_tag && ` - ${paper.calibration_tag}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 bg-secondary text-muted-foreground border border-border/40 rounded uppercase tracking-wider">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Abstract snippet */}
                  {paper.Abstract && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed select-text font-medium max-w-4xl">
                      {paper.Abstract}
                    </p>
                  )}

                  {/* Metrics & Info Footer */}
                  <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-muted-foreground/80 mt-1 select-none">
                    <span className="font-mono bg-secondary/60 px-1.5 py-0.5 rounded border border-border/40" title="Paper ID">
                      {paper.Paper_ID}
                    </span>
                    
                    {paper.citation_count !== undefined && paper.citation_count !== null && (
                      <span className="flex items-center gap-1 text-primary">
                        📊 Cited by {paper.citation_count}
                      </span>
                    )}

                    {paper.semantic_score !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded border font-mono ${
                        paper.semantic_score >= 0.75 ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/30' :
                        paper.semantic_score >= 0.65 ? 'bg-amber-500/25 text-amber-400 border-amber-500/30' :
                        'bg-rose-500/25 text-rose-400 border-rose-500/30'
                      }`}>
                        🧠 Match: {(paper.semantic_score * 100).toFixed(0)}%
                      </span>
                    )}

                    {paper.DOI && (
                      <span className="font-mono text-muted-foreground/60 select-text">
                        DOI: {paper.DOI}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          })
        )}
      </div>

      {/* sticky bottom page controls inside list */}
      <div className="p-3 border-t border-border bg-secondary/10 flex items-center justify-between shrink-0 select-none">
        <span className="text-[9px] text-muted-foreground font-semibold">Total: {assignTotalPapers}</span>
        <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
          <button
            disabled={assignPage === 1 || assignIsRunning}
            onClick={() => setAssignPage((prev: number) => Math.max(1, prev - 1))}
            className="p-1 hover:bg-background rounded text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[9px] font-bold px-1.5">{assignPage} / {assignTotalPages}</span>
          <button
            disabled={assignPage === assignTotalPages || assignIsRunning}
            onClick={() => setAssignPage((prev: number) => Math.min(assignTotalPages, prev + 1))}
            className="p-1 hover:bg-background rounded text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      <VectorBuildModal
        isOpen={showBuildModal}
        onClose={() => setShowBuildModal(false)}
        loadVectorStatus={loadVectorStatus}
        onBuildSuccess={() => {
          triggerSemanticSearch();
        }}
        showToast={showToast}
      />
    </div>
  );
}
