import React, { useRef, useEffect, useState } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, Cpu, ArrowDown, ArrowUp, Tag, Filter } from 'lucide-react';
import { Paper } from '@/types';

interface ManualScreeningListProps {
  screeningSearch: string;
  setScreeningSearch: (v: string) => void;
  screeningSearchMode: 'keyword' | 'semantic';
  setScreeningSearchMode: React.Dispatch<React.SetStateAction<'keyword' | 'semantic'>>;
  screeningStageFilter: string;
  setScreeningStageFilter: (v: string) => void;
  screeningDecisionFilter: string;
  setScreeningDecisionFilter: (v: string) => void;
  pdfFilter?: string;
  setPdfFilter?: (v: string) => void;
  sourceFilter?: string;
  setSourceFilter?: (v: string) => void;
  doiStatusFilter?: string;
  setDoiStatusFilter?: (v: string) => void;
  pdfLinkFilter?: string;
  setPdfLinkFilter?: (v: string) => void;
  pipelineStageFilter?: string;
  setPipelineStageFilter?: (v: string) => void;
  pipelineStatusFilter?: string;
  setPipelineStatusFilter?: (v: string) => void;
  ecTriggerFilter?: string;
  setEcTriggerFilter?: (v: string) => void;
  ecTriggers?: string[];
  loadingEcTriggers?: boolean;
  clearAllFilters?: () => void;
  screeningSortBy: string;
  setScreeningSortBy: React.Dispatch<React.SetStateAction<string>>;
  screeningSortOrder: 'ASC' | 'DESC';
  setScreeningSortOrder: React.Dispatch<React.SetStateAction<'ASC' | 'DESC'>>;
  screeningLoading: boolean;
  screeningPapers: Paper[];
  screeningSelectedPaper: Paper | null;
  setScreeningSelectedPaper: React.Dispatch<React.SetStateAction<Paper | null>>;
  screeningTotalPapers: number;
  screeningPage: number;
  setScreeningPage: React.Dispatch<React.SetStateAction<number>>;
  screeningTotalPages: number;
  screeningSearchTime: number | null;
  triggerSemanticSearch: () => void;
  isMinimized?: boolean;
}

export default function ManualScreeningList({
  screeningSearch,
  setScreeningSearch,
  screeningSearchMode,
  setScreeningSearchMode,
  screeningStageFilter,
  setScreeningStageFilter,
  screeningDecisionFilter,
  setScreeningDecisionFilter,
  pdfFilter = '',
  setPdfFilter,
  sourceFilter = '',
  setSourceFilter,
  doiStatusFilter = '',
  setDoiStatusFilter,
  pdfLinkFilter = '',
  setPdfLinkFilter,
  pipelineStageFilter = '',
  setPipelineStageFilter,
  pipelineStatusFilter = '',
  setPipelineStatusFilter,
  ecTriggerFilter = '',
  setEcTriggerFilter,
  ecTriggers = [],
  loadingEcTriggers = false,
  clearAllFilters,
  screeningSortBy,
  setScreeningSortBy,
  screeningSortOrder,
  setScreeningSortOrder,
  screeningLoading,
  screeningPapers,
  screeningSelectedPaper,
  setScreeningSelectedPaper,
  screeningTotalPapers,
  screeningPage,
  setScreeningPage,
  screeningTotalPages,
  screeningSearchTime,
  triggerSemanticSearch,
  isMinimized = false
}: ManualScreeningListProps) {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Auto-scroll list to active paper on select
  useEffect(() => {
    if (!screeningSelectedPaper || !listContainerRef.current) return;
    const selectedEl = listContainerRef.current.querySelector(
      `[data-paper-id="${screeningSelectedPaper.Paper_ID}"]`
    ) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [screeningSelectedPaper?.Paper_ID, screeningLoading]);

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && screeningSearchMode === 'semantic') {
      triggerSemanticSearch();
    }
  };

  const toggleSortOrder = () => {
    setScreeningSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
  };

  const handleClearAll = () => {
    if (clearAllFilters) {
      clearAllFilters();
    } else {
      setScreeningStageFilter('');
      setScreeningDecisionFilter('');
      if (setPdfFilter) setPdfFilter('');
      if (setSourceFilter) setSourceFilter('');
      if (setDoiStatusFilter) setDoiStatusFilter('');
      if (setPdfLinkFilter) setPdfLinkFilter('');
      if (setPipelineStageFilter) setPipelineStageFilter('');
      if (setPipelineStatusFilter) setPipelineStatusFilter('');
      if (setEcTriggerFilter) setEcTriggerFilter('');
    }
  };

  const anyActiveFilter = !!(
    screeningStageFilter ||
    screeningDecisionFilter ||
    pdfFilter ||
    sourceFilter ||
    doiStatusFilter ||
    pdfLinkFilter ||
    pipelineStageFilter ||
    pipelineStatusFilter ||
    ecTriggerFilter
  );

  const activeFilterCount = [
    screeningStageFilter,
    screeningDecisionFilter,
    pdfFilter,
    sourceFilter,
    doiStatusFilter,
    pdfLinkFilter,
    pipelineStageFilter,
    pipelineStatusFilter,
    ecTriggerFilter
  ].filter(Boolean).length;

  return (
    <div className={`bg-card/30 flex flex-col overflow-hidden shrink-0 transition-all duration-300 ${
      isMinimized ? 'w-[380px] border-r border-border' : 'flex-1'
    }`}>
      {/* Search Filter Controls */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={screeningSearchMode === 'semantic' ? "Query semantic search & press Enter..." : "Search title, author, abstract..."}
              value={screeningSearch}
              onChange={(e) => setScreeningSearch(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary shadow-inner"
            />
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          </div>
          <button
            onClick={() => setScreeningSearchMode(prev => prev === 'keyword' ? 'semantic' : 'keyword')}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
              screeningSearchMode === 'semantic'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle between Keyword filter and Vector Semantic Search"
          >
            <Cpu className="w-4 h-4" />
            <span>{screeningSearchMode === 'semantic' ? 'Semantic' : 'Keyword'}</span>
          </button>
        </div>

        {/* Unified Filter Button Popover Row */}
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground pt-1">
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                anyActiveFilter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {anyActiveFilter && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-background/20 text-[10px] text-current">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilters && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 p-4 flex flex-col gap-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">Unified Workspace Filters</span>
                  <button
                    onClick={handleClearAll}
                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {/* Category 1: Human Screening */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">Human Screening</span>
                    
                    {/* Manual Screening Decision */}
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Manual Decision</label>
                      <select
                        value={screeningDecisionFilter}
                        onChange={(e) => setScreeningDecisionFilter(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      >
                        <option value="">All Decisions</option>
                        <option value="none">Unscreened (Pending)</option>
                        <option value="INCLUDE">INCLUDE</option>
                        <option value="EXCLUDE">EXCLUDE</option>
                        <option value="UNCERTAIN">UNCERTAIN</option>
                      </select>
                    </div>

                    {/* Human Screening Stage Filter */}
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Human Stage</label>
                      <select
                        value={screeningStageFilter}
                        onChange={(e) => setScreeningStageFilter(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      >
                        <option value="">All Stages</option>
                        <option value="none">None Assigned</option>
                        <option value="fast_filter">Fast Filter</option>
                        <option value="gatekeeper">Gatekeeper</option>
                        <option value="scientist">Scientist</option>
                        <option value="miner">Miner</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-border/40 my-0.5" />

                  {/* Category 2: AI Pipeline */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">AI Pipeline Stage & Status</span>
                    
                    {/* Pipeline Stage */}
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Pipeline Stage</label>
                      <select
                        value={pipelineStageFilter}
                        onChange={(e) => {
                          if (setPipelineStageFilter) setPipelineStageFilter(e.target.value);
                          if (setPipelineStatusFilter) setPipelineStatusFilter('');
                          if (setEcTriggerFilter) setEcTriggerFilter('');
                        }}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      >
                        <option value="">All Pipeline Stages</option>
                        <option value="1">Stage 1: Fast Filter</option>
                        <option value="2">Stage 2: Gatekeeper</option>
                        <option value="3">Stage 3: Scientist</option>
                        <option value="4">Stage 4: Miner</option>
                      </select>
                    </div>

                    {/* Pipeline Status (Stage-dependent) */}
                    {pipelineStageFilter && (
                      <div className="flex flex-col gap-1 text-[10px] font-bold">
                        <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Pipeline Status</label>
                        <select
                          value={pipelineStatusFilter}
                          onChange={(e) => setPipelineStatusFilter && setPipelineStatusFilter(e.target.value)}
                          className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                        >
                          <option value="">All Pipeline Statuses</option>
                          {pipelineStageFilter === '1' && (
                            <>
                              <option value="included">Included</option>
                              <option value="excluded">Excluded</option>
                              <option value="unprocessed">Unprocessed</option>
                            </>
                          )}
                          {pipelineStageFilter === '2' && (
                            <>
                              <option value="included">Included</option>
                              <option value="excluded">Excluded</option>
                              <option value="unprocessed">Unprocessed (Has PDF)</option>
                              <option value="ready_for_ai">Unprocessed (Ready for AI — SYNCED PDF)</option>
                              <option value="pending_pdf">Pending PDF</option>
                            </>
                          )}
                          {(pipelineStageFilter === '3' || pipelineStageFilter === '4') && (
                            <>
                              <option value="included">Included</option>
                              <option value="excluded">Excluded</option>
                              <option value="unprocessed">Unprocessed (Has PDF)</option>
                              <option value="ready_for_ai">Unprocessed (Ready for AI — SYNCED PDF)</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}

                    {/* Exclusion Trigger */}
                    {pipelineStageFilter && (
                      <div className="flex flex-col gap-1 text-[10px] font-bold">
                        <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Exclusion Trigger</label>
                        <select
                          value={ecTriggerFilter}
                          onChange={(e) => setEcTriggerFilter && setEcTriggerFilter(e.target.value)}
                          disabled={loadingEcTriggers}
                          className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                        >
                          <option value="">Any Exclusion Trigger</option>
                          <option value="Unspecified">Unspecified / No Code</option>
                          {ecTriggers.map((code) => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/40 my-0.5" />

                  {/* Category 3: Metadata & Assets */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Metadata & Assets</span>
                    
                    {/* PDF Status */}
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Local PDF Status</label>
                      <select
                        value={pdfFilter}
                        onChange={(e) => setPdfFilter && setPdfFilter(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      >
                        <option value="">Any PDF Status</option>
                        <option value="IGNORED">IGNORED</option>
                        <option value="MISSING">MISSING</option>
                        <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                        <option value="MATCHED">MATCHED</option>
                        <option value="DOWNLOADED">DOWNLOADED</option>
                        <option value="SYNCED">SYNCED</option>
                        <option value="FAILED">FAILED</option>
                      </select>
                    </div>

                    {/* Source Scope */}
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Source Scope</label>
                      <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter && setSourceFilter(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      >
                        <option value="">Any Source</option>
                        <option value="manual">Manual Ingestion</option>
                        <option value="backward">Backward Snowball</option>
                        <option value="forward">Forward Snowball</option>
                        <option value="csv">CSV Import</option>
                      </select>
                    </div>

                    {/* DOI Status */}
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">DOI Status</label>
                      <select
                        value={doiStatusFilter}
                        onChange={(e) => setDoiStatusFilter && setDoiStatusFilter(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      >
                        <option value="">Any DOI Status</option>
                        <option value="has_doi">Has DOI</option>
                        <option value="empty">Missing DOI</option>
                      </select>
                    </div>

                    {/* PDF Link Status */}
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">PDF Link Availability</label>
                      <select
                        value={pdfLinkFilter}
                        onChange={(e) => setPdfLinkFilter && setPdfLinkFilter(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      >
                        <option value="">Any Link Status</option>
                        <option value="has_link">Has PDF Link</option>
                        <option value="empty">Missing Link</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sort & Search Telemetry Metadata */}
        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-semibold pt-1">
          <div className="flex items-center gap-1">
            <span>Sort:</span>
            <select
              value={screeningSortBy}
              onChange={(e) => setScreeningSortBy(e.target.value)}
              className="bg-transparent border-0 font-bold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="Paper_ID">Paper ID</option>
              <option value="Title">Title</option>
              <option value="Year">Year</option>
              <option value="Publisher">Publisher</option>
              <option value="manual_decision">Screening Decision</option>
              <option value="manual_stage">Human Screening Stage</option>
            </select>
            <button
              onClick={toggleSortOrder}
              className="p-0.5 hover:bg-secondary rounded cursor-pointer text-foreground"
              title="Reverse Order"
            >
              {screeningSortOrder === 'ASC' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div>
            {screeningSearchMode === 'semantic' && screeningSearchTime !== null && (
              <span className="text-emerald-500 font-bold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                Vector Hit ({screeningSearchTime}ms)
              </span>
            )}
            {!screeningLoading && (
              <span className="ml-2">Found: <strong>{screeningTotalPapers}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Main Papers List */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto divide-y divide-border/60">
        {screeningLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-semibold">Loading paper library...</span>
          </div>
        ) : screeningPapers.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground/60 p-6 flex-col gap-2">
            <Search className="w-8 h-8 opacity-20" />
            <span className="text-xs font-semibold">No papers match current search criteria.</span>
          </div>
        ) : (
          screeningPapers.map((paper) => {
            const isSelected = screeningSelectedPaper?.Paper_ID === paper.Paper_ID;
            const hasDecision = !!paper.manual_decision;
            
            return (
              <button
                key={paper.Paper_ID}
                data-paper-id={paper.Paper_ID}
                onClick={() => setScreeningSelectedPaper(paper)}
                className={`w-full text-left p-4 flex flex-col gap-1.5 transition-all outline-none border-l-4 cursor-pointer ${
                  isSelected
                    ? 'bg-primary/5 border-l-primary shadow-sm'
                    : hasDecision
                    ? 'border-l-emerald-500 hover:bg-secondary/30'
                    : 'border-l-transparent hover:bg-secondary/20'
                }`}
              >
                <div className="flex justify-between items-start gap-3 w-full">
                  <span className="font-mono text-[9px] font-black text-muted-foreground truncate flex-1">
                    {paper.Paper_ID}
                  </span>
                  
                  {/* Badges Container */}
                  <div className="flex items-center gap-1 select-none shrink-0">
                    {/* Manual Decision Badge */}
                    {paper.manual_decision && (
                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase border ${
                        paper.manual_decision === 'INCLUDE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        paper.manual_decision === 'EXCLUDE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {paper.manual_decision}{paper.manual_decision === 'EXCLUDE' && paper.manual_exclusion_code ? ` (${paper.manual_exclusion_code})` : ''}
                      </span>
                    )}

                    {/* Manual Stage Badge */}
                    {paper.manual_stage !== undefined && paper.manual_stage !== null && paper.manual_stage > 0 && (
                      <span className="px-1.5 py-0.2 bg-secondary/80 border border-border text-muted-foreground rounded text-[8px] font-semibold">
                        {paper.manual_stage === 1 ? 'FF' :
                         paper.manual_stage === 2 ? 'GK' :
                         paper.manual_stage === 3 ? 'SC' : 'MN'}
                      </span>
                    )}

                    {/* Calibration Pool Indicator */}
                    {(paper as any).calibration_pool && (
                      <span className="px-1 py-0.2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[7px] font-black uppercase">
                        {(paper as any).calibration_pool === 'pool_a' ? 'A' :
                         (paper as any).calibration_pool === 'pool_b' ? 'B' : 'C'}
                      </span>
                    )}
                  </div>
                </div>

                <h4 className={`font-bold text-xs leading-snug line-clamp-2 ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {paper.Title}
                </h4>

                <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 font-semibold mt-1">
                  <span className="truncate max-w-[200px]">{paper.Authors || 'Unknown Authors'}</span>
                  <span className="shrink-0">{paper.Year || '—'}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination control footer */}
      {screeningSearchMode === 'keyword' && screeningTotalPages > 1 && (
        <div className="h-12 border-t border-border px-4 flex items-center justify-between shrink-0 select-none bg-card/10 text-xs font-bold text-muted-foreground">
          <button
            onClick={() => setScreeningPage(p => Math.max(1, p - 1))}
            disabled={screeningPage === 1 || screeningLoading}
            className="p-1.5 hover:bg-secondary rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Page {screeningPage} of {screeningTotalPages}</span>
          <button
            onClick={() => setScreeningPage(p => Math.min(screeningTotalPages, p + 1))}
            disabled={screeningPage === screeningTotalPages || screeningLoading}
            className="p-1.5 hover:bg-secondary rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
