import React, { useState } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, Cpu } from 'lucide-react';
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
  vectorIndexStatus: { indexed: boolean; pdf_count: number; paper_count: number } | null;
  loadVectorStatus: () => Promise<void>;
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
  loadVectorStatus
}: PaperSelectionListProps) {
  const [showBuildModal, setShowBuildModal] = useState(false);

  return (
    <div className="w-96 border-r border-border bg-card/30 flex flex-col overflow-hidden shrink-0">
      {/* Search and pool filter */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground/70 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={assignSearchMode === 'semantic' ? "Semantic query..." : "Search papers..."}
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className="w-full bg-secondary/40 border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60 transition-colors font-semibold"
            />
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden shrink-0 select-none text-[10px] font-bold uppercase tracking-wider bg-secondary/20">
            <button
              onClick={() => setAssignSearchMode('keyword')}
              className={`px-2 py-1 flex items-center transition-colors cursor-pointer ${
                assignSearchMode === 'keyword' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40'
              }`}
              title="Keyword Match (SQL LIKE)"
            >
              🔤
            </button>
            <button
              onClick={() => setAssignSearchMode('semantic')}
              className={`px-2 py-1 flex items-center transition-colors cursor-pointer ${
                assignSearchMode === 'semantic' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40'
              }`}
              title="Semantic Similarity (turbovec)"
            >
              🧠
            </button>
          </div>
        </div>

        {assignSearchMode === 'semantic' && vectorIndexStatus && !vectorIndexStatus.indexed && (
          <div className="p-2.5 border border-amber-500/30 bg-amber-500/10 rounded-lg flex flex-col gap-1.5 text-[9px] animate-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5 font-bold text-amber-500">
              <Cpu className="w-3.5 h-3.5 animate-pulse" />
              <span>Vector index not built</span>
            </div>
            <p className="text-muted-foreground font-semibold leading-relaxed">
              To run semantic searches, you need to compile vector embeddings for your corpus.
            </p>
            <button
              onClick={() => setShowBuildModal(true)}
              className="w-full py-1 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-center transition-colors shadow-sm cursor-pointer uppercase tracking-wider text-[8px]"
            >
              Build Semantic Index Now
            </button>
          </div>
        )}

        {/* mini sub-filter for pool assignment */}
        <div className="grid grid-cols-5 gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border text-[9px] font-bold text-center uppercase tracking-wide">
          {[
            { id: 'all', label: 'All' },
            { id: 'unassigned', label: 'Un' },
            { id: 'pool_a', label: 'A' },
            { id: 'pool_b', label: 'B' },
            { id: 'pool_c', label: 'C' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setAssignPoolFilter(f.id)}
              className={`py-1 rounded-md transition-colors ${
                assignPoolFilter === f.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={`Show ${f.id === 'unassigned' ? 'Unassigned' : f.id.toUpperCase()} papers`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Papers List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {assignLoading ? (
          <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Loading papers database...</span>
          </div>
        ) : assignPapers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            No papers found matching filters.
          </div>
        ) : (
          assignPapers.map((paper: any) => {
            const isSelected = assignSelectedPaper?.Paper_ID === paper.Paper_ID;
            return (
              <div
                key={paper.Paper_ID}
                onClick={() => {
                  if (!assignIsRunning) {
                    setAssignSelectedPaper(paper);
                    setAssignLogs([]);
                    setAssignProgress(0);
                    setAssignStatusText('Idle');
                  }
                }}
                className={`p-3 cursor-pointer select-none transition-colors border-l-4 ${
                  isSelected ? 'bg-secondary border-primary' : 'hover:bg-secondary/40 border-transparent'
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
        showToast={showToast}
      />
    </div>
  );
}
