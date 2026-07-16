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

  const clearAllFilters = () => {
    setScreeningStageFilter('');
    setScreeningDecisionFilter('');
  };

  const anyActiveFilter = !!(
    screeningStageFilter ||
    screeningDecisionFilter
  );

  const activeFilterCount = [
    screeningStageFilter,
    screeningDecisionFilter
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
              <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 p-4 flex flex-col gap-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">Advanced Filters</span>
                  <button
                    onClick={clearAllFilters}
                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {/* Manual Screening Decision */}
                  <div className="flex flex-col gap-1 text-[10px] font-bold">
                    <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Manual Screening Decision</label>
                    <select
                      value={screeningDecisionFilter}
                      onChange={(e) => setScreeningDecisionFilter(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="">All Results</option>
                      <option value="none">Unscreened (Pending)</option>
                      <option value="INCLUDE">INCLUDE</option>
                      <option value="EXCLUDE">EXCLUDE</option>
                      <option value="UNCERTAIN">UNCERTAIN</option>
                    </select>
                  </div>

                  {/* Human Screening Stage Filter */}
                  <div className="flex flex-col gap-1 text-[10px] font-bold">
                    <label className="text-muted-foreground/60 uppercase text-[8px] tracking-wider">Human Screening Stage</label>
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
                        {paper.manual_decision}
                      </span>
                    )}

                    {/* Manual Stage Badge */}
                    {paper.manual_stage && (
                      <span className="px-1.5 py-0.2 bg-secondary/80 border border-border text-muted-foreground rounded text-[8px] font-semibold">
                        {paper.manual_stage === 'fast_filter' ? 'FF' :
                         paper.manual_stage === 'gatekeeper' ? 'GK' :
                         paper.manual_stage === 'scientist' ? 'SC' : 'MN'}
                      </span>
                    )}

                    {/* Calibration Pool Indicator */}
                    {paper.calibration_pool && (
                      <span className="px-1 py-0.2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[7px] font-black uppercase">
                        {paper.calibration_pool === 'pool_a' ? 'A' :
                         paper.calibration_pool === 'pool_b' ? 'B' : 'C'}
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
