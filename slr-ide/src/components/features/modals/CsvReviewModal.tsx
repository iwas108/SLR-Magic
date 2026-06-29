import React from 'react';
import { FileSpreadsheet, X, Search, ChevronLeft, ChevronRight, AlertTriangle, Check } from 'lucide-react';

interface CsvReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewPapers: any[];
  reviewPage: number;
  setReviewPage: React.Dispatch<React.SetStateAction<number>>;
  reviewLimit: number;
  setReviewLimit: React.Dispatch<React.SetStateAction<number>>;
  reviewSearch: string;
  setReviewSearch: React.Dispatch<React.SetStateAction<string>>;
  reviewStatusFilter: string;
  setReviewStatusFilter: React.Dispatch<React.SetStateAction<string>>;
}

export default function CsvReviewModal({
  isOpen,
  onClose,
  previewPapers,
  reviewPage,
  setReviewPage,
  reviewLimit,
  setReviewLimit,
  reviewSearch,
  setReviewSearch,
  reviewStatusFilter,
  setReviewStatusFilter
}: CsvReviewModalProps) {
  // Filtered review papers
  const filteredReviewPapers = React.useMemo(() => {
    return previewPapers.filter((p: any) => {
      const matchesSearch = 
        p.Title?.toLowerCase().includes(reviewSearch.toLowerCase()) || 
        p.Paper_ID?.toLowerCase().includes(reviewSearch.toLowerCase());
      const matchesStatus = 
        reviewStatusFilter === 'all' || 
        (reviewStatusFilter === 'new' && !p.isDuplicate) || 
        (reviewStatusFilter === 'duplicate' && p.isDuplicate);
      return matchesSearch && matchesStatus;
    });
  }, [previewPapers, reviewSearch, reviewStatusFilter]);

  const totalReviewPages = Math.ceil(filteredReviewPapers.length / reviewLimit);
  const paginatedReviewPapers = filteredReviewPapers.slice((reviewPage - 1) * reviewLimit, reviewPage * reviewLimit);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-6xl h-[85vh] rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm">Review Incoming Data</h3>
              <p className="text-[10px] text-muted-foreground">Observe mapped CSV data before import</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors bg-secondary/50 hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-border bg-secondary/10 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Title or ID..."
              value={reviewSearch}
              onChange={(e) => { setReviewSearch(e.target.value); setReviewPage(1); }}
              className="w-full pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-lg text-xs focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Status Filter:</span>
              <select
                value={reviewStatusFilter}
                onChange={(e) => { setReviewStatusFilter(e.target.value); setReviewPage(1); }}
                className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
              >
                <option value="all">All Records</option>
                <option value="new">New Papers Only</option>
                <option value="duplicate">Duplicates Only</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Rows per page:</span>
              <select
                value={reviewLimit}
                onChange={(e) => { setReviewLimit(Number(e.target.value)); setReviewPage(1); }}
                className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-card z-10 shadow-sm">
              <tr className="border-b border-border bg-secondary/30 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                <th className="p-3 pl-4 font-semibold">Status</th>
                <th className="p-3 font-semibold">Paper ID</th>
                <th className="p-3 font-semibold w-1/3 min-w-[300px]">Title</th>
                <th className="p-3 font-semibold">Authors</th>
                <th className="p-3 font-semibold">Year</th>
                <th className="p-3 font-semibold">DOI</th>
                <th className="p-3 font-semibold">Original Publisher</th>
                <th className="p-3 font-semibold">Publisher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedReviewPapers.length > 0 ? (
                paginatedReviewPapers.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3 pl-4">
                      {p.isDuplicate ? (
                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> Skip
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <Check className="w-3 h-3" /> Import
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-[10px]">{p.Paper_ID}</td>
                    <td className="p-3 font-semibold text-foreground truncate max-w-[300px]" title={p.Title}>{p.Title}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[150px]" title={p.Authors}>{p.Authors || '—'}</td>
                    <td className="p-3 text-muted-foreground">{p.Year || '—'}</td>
                    <td className="p-3 text-muted-foreground font-mono text-[10px]">{p.DOI || '—'}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[150px]" title={p.Original_Publisher}>{p.Original_Publisher || '—'}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[150px]" title={p.Publisher}>{p.Publisher || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p>No records found matching filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-border bg-secondary/10 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold">
            Showing {(reviewPage - 1) * reviewLimit + 1} - {Math.min(reviewPage * reviewLimit, filteredReviewPapers.length)} of {filteredReviewPapers.length} mapped records
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setReviewPage(Math.max(1, reviewPage - 1))}
              disabled={reviewPage === 1}
              className="p-1.5 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-bold text-foreground">
              Page {reviewPage} of {totalReviewPages || 1}
            </span>
            <button
              onClick={() => setReviewPage(Math.min(totalReviewPages, reviewPage + 1))}
              disabled={reviewPage === totalReviewPages || totalReviewPages === 0}
              className="p-1.5 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
