import React from 'react';
import { useViewerData } from '@/context/ViewerContext';
import { Search, Filter, BarChart2, Sparkles, Upload, ArrowLeftRight } from 'lucide-react';

export interface HeaderProps {
  onOpenImportModal: () => void;
  onSwitchStudy?: () => void;
}

export default function Header({ onOpenImportModal, onSwitchStudy }: HeaderProps) {
  const {
    activeSession,
    activeTab,
    searchTerm,
    setSearchTerm,
    showFilters,
    setShowFilters,
    activeFiltersCount,
    setIsVisualizerOpen,
    setIsLlmContextBuilderOpen
  } = useViewerData();

  const activeProjectName = activeSession?.projectName || 'No Project Selected';

  return (
    <header className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0 z-20 backdrop-blur-md select-none">
      <div className="flex items-center gap-4 min-w-0">
        <div className="truncate">
          <h2 className="font-bold text-sm tracking-tight capitalize flex items-center gap-2 truncate">
            <span className="truncate">{activeSession ? activeSession.projectName : 'No Active Study'}</span>
            {activeSession && (
              <span className="text-[10px] text-muted-foreground font-normal shrink-0">
                • {activeTab.replace('insight-export-', '').replace(/-/g, ' ')}
              </span>
            )}
          </h2>
          <p className="text-[10px] text-muted-foreground font-medium truncate">
            {activeSession ? 'SLR Interactive Visualizer & Verification Workbench' : 'Drop or select an SLR dataset snapshot to begin'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {/* Switch Study Button (Only when a study is active) */}
        {activeSession && (
          <button
            onClick={onSwitchStudy || onOpenImportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-lg transition-all border border-border cursor-pointer shrink-0 hover:scale-[1.02] active:scale-[0.98]"
            title="Switch active study or open new review"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Switch Study</span>
          </button>
        )}

        {/* Import Snapshot Button */}
        <button
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-lg transition-all border border-border cursor-pointer shrink-0 hover:scale-[1.02] active:scale-[0.98]"
          title="Import .slr-viewer snapshot file"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span>Import Snapshot</span>
        </button>

        {/* Final Cohort specific action buttons */}
        {activeTab === 'insight-export-cohort' && (
          <>
            <div className="relative w-56 md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search final cohort papers, authors, DOIs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <button
              onClick={() => setIsVisualizerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer shrink-0 hover:scale-105 active:scale-95"
              title="Open Scientific Visualization Studio"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Visualize Cohort</span>
              {Array.isArray(activeSession?.rawData?.saved_charts) && activeSession.rawData.saved_charts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold" title={`${activeSession.rawData.saved_charts.length} project charts saved`}>
                  {activeSession.rawData.saved_charts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsLlmContextBuilderOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer shrink-0 hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>LLM Context Builder</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-secondary hover:bg-secondary/80 border-border text-foreground'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[9px] font-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
