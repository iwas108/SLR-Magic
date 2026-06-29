import React from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  showToast
}: PaperSelectionListProps) {

  return (
    <div className="w-96 border-r border-border bg-card/30 flex flex-col overflow-hidden shrink-0">
      {/* Search and pool filter */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground/70 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search papers..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            className="w-full bg-secondary/40 border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60 transition-colors font-semibold"
          />
        </div>

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
                    setAssignStatusText('');
                  } else {
                    showToast('Please wait or cancel the running acquisition process first.', 'warning');
                  }
                }}
                className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1 border-l-2 select-none ${
                  isSelected
                    ? 'bg-secondary/40 border-primary'
                    : paper.calibration_pool === 'pool_a'
                    ? 'border-indigo-500 hover:bg-secondary/10'
                    : paper.calibration_pool === 'pool_b'
                    ? 'border-emerald-500 hover:bg-secondary/10'
                    : paper.calibration_pool === 'pool_c'
                    ? 'border-amber-500 hover:bg-secondary/10'
                    : 'border-transparent hover:bg-secondary/10'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-mono text-[9px] font-bold text-muted-foreground shrink-0">{paper.Paper_ID}</span>
                  {paper.calibration_pool && (
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded ${
                      paper.calibration_pool === 'pool_a' ? 'bg-indigo-500/10 text-indigo-400' :
                      paper.calibration_pool === 'pool_b' ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-amber-500/10 text-amber-400'
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
    </div>
  );
}
