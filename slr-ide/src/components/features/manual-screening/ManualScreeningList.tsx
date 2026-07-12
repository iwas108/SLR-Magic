import React, { useRef, useEffect } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, Cpu, ArrowDown, ArrowUp, Tag } from 'lucide-react';
import { Paper } from '@/types';

interface ManualScreeningListProps {
  screeningSearch: string;
  setScreeningSearch: (v: string) => void;
  screeningSearchMode: 'keyword' | 'semantic';
  setScreeningSearchMode: React.Dispatch<React.SetStateAction<'keyword' | 'semantic'>>;
  screeningPoolFilter: string;
  setScreeningPoolFilter: (v: string) => void;
  screeningStageFilter: string;
  setScreeningStageFilter: (v: string) => void;
  screeningDecisionFilter: string;
  setScreeningDecisionFilter: (v: string) => void;
  screeningPublisherFilter: string;
  setScreeningPublisherFilter: (v: string) => void;
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
  isMinimized: boolean;
  uniquePublishers: string[];
}

export default function ManualScreeningList({
  screeningSearch,
  setScreeningSearch,
  screeningSearchMode,
  setScreeningSearchMode,
  screeningPoolFilter,
  setScreeningPoolFilter,
  screeningStageFilter,
  setScreeningStageFilter,
  screeningDecisionFilter,
  setScreeningDecisionFilter,
  screeningPublisherFilter,
  setScreeningPublisherFilter,
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
  isMinimized,
  uniquePublishers
}: ManualScreeningListProps) {
  const listContainerRef = useRef<HTMLDivElement>(null);

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

        {/* Filters Selectors Row */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-muted-foreground">
          {/* Pool Filter */}
          <div>
            <label className="block mb-1 text-[8px] uppercase tracking-wider text-muted-foreground/60">Calibration Pool</label>
            <select
              value={screeningPoolFilter}
              onChange={(e) => setScreeningPoolFilter(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-2 py-1 focus:outline-none font-semibold text-foreground"
            >
              <option value="">All Papers</option>
              <option value="none">No Pool (General)</option>
              <option value="pool_a">Pool A</option>
              <option value="pool_b">Pool B</option>
              <option value="pool_c">Pool C</option>
            </select>
          </div>

          {/* Decision Filter */}
          <div>
            <label className="block mb-1 text-[8px] uppercase tracking-wider text-muted-foreground/60">Screening Result</label>
            <select
              value={screeningDecisionFilter}
              onChange={(e) => setScreeningDecisionFilter(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-2 py-1 focus:outline-none font-semibold text-foreground"
            >
              <option value="">All Results</option>
              <option value="none">Unscreened (Pending)</option>
              <option value="INCLUDE">INCLUDE</option>
              <option value="EXCLUDE">EXCLUDE</option>
              <option value="QA_WAIT">QA_WAIT</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <label className="block mb-1 text-[8px] uppercase tracking-wider text-muted-foreground/60">Manual Stage</label>
            <select
              value={screeningStageFilter}
              onChange={(e) => setScreeningStageFilter(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-2 py-1 focus:outline-none font-semibold text-foreground"
            >
              <option value="">All Stages</option>
              <option value="none">None Assigned</option>
              <option value="fast_filter">Fast Filter</option>
              <option value="gatekeeper">Gatekeeper</option>
              <option value="scientist">Scientist</option>
              <option value="miner">Miner</option>
            </select>
          </div>

          {/* Publisher Filter */}
          <div>
            <label className="block mb-1 text-[8px] uppercase tracking-wider text-muted-foreground/60">Publisher</label>
            <select
              value={screeningPublisherFilter}
              onChange={(e) => setScreeningPublisherFilter(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-2 py-1 focus:outline-none font-semibold text-foreground truncate"
            >
              <option value="">All Publishers</option>
              {uniquePublishers.map((pub) => (
                <option key={pub} value={pub}>{pub}</option>
              ))}
            </select>
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
              <option value="manual_stage">Manual Stage</option>
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
