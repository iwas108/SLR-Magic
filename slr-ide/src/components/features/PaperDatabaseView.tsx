import React from 'react';
import {
  Upload, Search, FileText, Check, AlertCircle, RefreshCw, X, Play,
  Download, FileSpreadsheet, Layers, Sparkles, AlertTriangle, ExternalLink, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, ChevronLeft, ChevronRight,
  Minus, Maximize2, LayoutDashboard, Plus, Edit, Folder, Calendar, CheckCircle2,
  TrendingUp, BarChart3, Cloud, Database, ShieldAlert, Terminal, ArrowRightLeft,
  Lock, Unlock, Loader2, Settings, MoreHorizontal, Globe, BookOpen, UserCheck, Shield
} from 'lucide-react';
import PipelineProgressPanel from './dashboard/PipelineProgressPanel';
import { broadcastSync } from '@/lib/sync-utils';

interface PaperDatabaseViewProps {
  duplicatesCount: number;
  setShowDuplicateModal: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  pdfFilter: string;
  setPdfFilter: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  decisionFilter: string;
  setDecisionFilter: (v: string) => void;
  setShowImport: (show: boolean) => void;
  setDeleteAllConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  operationModal: any;
  setOperationModal: React.Dispatch<React.SetStateAction<any>>;
  currentStep: any;
  setCurrentStep: React.Dispatch<React.SetStateAction<any>>;
  pipelineStats: any;
  indexingState: any;
  logEndRef: React.RefObject<HTMLDivElement | null>;
  formatBytes: (bytes: number) => string;
  getTimeEstimates: () => { avgTime: string; timeLeft: string };
  handleResumeOperation: () => void;
  handleCancelOperation: () => void;
  cloudName: string;
  isModalMinimized: boolean;
  setIsModalMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  loadingPapers: boolean;
  papers: any[];
  totalPapers: number;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  limit: number;
  setLimit: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  handleSort: (field: string) => void;
  renderSortIcon: (field: string) => React.ReactNode;
  setPaperModal: React.Dispatch<React.SetStateAction<any>>;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
  selectedPaperIds?: Set<string>;
  setSelectedPaperIds?: React.Dispatch<React.SetStateAction<Set<string>>>;
  onRunLLMOnSelected?: (paperIds: string[]) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  loadPapers?: () => void;
}

function LoaderIcon() {
  return (
    <svg className="w-6 h-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

export default function PaperDatabaseView({
  duplicatesCount,
  setShowDuplicateModal,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  pdfFilter,
  setPdfFilter,
  sourceFilter,
  setSourceFilter,
  decisionFilter,
  setDecisionFilter,
  setShowImport,
  setDeleteAllConfirm,
  operationModal,
  setOperationModal,
  currentStep,
  setCurrentStep,
  pipelineStats,
  indexingState,
  logEndRef,
  formatBytes,
  getTimeEstimates,
  handleResumeOperation,
  handleCancelOperation,
  cloudName,
  isModalMinimized,
  setIsModalMinimized,
  loadingPapers,
  papers,
  totalPapers,
  page,
  setPage,
  limit,
  setLimit,
  totalPages,
  handleSort,
  renderSortIcon,
  setPaperModal,
  setDeleteConfirm,
  selectedPaperIds = new Set(),
  setSelectedPaperIds,
  onRunLLMOnSelected,
  showToast,
  loadPapers
}: PaperDatabaseViewProps) {

  const [filterType, setFilterType] = React.useState('none');
  const [filterValue, setFilterValue] = React.useState('');
  const [bulkType, setBulkType] = React.useState('');
  const [bulkValue, setBulkValue] = React.useState('');

  React.useEffect(() => {
    if (statusFilter) {
      setFilterType('stage');
      setFilterValue(statusFilter);
    } else if (decisionFilter) {
      setFilterType('decision');
      setFilterValue(decisionFilter);
    } else if (pdfFilter) {
      setFilterType('pdf');
      setFilterValue(pdfFilter);
    } else if (sourceFilter) {
      setFilterType('source');
      setFilterValue(sourceFilter);
    } else {
      setFilterType('none');
      setFilterValue('');
    }
  }, [statusFilter, decisionFilter, pdfFilter, sourceFilter]);

  const handleFilterTypeChange = (type: string) => {
    setFilterType(type);
    setFilterValue('');
    setStatusFilter('');
    setDecisionFilter('');
    setPdfFilter('');
    setSourceFilter('');
  };

  const handleFilterValueChange = (val: string) => {
    setFilterValue(val);
    setStatusFilter(filterType === 'stage' ? val : '');
    setDecisionFilter(filterType === 'decision' ? val : '');
    setPdfFilter(filterType === 'pdf' ? val : '');
    setSourceFilter(filterType === 'source' ? val : '');
  };

  const handleDecisionOverride = async (paper: any, val: string) => {
    const payload = {
      Title: paper.Title,
      Human_Decision: val === 'CLEAR' ? null : val,
      Human_EC_Trigger: val === 'CLEAR' ? null : paper.Human_EC_Trigger,
      Human_Rationale: val === 'CLEAR' ? null : paper.Human_Rationale
    };
    try {
      const res = await fetch(`/api/papers/${paper.Paper_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      loadPapers?.();
      showToast?.('Decision override updated successfully', 'success');
      broadcastSync('SYNC_PAPERS');
    } catch (e) {
      showToast?.('Failed to update decision override', 'error');
    }
  };

  const handleBulkOverride = async (decisionVal: string) => {
    try {
      const ids = Array.from(selectedPaperIds);
      const confirmMsg = `Are you sure you want to apply a decision override of "${decisionVal}" to ${ids.length} selected paper(s)?`;
      if (!window.confirm(confirmMsg)) return;

      const res = await fetch('/api/papers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds: ids,
          humanDecision: decisionVal
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to apply bulk overrides');
      }
      showToast?.(`Successfully applied override to ${ids.length} papers.`, 'success');
      setSelectedPaperIds?.(new Set());
      loadPapers?.();
      broadcastSync('SYNC_PAPERS');
    } catch (e: any) {
      showToast?.(e.message || 'Operation failed', 'error');
    }
  };

  const handleBulkStageChange = async (stageVal: string) => {
    try {
      const ids = Array.from(selectedPaperIds);
      const stageLabels: Record<string, string> = {
        '0': '0: Unprocessed',
        '1': '1: Fast Filter (Metadata)',
        '2': '2: Passed Gatekeeper (PDF)',
        '3': '3: Passed Scientist (QA)',
        '4': '4: Passed Miner (Extraction)'
      };
      const targetLabel = stageLabels[stageVal] || stageVal;
      const confirmMsg = `Are you sure you want to change the pipeline stage to "${targetLabel}" for ${ids.length} selected paper(s)?`;
      if (!window.confirm(confirmMsg)) return;

      const res = await fetch('/api/papers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds: ids,
          status: stageVal
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to change pipeline stage');
      }
      showToast?.(`Successfully changed pipeline stage for ${ids.length} papers.`, 'success');
      setSelectedPaperIds?.(new Set());
      loadPapers?.();
      broadcastSync('SYNC_PAPERS');
    } catch (e: any) {
      showToast?.(e.message || 'Operation failed', 'error');
    }
  };

  const handleBulkPdfStatusChange = async (pdfStatusVal: string) => {
    try {
      const ids = Array.from(selectedPaperIds);
      const confirmMsg = `Are you sure you want to change the Local PDF Status to "${pdfStatusVal}" for ${ids.length} selected paper(s)?`;
      if (!window.confirm(confirmMsg)) return;

      const res = await fetch('/api/papers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds: ids,
          localPdfStatus: pdfStatusVal
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to change local PDF status');
      }
      showToast?.(`Successfully changed local PDF status for ${ids.length} papers.`, 'success');
      setSelectedPaperIds?.(new Set());
      loadPapers?.();
      broadcastSync('SYNC_PAPERS');
    } catch (e: any) {
      showToast?.(e.message || 'Operation failed', 'error');
    }
  };

  const handleToggleSelect = (paperId: string) => {
    if (!setSelectedPaperIds) return;
    const next = new Set(selectedPaperIds);
    if (next.has(paperId)) {
      next.delete(paperId);
    } else {
      next.add(paperId);
    }
    setSelectedPaperIds(next);
  };

  const handleToggleSelectAll = () => {
    if (!setSelectedPaperIds || !papers) return;
    const next = new Set(selectedPaperIds);
    const pagePaperIds = papers.map((p) => String(p.Paper_ID));
    const allSelectedOnPage = pagePaperIds.every((id) => next.has(id));

    if (allSelectedOnPage) {
      pagePaperIds.forEach((id) => next.delete(id));
    } else {
      pagePaperIds.forEach((id) => next.add(id));
    }
    setSelectedPaperIds(next);
  };

  const allPageSelected = papers && papers.length > 0 && papers.every(p => selectedPaperIds.has(String(p.Paper_ID)));
  const somePageSelected = papers && papers.length > 0 && papers.some(p => selectedPaperIds.has(String(p.Paper_ID))) && !allPageSelected;

  return (
    <>
      <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden relative animate-in fade-in duration-200">

        {/* Search & Actions Panel */}
        <div className="p-4 border-b border-border bg-secondary/25 flex flex-wrap items-center justify-between gap-3 shrink-0">

          {/* Left Side: Search Bar, Ingestion Hub & Export CSV */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                placeholder="Search ID, Title, DOI, Authors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-2 bg-secondary text-foreground border border-border hover:bg-secondary/80 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Ingestion Hub
            </button>

            <a
              href="/api/export"
              download
              className="px-3 py-2 bg-secondary text-foreground border border-border hover:bg-secondary/80 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>

          {/* Right Side: Combined Filters, Review Duplicates, Combined Bulk Operations, Delete All */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Combined Filters */}
            <div className="flex items-center gap-1.5">
              <select
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                value={filterType}
                onChange={(e) => handleFilterTypeChange(e.target.value)}
              >
                <option value="none">No Filter</option>
                <option value="stage">Pipeline Stage</option>
                <option value="decision">Screening Decision</option>
                <option value="pdf">PDF Status</option>
                <option value="source">Source Scope</option>
              </select>

              {filterType !== 'none' && (
                <select
                  className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold animate-in slide-in-from-left-2 duration-150"
                  value={filterValue}
                  onChange={(e) => handleFilterValueChange(e.target.value)}
                >
                  <option value="">Select Value...</option>
                  {filterType === 'stage' && (
                    <>
                      <option value="0">0: Unprocessed</option>
                      <option value="1">1: Fast Filter (Metadata)</option>
                      <option value="2">2: Passed Gatekeeper (PDF)</option>
                      <option value="3">3: Passed Scientist (QA)</option>
                      <option value="4">4: Passed Miner (Extraction)</option>
                    </>
                  )}
                  {filterType === 'decision' && (
                    <>
                      <option value="INCLUDE">INCLUDE</option>
                      <option value="EXCLUDE">EXCLUDE</option>
                      <option value="UNADJUDICATED">Unadjudicated</option>
                    </>
                  )}
                  {filterType === 'pdf' && (
                    <>
                      <option value="IGNORED">IGNORED</option>
                      <option value="MISSING">MISSING</option>
                      <option value="MATCHED">MATCHED</option>
                      <option value="DOWNLOADED">DOWNLOADED</option>
                      <option value="SYNCED">SYNCED</option>
                      <option value="FAILED">FAILED</option>
                    </>
                  )}
                  {filterType === 'source' && (
                    <>
                      <option value="manual">Manual Ingestion</option>
                      <option value="backward">Backward Snowball</option>
                      <option value="forward">Forward Snowball</option>
                      <option value="csv">CSV Import</option>
                    </>
                  )}
                </select>
              )}
            </div>

            {duplicatesCount > 0 && (
              <button
                onClick={() => setShowDuplicateModal(true)}
                className="px-3 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 animate-pulse"
              >
                <Layers className="w-3.5 h-3.5" />
                Review Duplicates ({duplicatesCount})
              </button>
            )}

            {/* Combined Bulk Operations */}
            {selectedPaperIds.size > 0 && (
              <div className="flex items-center gap-1.5 border-l border-border pl-3">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Selected ({selectedPaperIds.size}):</span>
                <select
                  value={bulkType}
                  onChange={(e) => {
                    setBulkType(e.target.value);
                    setBulkValue('');
                  }}
                  className="bg-primary/10 text-primary border border-primary/25 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none focus:border-primary font-bold transition-all"
                >
                  <option value="" className="bg-background text-foreground">Bulk Action...</option>
                  <option value="decision" className="bg-background text-foreground">Decision Override</option>
                  <option value="stage" className="bg-background text-foreground">Pipeline Stage Change</option>
                  <option value="pdfStatus" className="bg-background text-foreground">Local PDF Status</option>
                </select>

                {bulkType && (
                  <select
                    value={bulkValue}
                    onChange={async (e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (bulkType === 'decision') {
                        await handleBulkOverride(val);
                      } else if (bulkType === 'stage') {
                        await handleBulkStageChange(val);
                      } else if (bulkType === 'pdfStatus') {
                        await handleBulkPdfStatusChange(val);
                      }
                      setBulkValue('');
                      setBulkType('');
                    }}
                    className="bg-primary/10 text-primary border border-primary/25 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none focus:border-primary font-bold transition-all ml-1.5 animate-in slide-in-from-left-2 duration-150"
                  >
                    <option value="" className="bg-background text-foreground">Select Value...</option>
                    {bulkType === 'decision' ? (
                      <>
                        <option value="INCLUDE" className="bg-background text-emerald-400 font-bold">Override to INCLUDE</option>
                        <option value="EXCLUDE" className="bg-background text-red-400 font-bold">Override to EXCLUDE</option>
                        <option value="CLEAR" className="bg-background text-muted-foreground font-semibold">Clear Overrides</option>
                      </>
                    ) : bulkType === 'stage' ? (
                      <>
                        <option value="0" className="bg-background text-foreground">0: Unprocessed</option>
                        <option value="1" className="bg-background text-foreground">1: Fast Filter (Metadata)</option>
                        <option value="2" className="bg-background text-foreground">2: Passed Gatekeeper (PDF)</option>
                        <option value="3" className="bg-background text-foreground">3: Passed Scientist (QA)</option>
                        <option value="4" className="bg-background text-foreground">4: Passed Miner (Extraction)</option>
                      </>
                    ) : (
                      <>
                        <option value="IGNORED" className="bg-background text-foreground">IGNORED</option>
                        <option value="MISSING" className="bg-background text-foreground">MISSING</option>
                        <option value="MATCHED" className="bg-background text-foreground">MATCHED</option>
                        <option value="DOWNLOADED" className="bg-background text-foreground">DOWNLOADED</option>
                        <option value="SYNCED" className="bg-background text-foreground">SYNCED</option>
                      </>
                    )}
                  </select>
                )}
              </div>
            )}

            <button
              onClick={() => setDeleteAllConfirm(true)}
              disabled={operationModal.isExecuting}
              className="px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete All
            </button>
          </div>
        </div>


        {/* Data Table */}
        <div className="flex-1 flex flex-col overflow-hidden bg-card">
          {operationModal.isOpen && !isModalMinimized ? (
            <PipelineProgressPanel
              operationModal={operationModal}
              setOperationModal={setOperationModal}
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              pipelineStats={pipelineStats}
              indexingState={indexingState}
              logEndRef={logEndRef}
              formatBytes={formatBytes}
              getTimeEstimates={getTimeEstimates}
              handleResumeOperation={handleResumeOperation}
              handleCancelOperation={handleCancelOperation}
              cloudName={cloudName}
              isMinimizable={true}
              setIsModalMinimized={setIsModalMinimized}
            />
          ) : loadingPapers ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <LoaderIcon />
              <span className="text-xs font-medium">Loading papers database...</span>
            </div>
          ) : papers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <FileText className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <h4 className="font-bold text-sm mb-1 text-foreground">No papers found</h4>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Try clearing filters, searching different keywords, or importing a fresh CSV spreadsheet to populate the database.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-card">
              <div className="flex-1 overflow-auto">
                <table className="w-full table-fixed text-left text-xs border-collapse relative">
                  <thead className="sticky top-0 z-10 bg-secondary border-b border-border shadow-sm">
                    <tr className="text-muted-foreground text-[10px] font-bold uppercase">
                      <th className="p-3 w-[4%] text-center">
                        <input
                          type="checkbox"
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                          checked={allPageSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = somePageSelected;
                          }}
                          onChange={handleToggleSelectAll}
                        />
                      </th>
                      <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Paper_ID')}>
                        <div className="flex items-center gap-1.5">
                          ID {renderSortIcon('Paper_ID')}
                        </div>
                      </th>
                      <th className="p-3 w-[28%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Title')}>
                        <div className="flex items-center gap-1.5">
                          Title {renderSortIcon('Title')}
                        </div>
                      </th>
                      <th className="p-3 w-[12%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Authors')}>
                        <div className="flex items-center gap-1.5">
                          Authors {renderSortIcon('Authors')}
                        </div>
                      </th>
                      <th className="p-3 w-[5%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Year')}>
                        <div className="flex items-center gap-1.5">
                          Year {renderSortIcon('Year')}
                        </div>
                      </th>
                      <th className="p-3 w-[9%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('DOI')}>
                        <div className="flex items-center gap-1.5">
                          DOI {renderSortIcon('DOI')}
                        </div>
                      </th>
                      <th className="p-3 w-[6%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('citation_count')}>
                        <div className="flex items-center gap-1.5">
                          Citations {renderSortIcon('citation_count')}
                        </div>
                      </th>
                      <th className="p-3 w-[8%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Local_PDF_Status')}>
                        <div className="flex items-center gap-1.5">
                          PDF Status {renderSortIcon('Local_PDF_Status')}
                        </div>
                      </th>
                      <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Status')}>
                        <div className="flex items-center gap-1.5">
                          Stage {renderSortIcon('Status')}
                        </div>
                      </th>
                      <th className="p-3 w-[8%] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {papers.map((p: any) => (
                      <tr key={p.Paper_ID} className="h-16 hover:bg-secondary/15 transition-colors group">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                            checked={selectedPaperIds.has(String(p.Paper_ID))}
                            onChange={() => handleToggleSelect(String(p.Paper_ID))}
                          />
                        </td>
                        <td className="p-3 font-bold text-muted-foreground truncate" title={p.Paper_ID}>
                          {p.Paper_ID}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-foreground truncate" title={p.Title}>
                            {p.Title}
                          </div>
                          {p.Abstract && (
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5 italic" title={p.Abstract}>
                              {p.Abstract}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground truncate" title={p.Authors || '—'}>
                          {p.Authors || '—'}
                        </td>
                        <td className="p-3 text-muted-foreground font-semibold truncate">{p.Year || '—'}</td>
                        <td className="p-3 font-mono text-[10px] text-muted-foreground/80 truncate" title={p.DOI || '—'}>
                          {p.DOI || '—'}
                        </td>
                        <td className="p-3 font-mono text-xs font-semibold text-muted-foreground truncate">
                          {p.citation_count !== undefined && p.citation_count !== null ? p.citation_count : '0'}
                        </td>
                        <td className="p-3 truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${p.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
                              p.Local_PDF_Status === 'DOWNLOADED' || p.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500 animate-pulse' :
                                p.Local_PDF_Status === 'FAILED' ? 'bg-destructive' :
                                  p.Local_PDF_Status === 'IGNORED' ? 'bg-muted-foreground/50' :
                                    'bg-destructive/60'
                              }`} />
                            <span className="text-[10px] font-bold tracking-wider uppercase truncate">
                              {p.Local_PDF_Status}
                            </span>
                            {p.PDF_Link && p.PDF_Link.startsWith('http') && (
                              <a
                                href={p.PDF_Link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors p-0.5 rounded ml-1 shrink-0"
                                title={`Open ${cloudName} File`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-3 truncate">
                          {(() => {
                            const badgeStyle = {
                              '0': 'bg-slate-500/10 border-slate-500/20 text-slate-400',
                              '1': 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                              '2': 'bg-purple-500/10 border-purple-500/20 text-purple-400',
                              '3': 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                              '4': 'bg-pink-500/10 border-pink-500/20 text-pink-400',
                            }[String(p.Status)] || 'bg-secondary border-border text-muted-foreground';

                            const label = {
                              '0': '0: Initial',
                              '1': '1: Fast Filter',
                              '2': '2: Gatekeeper',
                              '3': '3: Scientist',
                              '4': '4: Miner',
                            }[String(p.Status)] || String(p.Status);

                            return (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${badgeStyle}`}>
                                {label}
                              </span>
                            );
                          })()}
                        </td>

                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setPaperModal({ isOpen: true, mode: 'view', paper: p })}
                              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                              title="View Paper Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setPaperModal({ isOpen: true, mode: 'edit', paper: p })}
                              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors"
                              title="Edit Paper Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ isOpen: true, paper: p })}
                              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete Paper"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="px-4 py-3 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0 select-none">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase">
                  Showing {totalPapers > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalPapers)} of {totalPapers} papers
                </div>

                <div className="flex items-center gap-4">
                  {/* Rows per page selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Rows:</span>
                    <select
                      className="bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:border-primary font-bold"
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((prev: any) => Math.max(prev - 1, 1))}
                      className="p-1 border border-border rounded hover:bg-secondary text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Render page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                      let targetPage = page;
                      if (totalPages <= 5) {
                        targetPage = idx + 1;
                      } else if (page <= 3) {
                        targetPage = idx + 1;
                      } else if (page > totalPages - 2) {
                        targetPage = totalPages - 4 + idx;
                      } else {
                        targetPage = page - 2 + idx;
                      }

                      if (targetPage < 1 || targetPage > totalPages) return null;

                      return (
                        <button
                          key={targetPage}
                          onClick={() => setPage(targetPage)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${page === targetPage
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-secondary border-border text-foreground hover:bg-secondary/80'
                            }`}
                        >
                          {targetPage}
                        </button>
                      );
                    })}

                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage((prev: any) => Math.min(prev + 1, totalPages))}
                      className="p-1 border border-border rounded hover:bg-secondary text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Bulk Actions Toolbar */}
        {selectedPaperIds.size > 0 && onRunLLMOnSelected && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur border border-primary/30 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-4 z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2">
              <div className="bg-primary/20 text-primary rounded-lg px-2 py-1 font-bold text-xs">
                {selectedPaperIds.size}
              </div>
              <span className="text-xs font-semibold text-foreground">
                {selectedPaperIds.size === 1 ? 'Paper selected' : 'Papers selected'}
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <button
              onClick={() => onRunLLMOnSelected(Array.from(selectedPaperIds))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Run LLM Pipeline
            </button>
            <button
              onClick={() => {
                if (setSelectedPaperIds) setSelectedPaperIds(new Set());
              }}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1.5 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </>
  );
}
