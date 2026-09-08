import React, { useState } from 'react';
import { 
  Download, 
  FileCheck, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Share2, 
  Sparkles, 
  Info,
  Eye,
  Copy,
  Check
} from 'lucide-react';
import type { GlobalScanSummary } from '@/lib/services/reference-syncer-types';
import { ExportedSyncedFile } from '@/hooks/useReferenceSyncer';
import SyncedTextViewerModal from './SyncedTextViewerModal';

interface ExecutionSummaryPanelProps {
  summary: GlobalScanSummary;
  exportedFiles: ExportedSyncedFile[] | null;
  isExporting: boolean;
  onPrepareExport: () => void;
  onDownloadSingle: (file: ExportedSyncedFile) => void;
  onDownloadAll: () => void;
  onExportReport: (format: 'markdown' | 'json') => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function ExecutionSummaryPanel({
  summary,
  exportedFiles,
  isExporting,
  onPrepareExport,
  onDownloadSingle,
  onDownloadAll,
  onExportReport,
  showToast
}: ExecutionSummaryPanelProps) {
  const [viewingFile, setViewingFile] = useState<ExportedSyncedFile | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const totalReplacements = summary.files.reduce((acc, f) => acc + f.stats.replaced, 0);

  const handleCopySingle = async (file: ExportedSyncedFile) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(file.content);
      } else {
        const ta = document.createElement('textarea');
        ta.value = file.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(file.syncedName);
      showToast?.(`Copied ${file.syncedName} to clipboard!`, 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error(err);
      showToast?.('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyAll = async () => {
    if (!exportedFiles || exportedFiles.length === 0) return;
    try {
      const combined = exportedFiles.map(f => (
        `%%% ==========================================================================\n` +
        `%%% FILE: ${f.syncedName} (${f.replacementsCount} citations replaced)\n` +
        `%%% ==========================================================================\n\n` +
        f.content
      )).join('\n\n\n');

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(combined);
      } else {
        const ta = document.createElement('textarea');
        ta.value = combined;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedAll(true);
      showToast?.(`Copied all ${exportedFiles.length} files to clipboard!`, 'success');
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error(err);
      showToast?.('Failed to copy all files to clipboard', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header / Export Trigger */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Synchronized File Generation & Export
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compile reviewed citations into clean LaTeX files ready for publication compiling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onExportReport('markdown')}
            className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Export Report (MD)
          </button>

          {!exportedFiles && (
            <button
              onClick={onPrepareExport}
              disabled={isExporting}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating Files...' : 'Prepare Download Links'}
            </button>
          )}
        </div>
      </div>

      {/* Execution Summary Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-3 bg-secondary/30 border-b border-border flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Multi-File Execution Summary Matrix
          </h4>
          <span className="text-xs text-muted-foreground">
            {summary.totalFiles} files • {summary.totalCitations} total citations • {totalReplacements} replaced
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-secondary/15 border-b border-border text-muted-foreground font-semibold">
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3 text-center">Total Citations</th>
                <th className="py-2.5 px-3 text-center text-blue-500">Replaced</th>
                <th className="py-2.5 px-3 text-center text-emerald-500">Preserved (Bib)</th>
                <th className="py-2.5 px-3 text-center text-amber-500">Ambiguous</th>
                <th className="py-2.5 px-3 text-center text-rose-500">Missing</th>
                <th className="py-2.5 px-3 text-center text-orange-500">Suspicious In-Text</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {summary.files.map((file) => {
                const hasMissing = file.stats.missing > 0;
                const hasAmbiguous = file.stats.ambiguous > 0;

                return (
                  <tr key={file.fileName} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-foreground flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-primary shrink-0" />
                      {file.fileName}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold">
                      {file.stats.total}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                      {file.stats.replaced}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {file.stats.exact}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">
                      {file.stats.ambiguous}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                      {file.stats.missing}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-orange-600 dark:text-orange-400">
                      {file.suspiciousFindings.length}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {hasMissing ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                          Needs Review
                        </span>
                      ) : hasAmbiguous ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Ambiguous
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Synchronized
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dedicated Download Links Area (Presented one by one per user directive) */}
      {exportedFiles && exportedFiles.length > 0 && (
        <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-5 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Synchronized Files Ready for Download
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                Please click the download link for each file below to save your updated .tex files:
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAll}
                className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy all synchronized files with file headers to clipboard"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAll ? 'All Files Copied!' : 'Copy All Files'}</span>
              </button>

              <button
                onClick={onDownloadAll}
                className="px-3.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download All Files Sequentially
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {exportedFiles.map((file) => (
              <div
                key={file.syncedName}
                className="p-3.5 rounded-xl border border-border bg-secondary/15 hover:bg-secondary/30 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-mono text-xs font-bold text-foreground truncate" title={file.syncedName}>
                      {file.syncedName}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span className="text-blue-500 font-semibold">{file.replacementsCount} replaced</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setViewingFile(file)}
                    className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-medium text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                    title={`View full synchronized text for ${file.syncedName}`}
                  >
                    <Eye className="w-3.5 h-3.5 text-primary" />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => handleCopySingle(file)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-all ${
                      copiedKey === file.syncedName
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-secondary hover:bg-secondary/80 border border-border text-foreground'
                    }`}
                    title={`Copy full ${file.syncedName} text to clipboard`}
                  >
                    {copiedKey === file.syncedName ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === file.syncedName ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => onDownloadSingle(file)}
                    className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer active:scale-95 transition-all"
                    title={`Click to download ${file.syncedName}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synced Text Viewer Modal */}
      {viewingFile && exportedFiles && (
        <SyncedTextViewerModal
          files={exportedFiles}
          initialFileName={viewingFile.syncedName}
          onClose={() => setViewingFile(null)}
          onDownloadSingle={onDownloadSingle}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function FileCode2(props: any) {
  return <FileText {...props} />;
}
