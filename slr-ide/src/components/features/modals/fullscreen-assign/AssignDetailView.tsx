import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CheckCircle2, AlertTriangle, Play, RefreshCw, 
  Terminal, ExternalLink, X, Check, Copy
} from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';

interface AssignDetailViewProps {
  projects: any[];
  activeProjectId: string;
  assignSelectedPaper: any;
  setAssignSelectedPaper: React.Dispatch<React.SetStateAction<any>>;
  setAssignPapers: React.Dispatch<React.SetStateAction<any[]>>;
  assignIsRunning: boolean;
  assignLogs: any[];
  setAssignLogs: React.Dispatch<React.SetStateAction<any[]>>;
  assignProgress: number;
  setAssignProgress: React.Dispatch<React.SetStateAction<number>>;
  assignStatusText: string;
  setAssignStatusText: (v: string) => void;
  activeAssignDropdown: any;
  setActiveAssignDropdown: React.Dispatch<React.SetStateAction<any>>;
  handleAssignPool: (paperId: string, pool: string | null, tag?: string | null) => Promise<void>;
  cloudName: string;
  runSinglePaperPipeline: (paperId: string) => Promise<void>;
  assignWaitingLogin: boolean;
  setAssignWaitingLogin: React.Dispatch<React.SetStateAction<boolean>>;
  singlePipelineAbortControllerRef: React.MutableRefObject<AbortController | null>;
  logEndRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function AssignDetailView({
  projects,
  activeProjectId,
  assignSelectedPaper,
  setAssignSelectedPaper,
  setAssignPapers,
  assignIsRunning,
  assignLogs,
  setAssignLogs,
  assignProgress,
  setAssignProgress,
  assignStatusText,
  setAssignStatusText,
  activeAssignDropdown,
  setActiveAssignDropdown,
  handleAssignPool,
  cloudName,
  runSinglePaperPipeline,
  assignWaitingLogin,
  setAssignWaitingLogin,
  singlePipelineAbortControllerRef,
  logEndRef,
  onClose,
  showToast
}: AssignDetailViewProps) {
  const [proxyBaseUrl, setProxyBaseUrl] = useState('');
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyDetails = async () => {
    if (!assignSelectedPaper) return;
    const publisherName = assignSelectedPaper.Publisher || assignSelectedPaper.Original_Publisher || '—';
    const citationCount = assignSelectedPaper.citation_count !== undefined && assignSelectedPaper.citation_count !== null ? assignSelectedPaper.citation_count : '0';
    const textToCopy = [
      `Title: ${assignSelectedPaper.Title || '—'}`,
      `Authors: ${assignSelectedPaper.Authors || '—'}`,
      `Year: ${assignSelectedPaper.Year || '—'}`,
      `DOI: ${assignSelectedPaper.DOI || '—'}`,
      `Publisher: ${publisherName}`,
      `Abstract: ${assignSelectedPaper.Abstract || '—'}`,
      `Citations: ${citationCount}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      showToast('Paper details copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy details to clipboard', 'error');
    }
  };

  useEffect(() => {
    if (assignSelectedPaper) {
      setNotesText(assignSelectedPaper.notes || '');
    }
  }, [assignSelectedPaper?.Paper_ID]);

  const handleSaveNotes = async () => {
    if (!assignSelectedPaper) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/papers/${assignSelectedPaper.Paper_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Title: assignSelectedPaper.Title,
          notes: notesText
        })
      });
      if (res.ok) {
        showToast('Notes saved successfully', 'success');
        
        // Update selection and list states immutably
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAssignSelectedPaper((prev: any) => prev ? { ...prev, notes: notesText } : null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAssignPapers((prev: any[]) => prev.map(p => p.Paper_ID === assignSelectedPaper.Paper_ID ? { ...p, notes: notesText } : p));
        
        // Broadcast the change to other tabs
        broadcastSync('SYNC_PAPERS');
      } else {
        showToast('Failed to save notes', 'error');
      }
    } catch (err) {
      const error = err as Error;
      showToast(error.message || 'Error saving notes', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.SCRAPER_PROXY_BASE_URL) {
          setProxyBaseUrl(data.SCRAPER_PROXY_BASE_URL);
        }
      })
      .catch((err) => console.error('Error loading proxy config:', err));
  }, []);

  const getProxyDoiUrl = (doi: string, proxyUrl: string): string => {
    if (!doi) return '';
    const cleanDoi = doi.trim();
    if (!proxyUrl) {
      return `https://doi.org/${cleanDoi}`;
    }
    const cleanProxy = proxyUrl.trim();
    if (cleanProxy.endsWith('doi.org/') || cleanProxy.endsWith('doi.org')) {
      const sep = cleanProxy.endsWith('/') ? '' : '/';
      return `${cleanProxy}${sep}${cleanDoi}`;
    }
    if (cleanProxy.includes('doi.org/')) {
      return `${cleanProxy}${cleanDoi}`;
    }
    if (cleanProxy.endsWith('url=')) {
      return `${cleanProxy}https://doi.org/${cleanDoi}`;
    }
    if (cleanProxy.includes('?')) {
      return `${cleanProxy}&url=${encodeURIComponent(`https://doi.org/${cleanDoi}`)}`;
    }
    return `${cleanProxy}/login?url=${encodeURIComponent(`https://doi.org/${cleanDoi}`)}`;
  };

  if (!assignSelectedPaper) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
        <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mb-3" />
        <h4 className="font-bold text-sm mb-1 text-foreground">No paper selected</h4>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Select a literature reference from the left panel list to inspect its metadata and assign it to a calibration pool.
        </p>
      </div>
    );
  }

  const getActiveProjectPoolTags = (poolId: string): { code: string; label: string }[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeProj = projects.find((p: any) => String(p.id) === String(activeProjectId));
    if (!activeProj || !activeProj.pool_tags) return [];
    try {
      const parsed = typeof activeProj.pool_tags === 'string' ? JSON.parse(activeProj.pool_tags) : activeProj.pool_tags;
      return parsed[poolId] || [];
    } catch {
      return [];
    }
  };

  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col space-y-6 border-l border-border/80">
      {/* Top action header containing Close button */}
      <div className="flex items-center justify-between shrink-0 select-none pb-2 border-b border-border/40">
        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Paper Details Workspace</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyDetails}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-extrabold rounded-lg border border-primary/20 flex items-center gap-1 transition-all duration-200 cursor-pointer"
            title="Copy paper metadata to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 animate-in zoom-in-50 duration-150" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Details'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] font-extrabold rounded-lg border border-border flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Close & Expand List
          </button>
        </div>
      </div>

      <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 w-full pb-8">
        
        {/* Paper Info Section */}
        <div className="bg-card border border-border p-5 rounded-xl space-y-3 shrink-0 shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="font-mono text-xs font-bold text-muted-foreground/80 block uppercase">Paper Identification: {assignSelectedPaper.Paper_ID}</span>
              <h2 className="font-bold text-lg xl:text-xl text-foreground leading-snug mt-0.5">{assignSelectedPaper.Title}</h2>
            </div>
            {/* Assignment buttons inside Detail View */}
            <div className="flex flex-col gap-1.5 shrink-0 select-none">
              <span className="text-[8px] text-muted-foreground uppercase font-black tracking-wider text-right block mb-0.5">Quick Actions</span>
              <div className="flex items-center gap-1.5 bg-secondary/35 p-1 rounded-lg border border-border">
                {[
                  { id: 'pool_a', label: 'Pool A', color: 'hover:bg-indigo-500/10 hover:text-indigo-400' },
                  { id: 'pool_b', label: 'Pool B', color: 'hover:bg-emerald-500/10 hover:text-emerald-400' },
                  { id: 'pool_c', label: 'Pool C', color: 'hover:bg-amber-500/10 hover:text-amber-400' }
                ].map((pool) => {
                  const isAssigned = assignSelectedPaper.calibration_pool === pool.id;
                  const currentTag = isAssigned ? assignSelectedPaper.calibration_tag : null;
                  const poolTags = getActiveProjectPoolTags(pool.id);
                  const hasTags = poolTags.length > 0;
                  const showDropdown = activeAssignDropdown?.paperId === assignSelectedPaper.Paper_ID && activeAssignDropdown?.poolId === pool.id;

                  return (
                    <div key={pool.id} className="relative">
                      <button
                        type="button"
                        disabled={assignIsRunning}
                        onClick={() => {
                          if (poolTags.length > 0) {
                            if (showDropdown) {
                              setActiveAssignDropdown(null);
                            } else {
                              setActiveAssignDropdown({ paperId: assignSelectedPaper.Paper_ID, poolId: pool.id });
                            }
                          } else {
                            handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, null);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-md text-[9px] font-extrabold uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                          isAssigned
                            ? pool.id === 'pool_a' ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20' :
                              pool.id === 'pool_b' ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20' :
                              'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/20'
                            : `text-muted-foreground hover:bg-secondary ${pool.color}`
                        }`}
                      >
                        {isAssigned && <Check className="w-3 h-3 shrink-0" />}
                        <span>{pool.label}</span>
                        {currentTag && (
                          <span className="bg-background/20 px-1 rounded text-[8px] font-bold border border-foreground/10">
                            {currentTag}
                          </span>
                        )}
                      </button>

                      {showDropdown && hasTags && (
                        <>
                          <div 
                            className="fixed inset-0 z-40 bg-transparent" 
                            onClick={() => setActiveAssignDropdown(null)} 
                          />
                          <div className="absolute top-full mt-1.5 right-0 bg-popover/95 border border-border shadow-2xl rounded-lg py-1.5 z-50 w-48 text-[10px] font-semibold text-foreground flex flex-col shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-2 pb-1 text-[8px] uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
                              Select Pool Tag
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, null);
                                setActiveAssignDropdown(null);
                              }}
                              className={`px-2.5 py-1.5 text-left hover:bg-secondary transition-colors flex items-center justify-between cursor-pointer ${
                                isAssigned && !currentTag ? 'text-primary font-extrabold bg-secondary/30' : ''
                              }`}
                            >
                              <span>No Tag (General)</span>
                              {isAssigned && !currentTag && <Check className="w-3 h-3 text-primary shrink-0" />}
                            </button>
                            {poolTags.map((tag) => {
                              const isTagActive = isAssigned && currentTag === tag.code;
                              return (
                                <button
                                  key={tag.code}
                                  type="button"
                                  onClick={() => {
                                    handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, tag.code);
                                    setActiveAssignDropdown(null);
                                  }}
                                  className={`px-2.5 py-1.5 text-left hover:bg-secondary transition-colors border-t border-border/30 flex items-center justify-between cursor-pointer ${
                                    isTagActive ? 'text-primary font-extrabold bg-secondary/30' : ''
                                  }`}
                                >
                                  <span className="truncate">
                                    <span className="font-bold text-primary mr-1">{tag.code}</span> - {tag.label}
                                  </span>
                                  {isTagActive && <Check className="w-3 h-3 text-primary shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {assignSelectedPaper.calibration_pool && (
                  <button
                    disabled={assignIsRunning}
                    onClick={() => handleAssignPool(assignSelectedPaper.Paper_ID, null)}
                    className="px-2.5 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md text-[9px] font-bold uppercase transition-all duration-200"
                    title="Unassign Paper"
                  >
                    Unassign
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Paper Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-3 border-t border-border/60 text-xs font-semibold text-muted-foreground leading-relaxed">
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Authors</span>
              <span className="text-foreground">{assignSelectedPaper.Authors || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Year</span>
              <span className="text-foreground">{assignSelectedPaper.Year || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">DOI</span>
              {assignSelectedPaper.DOI ? (
                <a
                  href={getProxyDoiUrl(assignSelectedPaper.DOI, proxyBaseUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono inline-flex items-center gap-1 select-text"
                  title={proxyBaseUrl ? "Open DOI via library EzProxy redirection" : "Open DOI link"}
                >
                  {assignSelectedPaper.DOI}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span>—</span>
              )}
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Publisher</span>
              <span className="text-foreground">{assignSelectedPaper.Publisher || assignSelectedPaper.Original_Publisher || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Source Database</span>
              <span className="text-foreground">{assignSelectedPaper.Source || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Screening Status</span>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                assignSelectedPaper.Status === 'INCLUDE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                assignSelectedPaper.Status === 'EXCLUDE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                'bg-secondary/40 text-muted-foreground border-border/40'
              }`}>
                {assignSelectedPaper.Status || 'PENDING'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Import Date</span>
              <span className="text-foreground">{assignSelectedPaper.Import_Date || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Import Source</span>
              <span className="text-foreground font-mono">{assignSelectedPaper.Import_Source || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Citation Count</span>
              <span className="text-foreground">
                📊 {assignSelectedPaper.citation_count !== undefined && assignSelectedPaper.citation_count !== null ? assignSelectedPaper.citation_count : '0'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Local PDF Status</span>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                assignSelectedPaper.Local_PDF_Status === 'SYNCED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                assignSelectedPaper.Local_PDF_Status === 'DOWNLOADED' || assignSelectedPaper.Local_PDF_Status === 'MATCHED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                assignSelectedPaper.Local_PDF_Status === 'NEEDS_REVIEW' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                assignSelectedPaper.Local_PDF_Status === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {assignSelectedPaper.Local_PDF_Status || 'IGNORED'}
              </span>
            </div>

            {assignSelectedPaper.Local_PDF_Path && (
              <div className="col-span-2 md:col-span-3">
                <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Local PDF Filename</span>
                <span className="text-foreground font-mono select-all bg-secondary/30 px-2 py-1 rounded border border-border/40 inline-block break-all">
                  {assignSelectedPaper.Local_PDF_Path.split('/').pop()?.split('\\').pop()}
                </span>
              </div>
            )}

            {assignSelectedPaper.PDF_Link && (
              <div className="col-span-2 md:col-span-3">
                <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Original URL / PDF Link</span>
                <a
                  href={assignSelectedPaper.PDF_Link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all font-mono inline-flex items-center gap-1 select-text"
                >
                  {assignSelectedPaper.PDF_Link}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>

          {/* Consensus / Human Review Details */}
          {(assignSelectedPaper.Human_Decision || assignSelectedPaper.Human_Rationale || assignSelectedPaper.Human_EC_Trigger) && (
            <div className="pt-3 border-t border-border/60 space-y-2 text-xs">
              <span className="block text-[10px] text-muted-foreground/70 uppercase tracking-wider font-extrabold">Review Consensus Summary</span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] text-muted-foreground/60">Human Decision</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                    assignSelectedPaper.Human_Decision === 'INCLUDE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    assignSelectedPaper.Human_Decision === 'EXCLUDE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    'bg-secondary/40 text-muted-foreground border-border/40'
                  }`}>
                    {assignSelectedPaper.Human_Decision || 'PENDING'}
                  </span>
                </div>
                {assignSelectedPaper.Human_EC_Trigger && (
                  <div>
                    <span className="block text-[10px] text-muted-foreground/60">Exclusion Criteria Trigger</span>
                    <span className="text-foreground font-bold">{assignSelectedPaper.Human_EC_Trigger}</span>
                  </div>
                )}
              </div>
              {assignSelectedPaper.Human_Rationale && (
                <div>
                  <span className="block text-[10px] text-muted-foreground/60">Rationale</span>
                  <p className="text-foreground italic leading-relaxed bg-secondary/10 p-2.5 rounded border border-border/40 select-text">{assignSelectedPaper.Human_Rationale}</p>
                </div>
              )}
            </div>
          )}

          {assignSelectedPaper.Abstract && (
            <div className="pt-2 border-t border-border/60">
              <span className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider block mb-1">Abstract</span>
              <p className="text-xs xl:text-sm text-foreground font-medium leading-relaxed select-text pt-1">{assignSelectedPaper.Abstract}</p>
            </div>
          )}

          {/* Notes / Findings */}
          <div className="pt-3 border-t border-border/60">
            <div className="flex items-center justify-between mb-1.5 select-none">
              <span className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider block">Notes / Findings</span>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-2.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-extrabold uppercase rounded border border-primary/20 transition-colors cursor-pointer"
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
            <textarea
              className="w-full bg-secondary/25 border border-border/60 rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
              rows={3}
              placeholder="Record findings, comments, or extra context here..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
        </div>

        {/* PDF Viewer or Acquisition Panel */}
        <div className="bg-card border border-border rounded-xl shadow-sm relative shrink-0 overflow-hidden">
          {/* Pool A: PDF is not required */}
          {assignSelectedPaper.calibration_pool === 'pool_a' ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
              <CheckCircle2 className="w-12 h-12 text-indigo-400 mb-3 animate-bounce" />
              <h4 className="font-bold text-sm mb-1 text-foreground font-semibold">Paper Assigned to Pool A</h4>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Pool A only screens Title and Abstract. Full text PDF file matching is not required for this calibration cohort.
              </p>
            </div>
          ) : (assignSelectedPaper.Local_PDF_Status === 'MATCHED' || assignSelectedPaper.Local_PDF_Status === 'DOWNLOADED' || assignSelectedPaper.Local_PDF_Status === 'SYNCED') && assignSelectedPaper.Local_PDF_Path ? (
            /* Embed PDF Viewer */
            <div className="h-[600px] flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border bg-secondary/15 flex items-center justify-between shrink-0 select-none">
                <span className="text-[9px] text-emerald-400 uppercase font-black tracking-wider flex items-center gap-1.5 font-bold">
                  <span className="w-1.5 h-1.5 bg-emerald-50-full animate-ping" />
                  PDF Available Inline
                </span>
                <a
                  href={`/api/pdf/serve?path=${encodeURIComponent(assignSelectedPaper.Local_PDF_Path)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] font-bold text-primary hover:text-primary/80 transition-colors p-0.5 rounded ml-1 shrink-0"
                  title={`Open ${cloudName} File`}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex-1 bg-secondary/20 h-[550px]">
                <iframe
                  src={`/api/pdf/serve?path=${encodeURIComponent(assignSelectedPaper.Local_PDF_Path)}`}
                  className="w-full h-full border-0"
                  title="Embedded PDF Viewer"
                />
              </div>
            </div>
          ) : (
            /* Get PDF Acquisition Area */
            <div className="border border-border rounded-xl bg-card p-6 select-none flex flex-col min-h-[350px] shrink-0 shadow-sm">
              <div className={`flex flex-col items-center justify-center text-center py-4 ${assignIsRunning ? 'border-b border-border/40 pb-4 shrink-0' : 'flex-1'}`}>
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-3 animate-pulse" />
                <h4 className="font-bold text-sm mb-1 text-foreground">Local PDF Not Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">
                  Pool B and Pool C require full-text screening. Trigger PDF matching and crawler scraping specifically for this paper now.
                </p>
                
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => runSinglePaperPipeline(assignSelectedPaper.Paper_ID)}
                    disabled={assignIsRunning}
                    className={`px-4 py-2 font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px] ${
                      assignIsRunning 
                        ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50 shadow-none' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg'
                    }`}
                  >
                    {assignIsRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    {assignIsRunning ? 'Acquiring PDF...' : 'Get PDF via Cache Matching & Scraping'}
                  </button>

                  {assignIsRunning && (
                    <button
                      onClick={async () => {
                        singlePipelineAbortControllerRef.current?.abort();
                        await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                      }}
                      className="px-4 py-2 border border-border text-[10px] font-bold uppercase rounded-lg hover:bg-secondary text-foreground transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  )}

                  {assignIsRunning && assignWaitingLogin && (
                    <button
                      onClick={async () => {
                        setAssignWaitingLogin(false);
                        await fetch('/api/pdf/batch/resume', { method: 'POST' });
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase rounded-lg text-[10px] tracking-wide shadow-md flex items-center gap-1.5 animate-pulse transition-all hover:scale-105 shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Resume Download
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time single-run console log widget */}
              {assignIsRunning && (
                <div className="mt-4 h-64 border border-border/80 rounded-lg bg-black text-emerald-400 font-mono text-[9px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 shadow-inner select-text">
                  {/* console header */}
                  <div className="p-2 border-b border-border/40 bg-zinc-900/60 flex items-center justify-between shrink-0 select-none">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                      Single PDF Pipeline: {assignStatusText}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400">{assignProgress}%</span>
                      {assignWaitingLogin && (
                        <button
                          onClick={async () => {
                            await fetch('/api/pdf/batch/resume', { method: 'POST' });
                          }}
                          className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase rounded text-[7px]"
                        >
                          Resume Login
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          singlePipelineAbortControllerRef.current?.abort();
                          await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                        }}
                        className="px-1.5 py-0.5 bg-destructive hover:bg-destructive/80 text-white font-bold uppercase rounded text-[7px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  {/* logs body */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-1.5">
                    {assignLogs.length === 0 ? (
                      <span className="text-zinc-600 block italic">Spawning subprocess connection...</span>
                    ) : (
                      assignLogs.map((log: string, index: number) => (
                        <div key={index} className="leading-normal whitespace-pre-wrap">{log}</div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
