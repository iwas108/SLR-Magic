import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  FileCheck, 
  WrapText, 
  Search
} from 'lucide-react';
import type { ExportedSyncedFile } from '@/hooks/useReferenceSyncer';

interface SyncedTextViewerModalProps {
  files: ExportedSyncedFile[];
  initialFileName?: string;
  onClose: () => void;
  onDownloadSingle: (file: ExportedSyncedFile) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function SyncedTextViewerModal({
  files,
  initialFileName,
  onClose,
  onDownloadSingle,
  showToast
}: SyncedTextViewerModalProps) {
  const [activeFileName, setActiveFileName] = useState<string>(() => {
    if (initialFileName && files.some(f => f.syncedName === initialFileName || f.originalName === initialFileName)) {
      return initialFileName;
    }
    return files[0]?.syncedName || '';
  });

  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const activeFile = useMemo(() => {
    return files.find(f => f.syncedName === activeFileName || f.originalName === activeFileName) || files[0];
  }, [files, activeFileName]);

  const lines = useMemo(() => {
    if (!activeFile) return [];
    return activeFile.content.split('\n');
  }, [activeFile]);

  const filteredLineCount = useMemo(() => {
    if (!searchQuery.trim()) return lines.length;
    const q = searchQuery.toLowerCase();
    return lines.filter(l => l.toLowerCase().includes(q)).length;
  }, [lines, searchQuery]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeFile.content);
      } else {
        const ta = document.createElement('textarea');
        ta.value = activeFile.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      showToast?.(`Copied ${activeFile.syncedName} to clipboard!`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      showToast?.('Failed to copy to clipboard', 'error');
    }
  };

  if (!activeFile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in-50 duration-150">
      <div 
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-secondary/25 gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-foreground truncate">
                  {activeFile.syncedName}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30 shrink-0">
                  {activeFile.replacementsCount} replaced
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {(activeFile.sizeBytes / 1024).toFixed(1)} KB • {lines.length} lines
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Full synchronized LaTeX manuscript ready for compilation
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Wrap Lines Toggle */}
            <button
              onClick={() => setWrapLines(!wrapLines)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                wrapLines 
                  ? 'bg-secondary text-foreground border-border' 
                  : 'bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground'
              }`}
              title={wrapLines ? 'Disable line wrap' : 'Enable line wrap'}
            >
              <WrapText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{wrapLines ? 'Wrap' : 'No Wrap'}</span>
            </button>

            {/* Copy Full Text Button */}
            <button
              onClick={handleCopy}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                copied 
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
              title="Copy entire synchronized file to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
            </button>

            {/* Download Button */}
            <button
              onClick={() => onDownloadSingle(activeFile)}
              className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title={`Download ${activeFile.syncedName}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Secondary Subheader / Multi-File Tab Bar & Search */}
        <div className="px-5 py-2 border-b border-border bg-secondary/15 flex items-center justify-between gap-3 flex-wrap">
          {/* File Tabs */}
          {files.length > 1 ? (
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              {files.map(f => {
                const isActive = (f.syncedName === activeFile.syncedName);
                return (
                  <button
                    key={f.syncedName}
                    onClick={() => {
                      setActiveFileName(f.syncedName);
                      setCopied(false);
                      setSearchQuery('');
                    }}
                    className={`px-3 py-1 rounded-lg font-mono text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-xs' 
                        : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50'
                    }`}
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    <span>{f.syncedName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-primary-foreground/20 text-white' : 'bg-secondary text-muted-foreground'}`}>
                      {f.replacementsCount}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground font-mono">
              Displaying synchronized output for {activeFile.syncedName}
            </div>
          )}

          {/* In-File Filter / Quick Search */}
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find in text..."
              className="w-full pl-8 pr-7 py-1 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:border-primary"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Code Content Area with Line Numbers */}
        <div className="flex-1 overflow-auto bg-slate-950 text-slate-100 font-mono text-xs p-4 select-text">
          <div className="min-w-full">
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const matchesSearch = searchQuery.trim() !== '' && line.toLowerCase().includes(searchQuery.toLowerCase());
              const isHighlight = searchQuery.trim() !== '' && !matchesSearch;

              return (
                <div 
                  key={lineNum} 
                  className={`flex leading-relaxed hover:bg-slate-900/80 transition-colors ${
                    matchesSearch ? 'bg-amber-500/20 text-amber-200' : isHighlight ? 'opacity-40' : ''
                  }`}
                >
                  <span className="w-12 pr-4 text-right select-none text-slate-600 font-mono text-[11px] shrink-0 border-r border-slate-800/80">
                    {lineNum}
                  </span>
                  <span 
                    className={`pl-4 flex-1 ${
                      wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                    }`}
                  >
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-2.5 border-t border-border bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Total lines: <strong className="text-foreground">{lines.length}</strong></span>
            {searchQuery.trim() && (
              <span>
                Matching lines: <strong className="text-primary">{filteredLineCount}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span>Tip: Click <strong>Copy Text</strong> to paste directly into Overleaf or VS Code</span>
          </div>
        </div>
      </div>
    </div>
  );
}
