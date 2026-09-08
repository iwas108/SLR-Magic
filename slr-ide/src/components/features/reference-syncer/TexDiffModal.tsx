import React, { useState } from 'react';
import { X, FileCode, Check, Copy } from 'lucide-react';
import type { ScannedFileResult } from '@/lib/services/reference-syncer-types';

interface TexDiffModalProps {
  fileResult: ScannedFileResult;
  syncedContent: string;
  originalContent?: string;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function TexDiffModal({
  fileResult,
  syncedContent,
  originalContent,
  onClose,
  showToast
}: TexDiffModalProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copied, setCopied] = useState(false);

  const handleCopySynced = () => {
    navigator.clipboard.writeText(syncedContent);
    setCopied(true);
    showToast('Synced LaTeX copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-secondary/30">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm text-foreground">
                LaTeX Diff Inspector: <code className="font-mono text-primary">{fileResult.fileName}</code>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Reviewing citation substitutions before export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  viewMode === 'split' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  viewMode === 'unified' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Synced View
              </button>
            </div>

            <button
              onClick={handleCopySynced}
              className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-foreground"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Synced'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {viewMode === 'split' ? (
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-secondary/10">
                <div className="px-3 py-1.5 bg-secondary/60 border-b border-border text-[11px] font-bold text-muted-foreground flex justify-between">
                  <span>ORIGINAL CONTENT</span>
                  <span>{fileResult.citations.length} Total Citations</span>
                </div>
                <textarea
                  readOnly
                  value={originalContent || fileResult.processedContent}
                  className="w-full flex-1 p-3 bg-transparent text-muted-foreground font-mono text-xs focus:outline-none resize-none leading-relaxed h-[60vh]"
                />
              </div>

              <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-primary/5">
                <div className="px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-[11px] font-bold text-primary flex justify-between">
                  <span>SYNCHRONIZED OUTPUT</span>
                  <span>{fileResult.stats.replaced} Replaced</span>
                </div>
                <textarea
                  readOnly
                  value={syncedContent}
                  className="w-full flex-1 p-3 bg-transparent text-foreground font-mono text-xs focus:outline-none resize-none leading-relaxed h-[60vh]"
                />
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <div className="px-3 py-1.5 bg-secondary/60 border-b border-border text-[11px] font-bold text-muted-foreground">
                SYNCHRONIZED LATEX (.tex)
              </div>
              <textarea
                readOnly
                value={syncedContent}
                className="w-full p-4 bg-transparent text-foreground font-mono text-xs focus:outline-none resize-none leading-relaxed h-[65vh]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-secondary/20 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer"
          >
            Close Diff Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
