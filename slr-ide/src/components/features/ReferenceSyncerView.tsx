'use client';

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode2, 
  Search, 
  Download, 
  Layers, 
  RotateCcw,
  BookOpenCheck,
  Eye,
  FolderOpen,
  Database
} from 'lucide-react';
import { useReferenceSyncer } from '@/hooks/useReferenceSyncer';
import SyncerStatsHud from './reference-syncer/SyncerStatsHud';
import CitationInspectionTable from './reference-syncer/CitationInspectionTable';
import SuspiciousFindingsPanel from './reference-syncer/SuspiciousFindingsPanel';
import ExecutionSummaryPanel from './reference-syncer/ExecutionSummaryPanel';
import TexDiffModal from './reference-syncer/TexDiffModal';

interface ReferenceSyncerViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  activeProjectId?: string;
}

export default function ReferenceSyncerView({
  showToast,
  activeProjectId
}: ReferenceSyncerViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bibFileInputRef = useRef<HTMLInputElement>(null);
  const [activeViewTab, setActiveViewTab] = useState<'citations' | 'suspicious' | 'export'>('citations');

  const {
    uploadedFiles,
    isScanning,
    isExporting,
    scanSummary,
    activeFileIndex,
    setActiveFileIndex,
    activeFileResult,
    activeFilter,
    setActiveFilter,
    searchTerm,
    setSearchTerm,
    filteredCitations,
    diffModalFile,
    setDiffModalFile,
    exportedFiles,
    handleFilesUpload,
    handleLoadSampleFiles,
    handleSetOverride,
    handleResetOverride,
    handleToggleIgnore,
    getFileSyncedContent,
    prepareExport,
    downloadSingleFile,
    downloadAllFiles,
    exportSummaryReport,
    bibStatus,
    isReloadingBib,
    hasBibChangedSinceScan,
    reloadBibDatabase,
    uploadAndReplaceBib,
    reset
  } = useReferenceSyncer(showToast, activeProjectId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden p-6 gap-5">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Reference Syncer & Citation Studio
              </h2>
              {/* BibTeX Source Info Badge & Reload Action */}
              <div className="flex items-center gap-1.5 bg-secondary/50 border border-border px-2.5 py-1 rounded-lg text-xs">
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-mono font-medium text-foreground text-[11px]">
                  db/references.bib
                </span>
                {bibStatus && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({bibStatus.totalEntries.toLocaleString()} entries{bibStatus.sizeFormatted ? ` • ${bibStatus.sizeFormatted}` : ''})
                  </span>
                )}
                <button
                  onClick={reloadBibDatabase}
                  disabled={isReloadingBib}
                  className={`p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors ${
                    isReloadingBib ? 'animate-spin text-primary' : ''
                  }`}
                  title="Reload references.bib from disk"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  onClick={() => bibFileInputRef.current?.click()}
                  disabled={isReloadingBib}
                  className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Upload and replace db/references.bib"
                >
                  <Upload className="w-3 h-3" />
                </button>
                <input
                  type="file"
                  ref={bibFileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      uploadAndReplaceBib(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                  accept=".bib"
                  className="hidden"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated LaTeX citation inspection, title-to-bib resolution, and multi-file .tex synchronization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {scanSummary ? (
            <>
              <button
                onClick={() => setDiffModalFile(activeFileResult)}
                disabled={!activeFileResult}
                className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5 text-primary" />
                <span>Diff Inspector</span>
              </button>

              <button
                onClick={() => {
                  prepareExport();
                  setActiveViewTab('export');
                }}
                disabled={isExporting}
                className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Synced .tex</span>
              </button>

              <button
                onClick={reset}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg border border-border cursor-pointer transition-colors"
                title="Reset / Start New Session"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={handleLoadSampleFiles}
              disabled={isScanning}
              className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isScanning ? 'Scanning...' : 'Load Example Files (tmp/)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!scanSummary ? (
        /* Ingestion / Upload Screen */
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-8 bg-card/40 transition-colors">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
            multiple
            accept=".tex,.txt,.latex"
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="w-full max-w-xl p-8 text-center space-y-4 flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-md">
              <Upload className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Drop your LaTeX (.tex) files here
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Upload one or multiple manuscript sections (e.g. Introduction, Results, Discussion) to scan and replace broken citations against <code className="font-mono text-foreground font-semibold">db/references.bib</code>.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-md cursor-pointer active:scale-95 transition-all"
              >
                Browse Local .tex Files
              </button>

              <button
                onClick={handleLoadSampleFiles}
                disabled={isScanning}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border font-semibold text-xs text-foreground rounded-xl cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                <FolderOpen className="w-4 h-4 text-primary" />
                Load Sample Files (from tmp/)
              </button>
            </div>

            <div className="pt-4 border-t border-border/60 text-[11px] text-muted-foreground flex items-center gap-4">
              <span>✓ Multi-file batch speedup</span>
              <span>•</span>
              <span>✓ Title-slug & DOI resolution</span>
              <span>•</span>
              <span>✓ Suspicious format audit</span>
            </div>
          </div>
        </div>
      ) : (
        /* Workspace Screen */
        <div className="flex-1 flex flex-col overflow-hidden space-y-4">
          {/* Replaced .bib File Change Alert */}
          {hasBibChangedSinceScan && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  <strong>Database Changed:</strong> <code>db/references.bib</code> was replaced or modified on disk. Your active citations may have new resolutions.
                </span>
              </div>
              <button
                onClick={reloadBibDatabase}
                disabled={isReloadingBib}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-xs whitespace-nowrap cursor-pointer transition-colors shadow-xs"
              >
                {isReloadingBib ? 'Reloading...' : 'Re-Scan With Updated .bib'}
              </button>
            </div>
          )}

          {/* Executive Stats HUD */}
          <SyncerStatsHud
            summary={scanSummary}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          {/* Controls Bar: Multi-file Tabs & View Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3 p-2 bg-secondary/25 border border-border rounded-xl">
            {/* File Switcher Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-xl py-0.5">
              {scanSummary.files.map((f, idx) => {
                const isActive = activeFileIndex === idx;
                const hasMissing = f.stats.missing > 0;

                return (
                  <button
                    key={f.fileName}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <span>{f.fileName}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      isActive 
                        ? 'bg-primary-foreground/20 text-primary-foreground' 
                        : hasMissing 
                        ? 'bg-rose-500/20 text-rose-500 font-bold' 
                        : 'bg-secondary text-muted-foreground'
                    }`}>
                      {f.stats.total}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search keys or context..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-medium"
                />
              </div>

              <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border text-xs">
                <button
                  onClick={() => setActiveViewTab('citations')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    activeViewTab === 'citations' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Citations ({filteredCitations.length})
                </button>
                <button
                  onClick={() => setActiveViewTab('suspicious')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    activeViewTab === 'suspicious' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>Suspicious</span>
                  {activeFileResult && (activeFileResult.suspiciousFindings.length > 0 || activeFileResult.stats.suspicious > 0) && (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                </button>
                <button
                  onClick={() => setActiveViewTab('export')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    activeViewTab === 'export' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Summary & Download
                </button>
              </div>
            </div>
          </div>

          {/* Active View Content */}
          <div className="flex-1 overflow-y-auto pr-1">
            {activeViewTab === 'citations' && activeFileResult && (
              <CitationInspectionTable
                citations={filteredCitations}
                fileName={activeFileResult.fileName}
                onSetOverride={handleSetOverride}
                onResetOverride={handleResetOverride}
                onToggleIgnore={handleToggleIgnore}
              />
            )}

            {activeViewTab === 'suspicious' && activeFileResult && (
              <SuspiciousFindingsPanel
                suspiciousFindings={activeFileResult.suspiciousFindings}
                suspiciousCitations={activeFileResult.citations.filter(
                  c => c.status === 'SUSPICIOUS' || c.status === 'MISSING' || c.status === 'AMBIGUOUS'
                )}
                fileName={activeFileResult.fileName}
              />
            )}

            {activeViewTab === 'export' && (
              <ExecutionSummaryPanel
                summary={scanSummary}
                exportedFiles={exportedFiles}
                isExporting={isExporting}
                onPrepareExport={prepareExport}
                onDownloadSingle={downloadSingleFile}
                onDownloadAll={downloadAllFiles}
                onExportReport={exportSummaryReport}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      )}

      {/* Diff Inspector Modal */}
      {diffModalFile && (
        <TexDiffModal
          fileResult={diffModalFile}
          syncedContent={getFileSyncedContent(diffModalFile).content}
          originalContent={uploadedFiles.find(f => f.name === diffModalFile.fileName)?.content || diffModalFile.processedContent}
          onClose={() => setDiffModalFile(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
