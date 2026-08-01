'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  Cloud, Loader2, FolderTree, UploadCloud, Square, 
  CheckCircle2, AlertCircle, XCircle, Filter, Sparkles, Server, Terminal, RefreshCw
} from 'lucide-react';
import { useNdjsonStream } from '@/hooks/useNdjsonStream';

interface CloudGoldMinePanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ExportStateSnapshot {
  isExecuting: boolean;
  phase: 'idle' | 'staging' | 'uploading' | 'complete' | 'error' | 'cancelled';
  progress: number;
  statusText: string;
  currentItem: string | null;
  logs: string[];
  stats: {
    totalPapers: number;
    stagedFiles: number;
    uploadedFiles: number;
    skippedQa: number;
    transferSpeed: string;
    categories: number;
  };
}

interface PreviewData {
  remoteDest: string;
  totalQualifying: number;
  totalStagedEstimate: number;
  skippedQa: number;
  categories: Array<{ name: string; count: number; sampleFiles: string[] }>;
}

export default function CloudGoldMinePanel({ projectId, showToast }: CloudGoldMinePanelProps) {
  const [keys, setKeys] = useState<string[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>('');
  
  // QA Threshold Controls
  const [qaFilterEnabled, setQaFilterEnabled] = useState(false);
  const [minQaThreshold, setMinQaThreshold] = useState<number>(6);

  // Dynamic Preview State
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Live Export State
  const [exportState, setExportState] = useState<ExportStateSnapshot>({
    isExecuting: false,
    phase: 'idle',
    progress: 0,
    statusText: '',
    currentItem: null,
    logs: [],
    stats: {
      totalPapers: 0,
      stagedFiles: 0,
      uploadedFiles: 0,
      skippedQa: 0,
      transferSpeed: '0 B/s',
      categories: 0
    }
  });

  const logBoxRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [exportState.logs]);

  const { connect: connectStream, cancelStream } = useNdjsonStream({
    onEvent: (msg: any) => {
      if (msg.event === 'restore' || msg.isExecuting !== undefined) {
        setExportState((prev) => ({
          isExecuting: msg.isExecuting ?? prev.isExecuting,
          phase: msg.phase ?? prev.phase,
          progress: msg.progress !== undefined ? msg.progress : prev.progress,
          statusText: msg.statusText || prev.statusText,
          currentItem: msg.currentItem !== undefined ? msg.currentItem : prev.currentItem,
          stats: msg.stats || prev.stats,
          logs: msg.logs ? msg.logs : (msg.log ? [...prev.logs, msg.log] : prev.logs)
        }));
      }
    },
    onComplete: () => {
      setExportState((prev) => ({
        ...prev,
        isExecuting: false,
        phase: 'complete',
        progress: 100,
        statusText: 'Cloud Gold Mine sync completed!'
      }));
      showToast('Cloud Gold Mine export finished!', 'success');
    },
    onError: (err) => {
      setExportState((prev) => ({
        ...prev,
        isExecuting: false,
        phase: 'error',
        statusText: err.message || 'Export failed'
      }));
      showToast(err.message || 'Error exporting to cloud', 'error');
    }
  });

  // Check initial state & fetch Umbrellanizer keys on mount
  useEffect(() => {
    async function init() {
      if (!projectId) return;

      // 1. Fetch Umbrellanizer keys
      try {
        const res = await fetch(`/api/export/cloud-gold-mine/keys?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setKeys(data.keys || []);
          if (data.keys && data.keys.length > 0) {
            setSelectedKey(data.keys[0]);
          }
        }
      } catch (err) {
        // ignore
      } finally {
        setLoadingKeys(false);
      }

      // 2. Check active export status
      try {
        const statusRes = await fetch('/api/export/cloud-gold-mine?status=true');
        if (statusRes.ok) {
          const data: ExportStateSnapshot = await statusRes.json();
          if (data.isExecuting || ['staging', 'uploading'].includes(data.phase)) {
            setExportState(data);
            connectStream('/api/export/cloud-gold-mine?stream=true');
          }
        }
      } catch (err) {
        // ignore
      }
    }

    init();
  }, [projectId]);

  // Fetch dynamic preview whenever project, selected key, or QA filter parameters change
  useEffect(() => {
    if (!projectId) return;
    let active = true;

    async function fetchPreview() {
      setLoadingPreview(true);
      try {
        const query = new URLSearchParams({
          projectId,
          groupByKey: selectedKey,
          qaFilterEnabled: String(qaFilterEnabled),
          minQaThreshold: String(minQaThreshold)
        });
        const res = await fetch(`/api/export/cloud-gold-mine/preview?${query}`);
        if (res.ok && active) {
          const data = await res.json();
          setPreviewData(data);
        }
      } catch (e) {
        // ignore
      } finally {
        if (active) setLoadingPreview(false);
      }
    }

    fetchPreview();
    return () => { active = false; };
  }, [projectId, selectedKey, qaFilterEnabled, minQaThreshold]);

  const handleExport = async () => {
    if (!projectId) return;

    try {
      const res = await fetch('/api/export/cloud-gold-mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          groupByKey: selectedKey,
          minQaThreshold,
          qaFilterEnabled
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start export');
      }

      // Connect to NDJSON stream
      connectStream('/api/export/cloud-gold-mine?stream=true');
      showToast('Started Cloud Gold Mine export stream', 'info');
    } catch (err: any) {
      showToast(err.message || 'Error exporting to cloud', 'error');
    }
  };

  const handleCancel = async () => {
    try {
      await fetch('/api/export/cloud-gold-mine', { method: 'DELETE' });
      cancelStream();
      setExportState((prev) => ({
        ...prev,
        isExecuting: false,
        phase: 'cancelled',
        statusText: 'Export cancelled by user'
      }));
      showToast('Cloud export cancelled', 'info');
    } catch (err: any) {
      showToast('Failed to request cancel', 'error');
    }
  };

  const handleResetUI = () => {
    setExportState({
      isExecuting: false,
      phase: 'idle',
      progress: 0,
      statusText: '',
      currentItem: null,
      logs: [],
      stats: {
        totalPapers: 0,
        stagedFiles: 0,
        uploadedFiles: 0,
        skippedQa: 0,
        transferSpeed: '0 B/s',
        categories: 0
      }
    });
  };

  const isRunning = exportState.isExecuting || ['staging', 'uploading'].includes(exportState.phase);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 overflow-y-auto max-w-4xl mx-auto">
      
      {/* Header Icon & Title */}
      <div className="flex flex-col items-center space-y-2">
        <div className="bg-primary/10 p-5 rounded-full relative">
          <Cloud className="w-12 h-12 text-primary" />
          <Sparkles className="w-5 h-5 text-amber-400 absolute top-2 right-2 animate-pulse" />
        </div>
        <h2 className="text-xl font-black text-foreground tracking-tight">Cloud Gold Mine</h2>
        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
          Restructure and upload your SYNCED cohort's PDFs to cloud storage, optimized for NotebookLM ingestion with theme-first folder organization and QA threshold filtering.
        </p>
      </div>

      {!isRunning && exportState.phase !== 'complete' && exportState.phase !== 'error' && exportState.phase !== 'cancelled' ? (
        /* Configuration & Setup View */
        <div className="bg-secondary/20 border border-border p-6 rounded-2xl text-left text-xs text-muted-foreground w-full space-y-5 shadow-sm">
          
          {/* Dynamic Directory Structure Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-foreground">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-emerald-500" />
                Live Dynamic Directory Structure Preview
              </div>
              {loadingPreview && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-normal">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  Updating preview...
                </div>
              )}
            </div>

            <div className="bg-background border border-border p-3.5 rounded-xl text-[10px] font-mono leading-relaxed opacity-90 text-foreground/90 max-h-72 overflow-y-auto space-y-1.5 scrollbar-thin">
              <div className="text-primary font-bold">
                {previewData?.remoteDest || 'gdrive:SLR_Magic/Gold_Mine_Exports/Flat_Exports_<timestamp>'}
              </div>

              {!previewData || previewData.categories.length === 0 ? (
                <div className="text-muted-foreground italic pl-3 py-1">
                  No matching SYNCED PDFs found for this project &amp; criteria.
                </div>
              ) : (
                previewData.categories.map((cat, catIdx) => {
                  const isFlat = cat.name === '';
                  if (isFlat) {
                    return cat.sampleFiles.map((file, fIdx) => (
                      <div key={fIdx} className="pl-4 text-emerald-400 truncate">
                        ├── {file}
                      </div>
                    ));
                  }
                  return (
                    <div key={catIdx} className="pl-2 space-y-0.5">
                      <div className="text-amber-400 font-semibold truncate">
                        ├── {cat.name}/ <span className="text-[9px] text-muted-foreground">({cat.count} {cat.count === 1 ? 'file' : 'files'})</span>
                      </div>
                      {cat.sampleFiles.map((file, fIdx) => (
                        <div key={fIdx} className="pl-6 text-foreground/80 truncate">
                          │ &nbsp; ├── {file}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {previewData && (
              <div className="flex flex-wrap items-center justify-between text-[10px] text-muted-foreground px-1 pt-1">
                <span>Qualifying Papers: <strong className="text-foreground">{previewData.totalQualifying}</strong></span>
                <span>Estimated Staged Files: <strong className="text-foreground">{previewData.totalStagedEstimate}</strong></span>
                {qaFilterEnabled && (
                  <span>Filtered Out (&lt; {minQaThreshold} QA): <strong className="text-amber-500">{previewData.skippedQa}</strong></span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            {/* Grouping Variable Dropdown */}
            <div className="space-y-1.5">
              <label className="font-bold text-foreground text-xs block">Grouping Variable (Umbrellanizer Key)</label>
              {loadingKeys ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Loading keys...
                </div>
              ) : keys.length === 0 ? (
                <div className="text-muted-foreground italic text-[11px] py-1">
                  No mapped variables found. PDFs will be exported into a single flat folder.
                </div>
              ) : (
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-bold cursor-pointer"
                >
                  <option value="">None (Flat Folder - No Subdirectories)</option>
                  {keys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              )}
            </div>

            {/* QA Threshold Filter */}
            <div className="space-y-1.5 bg-background/50 border border-border/60 p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground text-xs flex items-center gap-1.5 cursor-pointer select-none">
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  Minimum QA Score Filter
                </label>
                <input
                  type="checkbox"
                  checked={qaFilterEnabled}
                  onChange={(e) => setQaFilterEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {qaFilterEnabled ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">Min Threshold Score:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={minQaThreshold}
                    onChange={(e) => setMinQaThreshold(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-secondary border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-bold font-mono focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-muted-foreground italic">(&ge; {minQaThreshold} ordinal)</span>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic pt-1">
                  Disabled — Exports all Stage 4 Included SYNCED papers regardless of QA score.
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              onClick={handleExport}
              disabled={Boolean(loadingKeys || (previewData && previewData.totalQualifying === 0))}
              className="px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold rounded-xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wide text-xs cursor-pointer disabled:cursor-not-allowed"
            >
              <UploadCloud className="w-4 h-4" />
              Start Cloud Sync
            </button>
          </div>

        </div>
      ) : (
        /* Live Execution & Progress View */
        <div className="bg-secondary/20 border border-border p-6 rounded-2xl text-left text-xs text-muted-foreground w-full space-y-5 shadow-sm">
          
          {/* Phase Badge & Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              {exportState.phase === 'staging' && <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />}
              {exportState.phase === 'uploading' && <Cloud className="w-5 h-5 text-primary animate-pulse" />}
              {exportState.phase === 'complete' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {exportState.phase === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
              {exportState.phase === 'cancelled' && <XCircle className="w-5 h-5 text-muted-foreground" />}
              <div>
                <h3 className="font-bold text-sm text-foreground uppercase tracking-wide">
                  {exportState.phase === 'staging' && 'Phase 1: Staging PDFs Locally...'}
                  {exportState.phase === 'uploading' && 'Phase 2: Uploading to Cloud Storage...'}
                  {exportState.phase === 'complete' && 'Cloud Sync Completed'}
                  {exportState.phase === 'error' && 'Export Error'}
                  {exportState.phase === 'cancelled' && 'Export Cancelled'}
                </h3>
                <p className="text-[11px] text-muted-foreground">{exportState.statusText}</p>
              </div>
            </div>

            {isRunning && (
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Cancel Export
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-foreground">
              <span>{exportState.phase === 'staging' ? 'Staging Progress' : 'Upload Progress'}</span>
              <span>{exportState.progress}%</span>
            </div>
            <div className="w-full bg-secondary h-3 rounded-full overflow-hidden border border-border/40 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  exportState.phase === 'complete'
                    ? 'bg-emerald-500'
                    : exportState.phase === 'error'
                    ? 'bg-destructive'
                    : exportState.phase === 'cancelled'
                    ? 'bg-muted-foreground'
                    : 'bg-primary'
                }`}
                style={{ width: `${exportState.progress}%` }}
              />
            </div>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-background/60 border border-border/60 p-3 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Qualifying Papers</span>
              <span className="text-base font-black text-foreground">{exportState.stats.totalPapers}</span>
            </div>
            <div className="bg-background/60 border border-border/60 p-3 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Staged PDF Files</span>
              <span className="text-base font-black text-foreground">{exportState.stats.stagedFiles}</span>
            </div>
            <div className="bg-background/60 border border-border/60 p-3 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Theme Categories</span>
              <span className="text-base font-black text-foreground">{exportState.stats.categories}</span>
            </div>
            <div className="bg-background/60 border border-border/60 p-3 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Transfer Speed</span>
              <span className="text-base font-black text-primary font-mono">{exportState.stats.transferSpeed || '0 B/s'}</span>
            </div>
          </div>

          {/* Current File Item */}
          {exportState.currentItem && (
            <div className="flex items-center gap-2 text-xs font-mono bg-background/80 border border-border/60 px-3 py-2 rounded-lg text-foreground truncate">
              <Server className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{exportState.currentItem}</span>
            </div>
          )}

          {/* Scrollable Console Logs */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
              <Terminal className="w-3 h-3" />
              Execution Output Logs
            </div>
            <div
              ref={logBoxRef}
              className="bg-black/90 text-emerald-400 font-mono text-[10px] p-3 rounded-xl h-36 overflow-y-auto space-y-1 leading-relaxed border border-border/40"
            >
              {exportState.logs.length === 0 ? (
                <div className="text-muted-foreground italic">Waiting for log stream...</div>
              ) : (
                exportState.logs.map((log, idx) => (
                  <div key={idx} className="whitespace-pre-wrap break-all">{log}</div>
                ))
              )}
            </div>
          </div>

          {/* Reset / New Export Button when done */}
          {!isRunning && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={handleResetUI}
                className="px-6 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 font-bold rounded-xl border border-border transition-all flex items-center gap-2 text-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Configure New Export
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
